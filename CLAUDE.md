# GastosIn — Claude Code Context File

> Read this file at the start of every session. It contains all architectural decisions,
> constraints, and MVP scope. Do not ask Erick to re-explain anything documented here.
> When in doubt, consult this file before making any decision.

---

## What is GastosIn?

A **privacy-first credit card statement analysis platform** targeting Philippine users.
Users upload bank/credit card PDF statements, see categorized spending insights, and
export a re-importable file that enables month-over-month trend tracking.

**Core promise**: We never silently send your data anywhere. You see exactly what was
extracted before anything is processed.

---

## Geographic Focus

**Philippines first.** No expansion to other markets until this is validated.
This is intentional to prevent scope creep — do not suggest features for other markets.
Currency is **PHP (Philippine Peso)** unless explicitly told otherwise.

---

## Tech Stack

### Frontend
- **Framework**: React + Vite
- **Routing**: react-router-dom
- **Styling**: Tailwind CSS
- **PDF parsing**: pdf.js (pdfjs-dist)
- **Local storage**: IndexedDB via `idb`
- **Language**: JavaScript (JSX) — not TypeScript for now

### Backend
- **Framework**: FastAPI (Python)
- **Runtime**: Python 3.12
- **Server**: Uvicorn
- **Validation**: Pydantic v2
- **OCR fallback**: Azure Document Intelligence (sanitized regions only)
- **Language**: Python

### Infrastructure
- **Containerization**: Docker (separate containers for frontend + backend)
- **Local dev**: `docker-compose.yml` with hot reload for both services
- **CI/CD**: GitHub Actions — on push to `main` → build → push to registry → deploy
- **Frontend prod server**: nginx (serves built React app, proxies `/api` to backend)
- **Encryption**: AES-256, user-held passphrase, PBKDF2 key derivation

---

## Repository Structure

```
gastosin/
├── CLAUDE.md                   ← this file
├── docker-compose.yml          ← local dev (hot reload)
├── docker-compose.prod.yml     ← production overrides
├── .github/
│   └── workflows/
│       ├── deploy.yml          ← push to main → build + deploy
│       └── ci.yml              ← PR checks (lint, test)
│
├── frontend/
│   ├── Dockerfile              ← multi-stage: dev / build / prod (nginx)
│   ├── nginx/
│   │   └── nginx.conf
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx
│       ├── App.jsx             ← routing: / → /preview → /dashboard
│       ├── pages/
│       │   ├── UploadPage.jsx
│       │   ├── PreviewPage.jsx     ← MANDATORY — never make skippable
│       │   └── DashboardPage.jsx
│       ├── components/
│       │   ├── ui/             ← generic reusable UI primitives
│       │   ├── layout/         ← shell, nav, wrappers
│       │   ├── upload/         ← PDF upload + drop zone
│       │   ├── preview/        ← transaction verification table
│       │   ├── dashboard/      ← charts, category breakdown
│       │   └── vault/          ← vault mode toggle, passphrase prompt
│       ├── lib/
│       │   ├── parser/         ← pdf.js parsing logic
│       │   ├── sanitizer/      ← PII stripping (runs before ANY network call)
│       │   ├── categorizer/    ← thin API caller → POST /api/categorize
│       │   ├── vault/          ← AES-256 encrypt/decrypt, PBKDF2
│       │   └── export/         ← re-importable export format read/write/merge
│       └── hooks/              ← custom React hooks
│
└── backend/
    ├── Dockerfile              ← multi-stage: dev / prod
    ├── main.py                 ← FastAPI app, CORS, router registration
    ├── requirements.txt
    ├── .env.example
    └── src/
        ├── routes/
        │   ├── health.py       ← GET /health
        │   └── categorize.py   ← POST /api/categorize
        ├── models/
        │   └── __init__.py     ← Pydantic request/response models
        ├── services/
        │   ├── categorizer/    ← proprietary categorization logic (the moat)
        │   └── azure/          ← Azure Document Intelligence client
        ├── middleware/         ← rate limiting, request logging
        └── utils/
```

---

## Core Product Flow (Non-Negotiable)

```
1. User uploads PDF statement                          [UploadPage]
2. Client-side parsing via pdf.js
   └─ If low confidence → Azure DocInt fallback
      └─ ONLY sanitized bounding box regions sent — NEVER the full PDF
3. Client-side PII sanitization                        [lib/sanitizer]
   └─ Strip: card numbers, full names, account IDs
   └─ Retain: { date, merchant, amount } ONLY
4. ★ MANDATORY PREVIEW STEP ★                          [PreviewPage]
   └─ User sees and verifies extracted transactions
   └─ User can edit/remove rows before proceeding
   └─ NOTHING is processed until user confirms
5. POST /api/categorize with sanitized rows            [lib/categorizer]
   └─ Returns { date, merchant, amount, category, subcategory }
6. Dashboard rendered client-side                      [DashboardPage]
7. Export in re-importable format                      [lib/export]
   └─ User returns next month, imports previous export + new statement
   └─ mergeExports() deduplicates by (date + merchant + amount)
```

**The preview step (step 4) is non-negotiable.** It is a core trust mechanism.
Never remove it, never make it skippable, never auto-advance past it.

---

## API Contract

The backend accepts **only** this shape — no exceptions:

