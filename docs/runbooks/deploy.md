# Deploy Runbook — first production deployment

Shape: **Vercel (web) + one container host (api) + Supabase Postgres (pgvector) + external hourly scheduler**. The worker is deliberately not deployed: it registers zero jobs and exits (`apps/worker/src/index.ts`), and `POST /jobs/crm-sync` is a stub. Revisit when `runRegisteredJobs` has a real job — and gate that route with auth before it does real work.

## 1. Database (Supabase)

1. Create the project; enable extensions `pgcrypto` and `vector`.
2. Use the **transaction-mode pooler URI** with `?sslmode=require` (the pool config sets no SSL itself; RLS relies on `SET LOCAL app.current_tenant_id`, which is transaction-scoped and pooler-safe).
3. Connect as **`app_user`, never `postgres`** — superusers bypass RLS.
4. Migrations: `DATABASE_URL=... pnpm --filter @cognitia/db migrate`. The runner keeps a `schema_migrations` ledger and skips applied files; for a pre-ledger database run once with `--baseline` first.

## 2. API (container host — Railway/Fly/Render)

- Build: `docker build -f apps/api/Dockerfile .` from the repo root. The image bundles the server with esbuild (`pnpm --filter @cognitia/api build:server`) — the only verified boot path; see the Dockerfile header for why tsc and strip-types both fail today.
- The container entrypoint runs `scripts/assert-prod-env.mjs` first: missing `DATABASE_URL` or `SESSION_SECRET` **fails the boot** instead of silently degrading to the in-memory repository. `REQUIRE_ENV=off` permits a degraded staging boot.
- Set env: see table below. `PORT` is honored (PaaS-injected) with `API_PORT` as override.
- The host must preserve `x-forwarded-proto`/`x-forwarded-host` — HubSpot webhook HMAC verification reconstructs the URI from them.
- Post-deploy gate: `BASE_URL=https://<api-host> node apps/api/scripts/smoke-deploy.mjs` (mint tokens with `scripts/issue-session.mjs`).

## 3. Web (Vercel)

- Root Directory: `apps/web`, with "Include files outside root" ON (workspace deps).
- Install: `pnpm install --frozen-lockfile` at repo root; build `pnpm --filter @cognitia/web build`.
- **`NEXT_PUBLIC_API_URL` must be set in the BUILD environment** — it is inlined into the client bundle by 12 pages; unset, production silently calls `http://localhost:3001`.

## 4. Scheduler

Hourly `POST https://<api-host>/jobs/crm-sync` per the `crm-sync-schedule` contract (`packages/workflows`). Currently a stub returning 202; keep the schedule wired so turning the job on is config, not a deploy.

## 5. Environment variables

| Var                                               | Where         | Required                 | Notes                                                                               |
| ------------------------------------------------- | ------------- | ------------------------ | ----------------------------------------------------------------------------------- |
| `DATABASE_URL`                                    | api           | **yes** (guard-enforced) | Pooler URI + `sslmode=require`. Absent → in-memory fallback (now blocked by guard). |
| `SESSION_SECRET`                                  | api           | **yes** (guard-enforced) | HMAC for operator sessions. Absent → all operator routes 401.                       |
| `CREDENTIAL_SECRET_KEY_BASE64`                    | api           | for live CRM             | 32-byte base64; absent → fake HubSpot client (warn).                                |
| `COGNITIA_PII_KEY_BASE64`                         | api           | for front-desk           | 32-byte base64; absent → ephemeral key, PII unreadable after restart.               |
| `HUBSPOT_WEBHOOK_SECRET`                          | api           | for CRM ingest           | Absent → webhook 503.                                                               |
| `PORT` / `API_PORT`                               | api           | no (3001)                | PaaS-injected / explicit override.                                                  |
| `COGNITIA_PUBLIC_TENANT_ID`                       | api           | no                       | UUID feeding `GET /public/trust-feed`.                                              |
| `COGNITIA_PUBLIC_FEED_RATE_LIMIT` / `_WINDOW_SEC` | api           | no (60/60)               | Public feed rate limit.                                                             |
| `NEXT_PUBLIC_API_URL`                             | web **build** | **yes**                  | Inlined at build time.                                                              |
| `REQUIRE_ENV`                                     | api           | no                       | `off` = permit degraded boot (staging only).                                        |

Known-drifted: `.env.example` lists `SUPABASE_*`, `WORKER_CONCURRENCY`, `NODE_ENV`, `LOG_LEVEL`, `SLACK_*`, `ANTHROPIC_API_KEY` — none are read by any code today.

## 6. Verified in this change

- `next build` compiles clean with `@cognitia/core` as a declared workspace dep + `transpilePackages` (first successful web build).
- The esbuild bundle boots and passes: `/health` → `{"db":"up"}`, unauthed `/accounts` → 401, `POST /webhooks/email` → 404 (email fence). CI now enforces all three on every push.
- The migration runner is idempotent via `schema_migrations`.
