# V1 Acceptance Test Plan

> The tests that must be GREEN to pass each go-live gate. Every requirement maps to an
> existing test or a named gap. **No acceptance item depends on email/send/replies.**
> Anchored to HEAD `ea7677e`. Legend: ✅ exists · 🟫 partial · ⛔ to build.

## 1. Tenant isolation (Gate 0 — hard)

| #     | Requirement                                                                         | Proof                                                                                                       | Status     |
| ----- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------- |
| ISO-1 | Tenant A cannot read/mutate Tenant B (repository layer)                             | `repository.contract.ts` (run on in-memory + KyselyRepository/PGlite)                                       | ✅         |
| ISO-2 | RLS blocks cross-tenant under a **non-superuser** role (engine, not just predicate) | `kysely.rls.pglite.test.ts` (superuser sees 2, app_user sees 1; UPDATE 0 rows; INSERT WITH CHECK violation) | ✅         |
| ISO-3 | No tenant-context leak across pooled transactions                                   | `client.test.ts` (every context stmt is `SET LOCAL`)                                                        | ✅         |
| ISO-4 | **Auth-derived tenant** — forged `x-tenant-id` cannot change scope                  | **API-1 auth test**                                                                                         | ⛔ (API-1) |

## 2. Idempotency / no-duplication (Gate 0/1 — hard)

| #     | Requirement                                                    | Proof                                                                | Status                                     |
| ----- | -------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------ |
| IDM-1 | Duplicate ingest doesn't duplicate rows (external_object_maps) | `repository.contract.ts`, `sync.test.ts`                             | ✅                                         |
| IDM-2 | Re-executed action doesn't double-write (ledger + adapter)     | `actionLedger` + `email/adapter.test.ts` pattern; **CRM** equivalent | 🟫 (extend to HubSpot create in CRM-1 e2e) |
| IDM-3 | Approved CRM task executes exactly once against HubSpot        | **CRM-1 e2e** (mocked HTTP)                                          | ⛔ (CRM-1)                                 |

## 3. Approval / audit trail (Gate 1 — hard)

| #     | Requirement                                             | Proof                                             | Status     |
| ----- | ------------------------------------------------------- | ------------------------------------------------- | ---------- |
| APR-1 | Execute refused unless approved (409)                   | `handlers.test.ts` (execute-before-approve → 409) | ✅         |
| APR-2 | Side-effect tools can't bypass the ledger               | agents ledger/tool-registry tests                 | ✅         |
| APR-3 | Every transition emits an immutable event + audit_event | events/ledger tests                               | ✅         |
| APR-4 | Per-contact audit export (propose→approve→execute)      | **SEC-2 export test**                             | ⛔ (SEC-2) |
| APR-5 | RBAC: viewer cannot approve/execute                     | **API-1 RBAC test**                               | ⛔ (API-1) |

## 4. Scope-fence guards in CODE (Gate 1 — hard, governance)

| #     | Requirement                                                                       | Proof                                                               | Status                                    |
| ----- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------- |
| FEN-1 | No `/webhooks/email` route exists/enabled                                         | route absence test (assert 404)                                     | 🟫 (route absent; add explicit assertion) |
| FEN-2 | **No executable email path** in the prod composition (email adapter unregistered) | **new test**: prod `AdapterRegistry` has no `email` handler         | ⛔ (see review-log B-1)                   |
| FEN-3 | Mira proposes **only `crm.*`** action types in V1 mode                            | **new test**: a Mira run yields no `email.draft.send` under V1 flag | ⛔ (B-1)                                  |

## 5. Security invariants (Gate 0)

| #     | Requirement                                 | Proof                                           | Status |
| ----- | ------------------------------------------- | ----------------------------------------------- | ------ |
| SEC-1 | No raw PII/tokens in logs                   | `logging.test.ts` + token-provider no-leak test | ✅     |
| SEC-2 | Secrets encrypted at rest (ciphertext only) | `tokenProvider.test.ts` (AES-GCM at rest)       | ✅     |
| SEC-3 | Webhook (HubSpot ingest) fails closed       | `webhookHubspot.test.ts` + `webhook.test.ts`    | ✅     |

## 6. Operational (Gate 1)

| #     | Requirement                                                    | Proof                                                      | Status                                                          |
| ----- | -------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------- |
| OPS-1 | Kill switch halts execution (`status='paused'`)                | **new test**: token provider rejects non-active connection | 🟫 (provider already rejects non-active; add execute-path test) |
| OPS-2 | `/health` reflects DB state                                    | **API-1 health test**                                      | ⛔ (API-1)                                                      |
| OPS-3 | CRM push failure → `failed` + `crm.push.failed.v1`, no partial | **CRM-1/CRM-2 failure test**                               | ⛔                                                              |

## Release gates (promote to required CI checks)

- **Gate 0 merge gate:** ISO-1..3, IDM-1, APR-1..3, SEC-1..3 (all ✅ today) — make them **required checks**.
- **Gate 1 go-live gate:** ISO-4, IDM-2/3, APR-4/5, FEN-1..3, OPS-1..3 — the V1 build-out.

## Current pass state (informational)

At `ea7677e`: **124 tests green** (21 files). The ✅ rows above are already covered; the ⛔/🟫 rows are the V1 build-out tracked in API-1 / CRM-1 / UI-1 / SEC-2 and the FEN-\* fence guards.
