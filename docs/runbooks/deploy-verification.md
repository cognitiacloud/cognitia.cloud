# Runbook — Deploy verification (post-deploy smoke)

> Run after every deploy to a real environment, BEFORE connecting customer data.
> Supports Go-Live Gate 0/1 and SOC 2 change-management evidence. No live email in V1.

## Required environment (fail closed if missing)

| Var                            | Purpose                                                | Missing behavior                                                       |
| ------------------------------ | ------------------------------------------------------ | ---------------------------------------------------------------------- |
| `DATABASE_URL`                 | Postgres (app_user role)                               | API uses in-memory (NOT production)                                    |
| `SESSION_SECRET`               | operator session HMAC                                  | operator routes return 401 (fail closed)                               |
| `HUBSPOT_WEBHOOK_SECRET`       | HubSpot ingest signature                               | webhook fails closed                                                   |
| `CREDENTIAL_SECRET_KEY_BASE64` | 32-byte base64 AES key (KMS) for credential decryption | CRM client falls back to FAKE + logs `crm.hubspot.client_unconfigured` |

## Automated smoke (ALPHA-1 — run this first)

```
BASE_URL=https://api.example.com \
OPERATOR_TOKEN=$(SESSION_SECRET=… node apps/api/scripts/issue-session.mjs --tenant <uuid> --role operator) \
VIEWER_TOKEN=$(SESSION_SECRET=… node apps/api/scripts/issue-session.mjs --tenant <uuid> --role viewer) \
node apps/api/scripts/smoke-deploy.mjs
```

Automates checks **1, 3, 4, 5, 7 (fence), and 9 (kill-switch surface)** below, plus the
go-live readiness gate (reported as WARN when the portal isn't configured yet — a valid
pre-setup state). Exits non-zero on any required failure, so it can gate a deploy
pipeline. Tokens are optional: without them the unauthed checks still run and the authed
ones are reported `SKIP` (never a silent pass). Tested in
`apps/api/src/smokeDeploy.test.ts` (healthy pass, each guard failure, dead deploy).
Checks 2, 6, and 8 remain manual below.

## Smoke checks (in order)

1. **Process up:** container healthy; `GET /health` → `200 {"db":"up"}`. (If `503`, DB unreachable — stop.)
2. **App role:** confirm the DB connection user is `app_user` (non-superuser), not `postgres`/`service_role`. `select current_user;` via the app path.
3. **Auth fail-closed:** `GET /accounts` with no `Authorization` → `401`. With a forged `x-tenant-id` and no session → `401`.
4. **Auth works:** issue a session (operator) and `GET /accounts` → `200`.
5. **RBAC:** a `viewer` session on `POST /agent-runs/mira` → `403`.
6. **Tenant isolation:** session for tenant A + spoofed `x-tenant-id: B` → data scoped to A only (B sees nothing).
7. **Fence holds:** `POST /webhooks/email` → `404`. `GET /agent-actions?status=proposed` after a Mira run → only `crm.*` action types (no `email.draft.send`).
8. **CRM client mode:** check logs for `crm.hubspot.client_unconfigured`. If present, the **fake** client is active — DO NOT call this a live CRM deploy; set `CREDENTIAL_SECRET_KEY_BASE64` and a seeded credential first.
9. **Kill switch:** with a paused connection (`integration_connections.status='paused'`), an execute attempt does not write to HubSpot.

## Pass criteria

All 9 checks pass. Any failure on 1–7 blocks go-live; failure on 8 means "fake mode" (acceptable for a dry-run demo only, never for live customer CRM).

## Evidence to capture (SOC 2 — change management)

- Deploy id / commit hash + timestamp.
- `/health` 200 screenshot; auth 401/403 responses; fence 404.
- Confirmation of `app_user` role and CRM client mode (real vs fake).
