# Operationalize the hardened baseline

Turns the code-level alpha hardening (commit `85b5be5`) into a running, evidenced
deployment. **These steps run in your infrastructure — they cannot be performed
from CI.** Each step says who runs it. The code-side guards described here are
already merged and tested; this runbook is how you switch them on.

## 0. What the code already enforces (no action)

- The API **refuses to boot in production** under a superuser / BYPASSRLS DB role
  (`packages/db/src/rlsGuard.ts`, wired in `buildHandlersFromEnv`).
- In production it **requires** `DATABASE_URL`, a 32-byte `CREDENTIAL_SECRET_KEY_BASE64`,
  and a session verifier — it will not silently run the in-memory repo or the fake
  HubSpot client (`apps/api/src/server.ts`, `apps/api/src/secrets.ts`).
- "Production" = `DEPLOY_ENV=production` (or `NODE_ENV=production`).

## 1. Provision the least-privilege DB role — Operator/Infra

Run migrations **as a superuser**, then drop to the app role:

```sql
-- as superuser, after migrations:
\i deploy/roles/app_user.sql           -- idempotent; tested in kysely.rls.pglite.test.ts
alter role app_user password '<from-secret-manager>';   -- never in source
```

Point the API **and** worker connection pools at `app_user`. Reserve the
superuser strictly for migrations.
**Verify:** `select current_user, current_setting('is_superuser');` → `app_user`, `off`.
(The boot guard asserts this automatically in production.)

## 2. Secret custody (KMS/Vault) — Infra

The code reads secrets through a `SecretSource` seam (`apps/api/src/secrets.ts`);
env is the default. For real custody, deliver these from a secret manager
(injected env or mounted files), never the platform dashboard in plaintext:

- `SESSION_SECRET` (≥32 chars), `CREDENTIAL_SECRET_KEY_BASE64` (32-byte AES key),
  `HUBSPOT_WEBHOOK_SECRET`.
  Rotation per `secret-rotation.md` (<90d). Wrong-size/weak material fails closed at
  boot. _A KMS/Vault-backed `SecretSource` adapter is the small follow-up that makes
  custody first-class; the seam is ready for it._

## 3. First live HubSpot round-trip + trust packet — Operator

Follow `hubspot-onboarding.md` (private app, least-priv scopes, `cognitia_idempotency_key`

- `cognitia_*` provenance properties) and `deploy-verification.md` (9 checks).
  Then run one governed loop on a sandbox portal:
  `run Mira → approve → execute → GET /audit export + the trust packet`. Archive the
  trust packet as the first point-in-time evidence artifact. **No real CRM write has
  happened until this step.**

## 4. AUTH-3 live IdP binding — Blocked on pilot IdP choice

Build only after the pilot customer's IdP is chosen (Okta / Entra). Scope +
acceptance in `docs/launch/tickets/AUTH-3-live-idp-bindings.md`. AUTH-2's control
logic (tenant isolation, fail-closed mapping, access-review) is already live.

## Done-when

- Boot under `app_user` with `DEPLOY_ENV=production` (the API starts → role guard passed).
- Secrets sourced from the manager; rotation recorded.
- One trust packet archived from a live round-trip.
- `deploy-verification.md` all-green; `GET /integrations/readiness` → READY.

See `docs/security/GTM_SELF_AUDIT_2026-06.md` for the authoritative open-item list.
