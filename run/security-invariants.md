# Security invariants & untrusted-input flow review (GTM lane)

Authoritative list of the security invariants the system must preserve, plus the
Item-2 trace of every untrusted-input → sink flow. Each invariant maps to an
executable test (so it can't silently weaken) or a structural control.

## Core invariants (must never regress)

| #   | Invariant                                                                           | Enforced by                                    | Test                                                       |
| --- | ----------------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------- |
| I1  | Tenant comes from the verified session, never `x-tenant-id` on operator routes      | `server.ts` sendAuthed/toReq                   | `serverAuth.test.ts`, `securityInvariants.guard.test.ts`   |
| I2  | RLS enforced under a non-superuser role (incl. audit/passport/grant tables)         | `deploy/roles/app_user.sql` + policies         | `kysely.rls.pglite.test.ts`                                |
| I3  | No side effect without explicit human approval (409 otherwise)                      | `actionLedger.execute`                         | `crmExecute.test.ts`, `security.regression.test.ts`        |
| I4  | RBAC: owner-only privileged ops; viewers cannot mutate                              | `requireOwner`/`requireMutatingRole`           | `security.regression.test.ts` (authz matrix)               |
| I5  | Audit chain is append-only + tamper-evident (mutation/truncation detected)          | `auditChain.ts`, RLS no UPDATE/DELETE          | `security.regression.test.ts`, `kysely.rls.pglite.test.ts` |
| I6  | No raw PII/secret in logs or stored errors                                          | `logging.ts` redact+scrub, `sanitizeErrorText` | `logging.test.ts`, `logSafety.guard.test.ts`               |
| I7  | Rate limiting actually applies to every route (429); `/health` exempt               | `server.ts` (deferred route register)          | `security.regression.test.ts`                              |
| I8  | Fail-closed startup: prod refuses superuser DB role / missing secrets / fake client | `rlsGuard.ts`, `secrets.ts`, `server.ts`       | `rlsGuard.pglite.test.ts`, `secrets.test.ts`               |
| I9  | DSAR erasure removes PII but preserves the audit chain                              | `dsar.ts`, `anonymizeContact`                  | `dsar.test.ts`                                             |
| I10 | Anchoring is honestly labelled mechanism-only (default sink not tamper-proof)       | `anchoring.ts` docs                            | `anchoring.test.ts`                                        |

## Untrusted-input → sink flow trace (Item 2)

| Source                   | Entry                        | Validation / sanitization                                                                         | Sinks reached                                | Verdict                                           |
| ------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------- |
| Operator API body        | `app.post(...)` → handlers   | **zod safeParse** on every body (mira/approve/reject/batch/passport/grant); 400 on invalid        | repo (typed rows), events, audit (refs only) | OK                                                |
| Operator identity        | `Authorization: Bearer`      | session verifier → `{tenantId,userRef,role}`; `x-tenant-id` ignored                               | tenant scope, audit actor                    | OK (I1)                                           |
| HubSpot webhook          | `/webhooks/hubspot`          | **HMAC signature** gate first, then `hubspotContactWebhook` zod; **emailHash only, no raw email** | contact ingest (hashed)                      | OK                                                |
| CRM sync (HubSpot read)  | worker `HubspotSyncService`  | hashed at ingest; events carry refs/external_ids only                                             | accounts/contacts/opps, events               | OK (no raw PII in events)                         |
| Adapter/3rd-party errors | `actionLedger.execute` catch | **`sanitizeErrorText`** (redacts email/bearer/long-blobs, bounded) before storing                 | `agent_actions.result` (jsonb)               | OK (hardened)                                     |
| Unhandled server errors  | `server.ts onError`          | **generic 500 to client**, full error logged server-side redacted (Item 2 fix)                    | client response / logs                       | OK (hardened — previously leaked `err.message`)   |
| Logs (any)               | `log()`                      | redact: key allowlist + **value scrub** of free-text (email/bearer/blob)                          | stdout/log aggregation                       | OK (I6)                                           |
| Prompts / generation     | Mira message generator       | **deterministic template** in v1 (no LLM) — no prompt-injection sink                              | CRM write payloads (typed)                   | OK (no LLM in v1; re-review when an LLM is added) |
| Tool calls (CRM write)   | HubSpot adapter              | payload derived from the **typed action row** (`engagementContent`); idempotency key              | HubSpot API                                  | OK (preview==write)                               |
| Exports (DSAR/audit)     | owner-only handlers          | owner-gated + access audited; contact PII included by design (subject's own data)                 | export JSON                                  | OK (least-privilege)                              |

## Findings & actions (Item 2)

- **F1 (fixed this session):** the generic 500 handler returned `err.message` to
  the client — could leak third-party/internal text. Now returns a generic
  `"internal error"` and logs the redacted error server-side.
- **F2 (fixed earlier):** adapter errors were stored raw in `agent_actions.result`
  → now `sanitizeErrorText`.
- **F3 (fixed earlier):** free-text log fields weren't value-scrubbed → now scrubbed.
- **No unsanitized untrusted-input→sink flow remains in the GTM lane** as of this
  review. Re-run this trace whenever a new route, adapter, export, or (notably) an
  LLM prompt path is added.

## Honest residuals (NOT closed by code here)

- Rate-limit store is in-memory per instance → multi-instance needs a shared
  (Redis) store; documented in `server.ts` / `ci-hardening.md`.
- Audit-chain external anchoring is a **mechanism only**; real tamper-proofing
  needs an external durable sink (infra).
- KMS custody, branch protection, app_user-at-deploy, AUTH-3 IdP rollout remain
  infra/ops/decisions — tracked in `docs/security/GTM_SELF_AUDIT_2026-06.md`.
