# Cognitia Sales Closer Engine

A human-supervised B2B sales pipeline: scrape prospects (Apify) → enrich &
score (LLM) → generate a **closer brief** → **human approval** → hand off to a
voice/closer vendor (SalesCloser.ai today; Vapi/Retell/Twilio later) → record
call outcomes — all with a compliance audit trail.

This is a Next.js 15 app inside the Cognitia pnpm + Turborepo monorepo. Core
logic lives in `packages/*`; this app provides the API routes and admin UI.

## Architecture

```
apps/sales-closer        Next.js app: API routes + admin UI
packages/config          zod-validated env loader + shared constants
packages/db              Drizzle schema (9 tables), migrations, client, seed
packages/core            domain logic: normalize, scoring, brief, compliance
packages/llm             provider-agnostic LLM (mock | anthropic | openai)
packages/apify           Apify client (+ mock fixtures)
packages/adapters        VoiceVendorAdapter interface + Mock/SalesCloser/stubs
packages/vision          TS bridge to the existing python hermes vision-skill
```

### Data model (`packages/db`)

`prospect_accounts`, `prospect_contacts`, `scrape_runs`, `prospect_signals`,
`closer_scores`, `closer_briefs`, `outreach_drafts`, `compliance_logs`
(append-only), `vendor_sync_events` (idempotent on `idempotency_key`).

### API routes

| Method + path | Purpose |
|---|---|
| `POST /api/scrape-runs` | start a scrape run (Apify actor) |
| `POST /api/scrape-runs/:id/import` | import an Apify dataset |
| `POST /api/accounts/normalize` | normalize staged rows → accounts/contacts |
| `POST /api/accounts/:id/score` | score an account (idempotent on signals hash) |
| `POST /api/accounts/:id/brief` | generate a closer brief |
| `POST /api/drafts/:id/approve` · `/reject` | human approval |
| `POST /api/vendor/leads` | create a vendor lead from an approved draft |
| `POST /api/vendor/calls/schedule` | schedule a vendor call |
| `POST /api/vendor/webhooks/:vendor` | receive vendor webhooks (signed, idempotent) |

Read routes back the UI: `GET /api/accounts`, `/api/accounts/:id`,
`/api/dashboard/outcomes`.

### Admin screens

`/prospects`, `/prospects/[id]`, `/prospects/[id]/audit`,
`/prospects/[id]/brief`, `/approvals`, `/dashboard`, `/compliance`.

## Local development (mock mode)

`MOCK_MODE=true` (the default) uses in-memory mock adapters — no Apify, vendor,
or LLM keys needed — and deterministic seed data.

```bash
pnpm install
cp .env.example .env                 # at the repo root

# Point DATABASE_URL at a local Postgres, then:
pnpm db:reset                        # drop + migrate + seed
pnpm --filter @cognitia/sales-closer dev   # http://localhost:3001
```

## Switching to real services

Set in `.env`:

```
MOCK_MODE=false
APIFY_TOKEN=...
LLM_PROVIDER=anthropic            # ANTHROPIC_API_KEY + ANTHROPIC_MODEL
VENDOR_NAME=salescloser           # SALESCLOSER_API_KEY + SALESCLOSER_WEBHOOK_SECRET
```

The model id is always read from env, never hardcoded.

## Testing

```bash
pnpm turbo run lint typecheck test            # unit + (skipped) integration

# Integration tests against a disposable Postgres:
TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5433/sales_closer \
  pnpm --filter @cognitia/sales-closer test

# E2E (requires browsers + a seeded DB):
npx playwright install chromium
pnpm --filter @cognitia/sales-closer e2e
```

- **Unit** — `packages/core` (normalize/scoring/brief), `packages/adapters`
  (mock lifecycle, SalesCloser signature verify), `llm`, `apify`, `vision`.
- **Integration** — full pipeline against real Postgres, incl. webhook
  idempotency and DNC → consent suppression. Skips when `TEST_DATABASE_URL`
  is unset.
- **E2E** — Playwright walkthrough in mock mode.
