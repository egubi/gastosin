CREATE TABLE request_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at  TIMESTAMPTZ DEFAULT now(),
    batch_size  INT,           -- how many transactions were submitted
    latency_ms  INT,           -- total time for the request
    llm_calls   INT,           -- how many fell through to LLM
    cache_hits  INT            -- alias + merchant + fuzzy hits
);
-- ============================================================
-- Gastos-In :: Merchant Taxonomy Dictionary
-- Purpose: taxonomy-only. NO user transactions, NO amounts, NO PII.
-- Stores merchant strings -> categories so every user benefits
-- from a shared, growing dictionary.
-- Postgres 14+
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;      -- fuzzy / similarity matching
CREATE EXTENSION IF NOT EXISTS citext;       -- case-insensitive text

-- ------------------------------------------------------------
-- 1. CATEGORIES  (the closed, hierarchical taxonomy)
--    Hierarchy lets you go coarse (Food) or fine (Food > Fast Food)
--    without schema changes. This is your "closed list" for the LLM.
-- ------------------------------------------------------------
CREATE TABLE categories (
    id          SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key         CITEXT NOT NULL UNIQUE,          -- 'food_dining', 'transport'
    label       TEXT   NOT NULL,                 -- 'Food & Dining'
    parent_id   SMALLINT REFERENCES categories(id) ON DELETE RESTRICT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,   -- retire without deleting
    sort_order  SMALLINT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_categories_parent ON categories(parent_id);

-- ------------------------------------------------------------
-- 2. MERCHANTS  (one canonical row per real-world merchant)
--    normalized_name is the dictionary KEY. Strip IDs, locations,
--    punctuation before insert: "PAYPAL *NBA LG PASS, [ID]" -> "paypal nba lg pass"
-- ------------------------------------------------------------
CREATE TABLE merchants (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    normalized_name  CITEXT NOT NULL UNIQUE,     -- the lookup key
    display_name     TEXT,                       -- pretty label for UI
    country_code     CHAR(2),                    -- 'PH' — same brand, diff region
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- trigram index for fuzzy matching when exact lookup misses
CREATE INDEX idx_merchants_norm_trgm ON merchants USING gin (normalized_name gin_trgm_ops);

-- ------------------------------------------------------------
-- 3. MERCHANT_ALIASES  (the raw statement strings people actually see)
--    Many raw variants -> one merchant. This is what makes the
--    dictionary robust: every new spelling you learn is stored once.
--    occurrence_count = popularity signal (NOT tied to any user).
-- ------------------------------------------------------------
CREATE TABLE merchant_aliases (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    merchant_id      UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    raw_string       TEXT   NOT NULL,            -- exact string as seen on statement
    normalized_name  CITEXT NOT NULL,            -- normalized form of raw_string
    occurrence_count BIGINT NOT NULL DEFAULT 1,  -- how often seen across all users
    first_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (normalized_name)
);
CREATE INDEX idx_aliases_merchant ON merchant_aliases(merchant_id);
CREATE INDEX idx_aliases_norm_trgm ON merchant_aliases USING gin (normalized_name gin_trgm_ops);

-- ------------------------------------------------------------
-- 4. MERCHANT_CATEGORY  (the actual dictionary mapping)
--    Current best category for a merchant + provenance & trust.
--    One active mapping per merchant; history kept in audit table.
-- ------------------------------------------------------------
CREATE TYPE category_source AS ENUM ('rule', 'llm', 'human_verified', 'import');

CREATE TABLE merchant_category (
    merchant_id   UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    category_id   SMALLINT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    source        category_source NOT NULL,
    confidence    NUMERIC(4,3) NOT NULL DEFAULT 1.000,  -- 0.000–1.000
    is_verified   BOOLEAN NOT NULL DEFAULT FALSE,       -- reviewed by a human
    model_version TEXT,                                 -- which LLM/prompt assigned it
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (merchant_id)                           -- one active mapping per merchant
);
CREATE INDEX idx_mc_category ON merchant_category(category_id);
CREATE INDEX idx_mc_lowconf ON merchant_category(confidence) WHERE is_verified = FALSE;

-- ------------------------------------------------------------
-- 5. CATEGORIZATION_LOG  (audit trail — every decision, incl. LLM I/O)
--    Feeds future model training + lets you debug bad calls.
--    Also captures corrections (source=human_verified overriding an llm row).
-- ------------------------------------------------------------
CREATE TABLE categorization_log (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    merchant_id     UUID REFERENCES merchants(id) ON DELETE SET NULL,
    raw_string      TEXT NOT NULL,
    category_id     SMALLINT REFERENCES categories(id) ON DELETE SET NULL,
    source          category_source NOT NULL,
    confidence      NUMERIC(4,3),
    model_version   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_catlog_merchant ON categorization_log(merchant_id);
CREATE INDEX idx_catlog_created ON categorization_log(created_at);

-- ------------------------------------------------------------
-- 6. UNRESOLVED_QUEUE  (things the LLM couldn't confidently place)
--    Instead of forcing a wrong "Other", park low-confidence strings
--    here for human/LLM review. This is your taxonomy-growth backlog.
-- ------------------------------------------------------------
CREATE TABLE unresolved_queue (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    raw_string       TEXT NOT NULL,
    normalized_name  CITEXT NOT NULL UNIQUE,
    occurrence_count BIGINT NOT NULL DEFAULT 1,
    best_guess_id    SMALLINT REFERENCES categories(id) ON DELETE SET NULL,
    best_confidence  NUMERIC(4,3),
    status           TEXT NOT NULL DEFAULT 'pending',  -- pending|resolved|ignored
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_unresolved_status ON unresolved_queue(status, occurrence_count DESC);

-- ============================================================
-- POST-MVP ROADMAP  (NOT implemented — do not build for MVP)
-- Kept here so scope is captured and the taxonomy design stays
-- compatible with it. Revisit after MVP ships.
-- ============================================================

-- (A) USER OVERRIDES  — per-user recategorization without touching
--     the shared global dictionary. The global map above stays the
--     source of truth; this only changes what ONE user sees.
--     Design hook: keep merchant_category as global; add a thin
--     override layer keyed by (user_id, merchant_id). Resolution at
--     read time = user_override ?? merchant_category. A repeated,
--     agreeing override across many users is a strong signal to
--     promote it into the global map (is_verified = TRUE).
--
--     CREATE TABLE user_overrides (
--         user_id     UUID NOT NULL,
--         merchant_id UUID NOT NULL REFERENCES merchants(id),
--         category_id SMALLINT NOT NULL REFERENCES categories(id),
--         created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
--         PRIMARY KEY (user_id, merchant_id)
--     );

-- (B) SAVED / RESUMABLE REPORTS  — user leaves, comes back next
--     month, inputs prior month via a "code", and the app concats
--     with the current month. Report payloads ENCRYPTED at rest.
--     Key open questions to resolve BEFORE building:
--       - The "code": is it the decryption key itself (zero-knowledge,
--         we can't read it) or just a lookup handle to an encrypted
--         row? Zero-knowledge is safer but means lost code = lost data.
--       - Encryption boundary: app-layer (envelope encryption, keys in
--         KMS) vs pgcrypto. App-layer preferred for key rotation.
--       - This introduces USER-LINKED financial data — a different
--         privacy/compliance posture than the taxonomy-only core.
--         Keep it in a SEPARATE table/schema so the shared dictionary
--         stays clean and reusable.
--
--     Sketch only (do not create yet):
--     CREATE TABLE saved_reports (
--         id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--         access_code_hash TEXT NOT NULL,   -- hash of user code, never plaintext
--         ciphertext     BYTEA NOT NULL,    -- encrypted report payload
--         period         DATE NOT NULL,     -- month this report covers
--         created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
--     );