```python
# Request
POST /api/categorize
{
  "transactions": [
    { "date": "2024-01-15", "merchant": "SM Supermarket", "amount": 1250.00 }
  ]
}

# Response
{
  "transactions": [
    { "date": "2024-01-15", "merchant": "SM Supermarket", "amount": 1250.00,
      "category": "Groceries", "subcategory": "Supermarket" }
  ]
}
```

No PII ever reaches the backend. If you find yourself adding fields to this contract,
stop and check with Erick first.

---

## Privacy Architecture

### Two Modes

| Mode | Description | Default? |
|------|-------------|----------|
| **Ephemeral** | Nothing persists after session ends | ✅ Yes |
| **Encrypted Vault** | AES-256, user-held passphrase, IndexedDB | No (opt-in) |

### Hard Rules
- Full PDF is **never** transmitted anywhere — not even to our own backend
- PII is stripped **before** any network call, including the Azure fallback
- Azure Document Intelligence receives only sanitized bounding box regions
- Backend receives only `{ date, merchant, amount }` — nothing else
- Encryption key is derived from user passphrase via PBKDF2, never stored

### Trust Signals (must be visible in UI)
- Plain-language privacy banners (not legal jargon)
- In-app network activity log showing exactly what was transmitted
- Open-source badge linking to the client repo

---

## Export Format

```json
{
  "version": "1",
  "exportedAt": "2024-02-01T00:00:00Z",
  "transactions": [
    {
      "date": "2024-01-15",
      "merchant": "SM Supermarket",
      "amount": 1250.00,
      "category": "Groceries",
      "subcategory": "Supermarket"
    }
  ]
}
```

Rules:
- Always include `version` — migrations depend on it
- Self-contained — no server needed to read it
- Deduplication key: `(date + merchant + amount)`
- File extension: TBD — ask Erick before finalizing

---

## Merchant Categorization (The Moat)

Three-layer taxonomy — **backend only, stays proprietary**:

| Layer | Description | MVP? |
|-------|-------------|------|
| Base defaults | Common PH merchants, ships day one | ✅ Yes |
| Learned mappings | Aggregate anonymized user corrections | Post-MVP |
| Personal overrides | Per-user customizations | Post-MVP |

MVP ships base defaults only. Do not build override UI yet.

---

## Docker & Local Dev

```bash
# Start everything locally with hot reload
docker-compose up

# Frontend: http://localhost:3000
# Backend:  http://localhost:8000
# API docs: http://localhost:8000/docs  (FastAPI auto-generated)
```

Local dev uses volume mounts for hot reload — no rebuild needed on file changes.

---

## CI/CD (GitHub Actions)

| Trigger | Workflow | What it does |
|---------|----------|--------------|
| Push to `main` | `deploy.yml` | Build images → push to registry → deploy |
| Pull request | `ci.yml` | Lint + test (no deploy) |

Secrets needed in GitHub repo settings:
- `REGISTRY_URL` — container registry URL
- `REGISTRY_USERNAME` / `REGISTRY_PASSWORD`
- `DEPLOY_HOST` / `DEPLOY_KEY` — SSH deploy target
- `AZURE_DOCUMENT_INTELLIGENCE_KEY` + `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT`

---

## Environment Variables

### Frontend (`.env.local`)
```
VITE_API_URL=/api
```

### Backend (`.env`)
```
AZURE_DOCUMENT_INTELLIGENCE_KEY=
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=
ALLOWED_ORIGINS=http://localhost:3000
ENV=development
```

---

## MVP Scope

### In scope
- PDF upload + client-side parsing (pdf.js)
- Azure Document Intelligence fallback (sanitized only)
- PII sanitization layer
- Mandatory preview/verification step
- Merchant categorization (base defaults, backend)
- Spending dashboard (client-side rendering)
- Re-importable export format
- Ephemeral mode (default)
- Encrypted vault mode (opt-in, AES-256)
- Privacy trust signals (banners, network log)
- Docker local dev + GH Actions CI/CD

### Not in scope (do not build)
- User accounts / authentication
- Server-side storage
- Category customization / personal overrides
- Multi-currency support
- Bank integrations / open banking
- Mobile app
- Multi-user / sharing features
- Monetization flows (not finalized)
- Admin dashboard

---

## Open Questions (do not assume — ask Erick)

- **Export file extension**: Format defined, extension TBD
- **Monetization**: Not finalized — do not add paywall/gating logic
- **Deploy target**: VPS (self-hosted) ✅ Decided
- **Container registry**: Azure Container Registry (ACR) ✅ Decided

---

## Subagent Guidelines

When Erick spawns subagents for parallel work:
- Every subagent reads this file first before touching any code
- Subagents do not make architectural decisions — surface ambiguities to Erick
- Privacy constraints apply to all subagents equally — no shortcuts
- Always work on feature branches, never commit directly to `main`
- PR titles should follow: `feat:`, `fix:`, `chore:` prefixes

---

## Key Principles

1. **Privacy is a product pillar, not a feature.** Any shortcut that compromises the
   privacy architecture is a regression, not a tradeoff.

2. **The preview step is sacred.** Users verify before anything is processed. Always.

3. **The export format is a schema.** Treat breaking changes like DB migrations.

4. **The categorization API is the moat.** Backend only. Never bundle client-side.
   Never open-source the backend.

5. **Philippines first.** Don't build for edge cases outside this market yet.

6. **Server-ready architecture.** Browser storage for MVP, but never paint yourself
   into a corner — the vault module must be swappable to server-side without a rewrite.

---

*Last updated: 2026-03-28*
*Maintained by: Erick*
