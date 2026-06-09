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
