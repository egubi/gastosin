-- =============================================================
-- GastosIn :: Full Schema Bootstrap
-- Target: Azure Database for PostgreSQL Flexible Server 16
-- Extensions must be allowlisted in azure.extensions:
--   pgcrypto, uuid-ossp, pg_trgm, citext
-- Run this file once against a fresh database.
-- =============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;

-- =============================================================
-- SESSION RESULTS
-- Per-session categorization output, encrypted payload
-- =============================================================
CREATE TABLE session_results (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_hash        TEXT NOT NULL,
    created_at          TIMESTAMPTZ DEFAULT now(),
    transaction_count   INT,
    batch_month         DATE,
    top_category        TEXT,
    results_enc         BYTEA NOT NULL
);
CREATE INDEX idx_session_results_hash  ON session_results (session_hash);
CREATE INDEX idx_session_results_month ON session_results (batch_month);

-- =============================================================
-- REQUEST LOG
-- =============================================================
CREATE TABLE request_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at  TIMESTAMPTZ DEFAULT now(),
    batch_size  INT,
    latency_ms  INT,
    llm_calls   INT,
    cache_hits  INT
);

-- =============================================================
-- CATEGORIES
-- =============================================================
CREATE TABLE categories (
    id          SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    key         CITEXT NOT NULL UNIQUE,
    label       TEXT   NOT NULL,
    parent_id   SMALLINT REFERENCES categories(id) ON DELETE RESTRICT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order  SMALLINT NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_categories_parent ON categories(parent_id);

-- =============================================================
-- MERCHANTS
-- =============================================================
CREATE TABLE merchants (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    normalized_name  CITEXT NOT NULL UNIQUE,
    display_name     TEXT,
    country_code     CHAR(2),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_merchants_norm_trgm ON merchants
    USING gin (normalized_name gin_trgm_ops);

-- =============================================================
-- MERCHANT ALIASES
-- =============================================================
CREATE TABLE merchant_aliases (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    merchant_id      UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    raw_string       TEXT   NOT NULL,
    normalized_name  CITEXT NOT NULL,
    occurrence_count BIGINT NOT NULL DEFAULT 1,
    first_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (normalized_name)
);
CREATE INDEX idx_aliases_merchant  ON merchant_aliases(merchant_id);
CREATE INDEX idx_aliases_norm_trgm ON merchant_aliases
    USING gin (normalized_name gin_trgm_ops);

-- =============================================================
-- MERCHANT CATEGORY
-- =============================================================
CREATE TYPE category_source AS ENUM ('rule', 'llm', 'human_verified', 'import');

CREATE TABLE merchant_category (
    merchant_id   UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    category_id   SMALLINT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    source        category_source NOT NULL,
    confidence    NUMERIC(4,3) NOT NULL DEFAULT 1.000,
    is_verified   BOOLEAN NOT NULL DEFAULT FALSE,
    model_version TEXT,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (merchant_id)
);
CREATE INDEX idx_mc_category ON merchant_category(category_id);
CREATE INDEX idx_mc_lowconf  ON merchant_category(confidence)
    WHERE is_verified = FALSE;

-- =============================================================
-- CATEGORIZATION LOG
-- =============================================================
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
CREATE INDEX idx_catlog_created  ON categorization_log(created_at);

-- =============================================================
-- UNRESOLVED QUEUE
-- =============================================================
CREATE TABLE unresolved_queue (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    raw_string       TEXT NOT NULL,
    normalized_name  CITEXT NOT NULL UNIQUE,
    occurrence_count BIGINT NOT NULL DEFAULT 1,
    best_guess_id    SMALLINT REFERENCES categories(id) ON DELETE SET NULL,
    best_confidence  NUMERIC(4,3),
    status           TEXT NOT NULL DEFAULT 'pending',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_unresolved_status ON unresolved_queue
    (status, occurrence_count DESC);

-- =============================================================
-- UNKNOWN FORMAT SUBMISSIONS
-- Tracks PDFs voluntarily submitted by users for unknown CC formats.
-- Actual file lives in Azure Blob Storage (container: submissions).
-- This table is the metadata record + audit trail.
-- =============================================================
CREATE TABLE unknown_format_submissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- blob reference (filename in Azure Storage submissions container)
    blob_filename   TEXT NOT NULL,

    -- file metadata
    original_name   TEXT,
    size_bytes      BIGINT,

    -- consent audit (legal coverage)
    consent_given   BOOLEAN NOT NULL DEFAULT TRUE,
    consent_text    TEXT NOT NULL,    -- exact checkbox text shown to user at time of submission
    ip_hash         TEXT,             -- hashed IP, not raw — for abuse detection only

    -- review workflow
    status          TEXT NOT NULL DEFAULT 'pending',  -- pending | reviewed | supported | ignored
    reviewed_at     TIMESTAMPTZ,
    reviewer_notes  TEXT
);
CREATE INDEX idx_submissions_status    ON unknown_format_submissions(status);
CREATE INDEX idx_submissions_created   ON unknown_format_submissions(created_at);