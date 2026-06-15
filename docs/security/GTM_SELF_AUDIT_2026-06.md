# GTM Self-Audit — 2026-06 (formal)

**Branch:** `claude/gtm-platform-mvp-setup-vYLBG` · **HEAD:** `17a93ac` · **Date:** 2026-06-14
**Gate at audit time:** `pnpm check` green — **399 tests, 64 files** (verified this cycle).
**Method:** read-only evidence sweep (promises/gates, ticket→impl→test, security
internals), with the load-bearing claims re-verified by hand. Every finding is
anchored to `file:line`. Severity is the auditor's estimate, not a customer's.

This supersedes the stale status in `docs/launch/go-live-checklist.md` (dated
2026-06-09) where noted — SEC-2 and AUTH-2 shipped after that snapshot.

---

## Part 1 — Traceability matrix (promise/ticket/guarantee → reality)

Verdict key: **DONE** (impl+test) · **DEPLOY** (code done, needs infra/ops
evidence) · **SEAM** (documented, not implemented — deliberate) · **GAP**
(claimed/expected but missing) · **DOC-DRIFT** (doc disagrees with code).

### A. §5 backlog tickets

| Ticket | Acceptance                                                                                 | Impl (file)                                                                                                        | Test                                                                                   | Verdict                                                                     |
| ------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| API-1  | auth-derived tenant; forged `x-tenant-id` ignored; RBAC; `/health` DB ping; Kysely in prod | `server.ts:95-122` sendAuthed; `handlers.ts:143-149` requireMutatingRole; `server.ts:284-337` buildHandlersFromEnv | `serverAuth.test.ts:59-89`, `handlers.test.ts:194-214`, `lifecycle.acceptance.test.ts` | **DONE**                                                                    |
| CRM-1  | one idempotent HubSpot write; per-tenant encrypted token; 409 unapproved; kill switch      | `hubspot/adapter.ts`, `hubspot/tokenProvider.ts`, `server.ts:313-326`                                              | `crmExecute.test.ts`, `tokenProvider.test.ts`, `killSwitch.test.ts`                    | **DONE (code)** — live creds = DEPLOY (B-3)                                 |
| UI-1   | approval console; execute disabled until approved; CRM-only                                | `apps/web/src/app/approvals/page.tsx`                                                                              | `approvalQueue.test.ts`, `approvals/a11y.test.tsx`, `fence.test.ts`                    | **DONE**                                                                    |
| OBS-1  | `*.failed.v1`/sync dashboards; worker heartbeat; PII-safe log CI gate                      | `opsOverview.ts`, `worker/src/heartbeat.ts`, `logSafety.guard.test.ts`                                             | `opsOverview.test.ts`, `worker/src/jobs/crmSync.test.ts`                               | **DONE**                                                                    |
| SEC-2  | per-contact export + integrity proof + audited; retention status                           | `auditExport.ts`; `handlers.ts` exportContactAudit/auditRetention                                                  | `auditExport.test.ts` (11)                                                             | **DONE** (checklist still says 🔴 → **DOC-DRIFT**)                          |
| CRM-2  | signal→approval-gated stage write-back; one write; `crm.push.failed.v1`; rollback          | `stageReview.ts`, `hubspot/adapter.ts`, `actionLedger.ts`                                                          | `crmStage.test.ts` (8)                                                                 | **DONE**                                                                    |
| AUTH-2 | tenant-scoped SAML+OIDC; group→role fail-closed; access-review export                      | `sso.ts`, `accessReview.ts`                                                                                        | `sso.test.ts` (11), `accessReview.test.ts` (7)                                         | **DONE** (checklist says 🔴 → **DOC-DRIFT**); wire bindings = SEAM (AUTH-3) |
| AUTH-3 | OIDC JWKS rotation; SAML XML-DSig; SSO config CRUD; SCIM                                   | —                                                                                                                  | —                                                                                      | **SEAM** (pilot-gated, tracked)                                             |

### B. §7 publishable differentiation claims

| Claim                                         | Proof artifact                                            | Verdict                                      |
| --------------------------------------------- | --------------------------------------------------------- | -------------------------------------------- |
| Provable tenant isolation, tested every build | `kysely.rls.pglite.test.ts` (real `app_user nosuperuser`) | **DONE for migrations 0001–0004**; see GAP-1 |
| Every action auditable end-to-end             | SEC-2 per-contact export + `GET /audit`                   | **DONE**                                     |
| Zero-duplication guarantee                    | ledger dual-guard + adapter idempotency                   | **DONE** (`crmExecute.test.ts`)              |
| Human-approved by default                     | 409-on-unapproved + RBAC                                  | **DONE** (`actionLedger.ts:179`)             |
| Transparent pricing                           | pricing page                                              | **GAP** (not built; Gate 3)                  |

### C. Documented-but-not-fully-implemented (the flagged set)

| #   | Item                               | Location                                                 | Nature                                                                                                                                                                   |
| --- | ---------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S-1 | OIDC JWKS rotation + SAML XML-DSig | `sso.ts:114-150` `verifyAssertion`                       | SEAM — RS256 compact-assertion stand-in; real wire bindings deferred to AUTH-3 (pilot-gated). Control logic (sig/iss/aud/time/role/fail-closed) IS implemented + tested. |
| S-2 | SSO config persistence + CRUD      | `sso.ts:68-86` InMemorySsoConfigStore                    | SEAM — in-memory only; no route to register a tenant IdP; encrypted-store seam documented.                                                                               |
| S-3 | HubSpot OAuth `provider.ts`        | `hubspot/provider.ts` connect/sync/read/write            | STUB throwing `not implemented` — **dead path**; prod uses `HttpHubspotClient`, not this. Recommend deleting to avoid confusion.                                         |
| S-4 | inbound-lead + crm-sync webhooks   | `handlers.ts` (~996-1001)                                | Honest **501** n8n seams (not fake success).                                                                                                                             |
| S-5 | worker scheduler                   | `worker/src/index.ts:17-19` empty `jobs[]`               | Scaffold — crm-sync runs via external n8n trigger, not an in-process scheduler.                                                                                          |
| S-6 | brand-voice / spamminess evals     | `agents/guardrails/index.ts:77`, `evals/src/index.ts:66` | Placeholder/TODO — eval signals, not controls; non-blocking for V1.                                                                                                      |
| S-7 | email adapter                      | `integrations/src/email/adapter.ts`                      | Stub, **fenced out** of v1 registry (FEN-2 test). Correct.                                                                                                               |

---

## Part 2 — Security review (7 areas)

### 1. Auth / session

**Strong:** algorithm pinning (HMAC SHA256 `auth.ts:59`; SSO hard-rejects non-RS256 `sso.ts:132`), `timingSafeEqual`, fail-closed role enum + expiry, issuer-peek-then-verify-against-that-tenant's-key (`sso.ts:194-211`) so a re-labelled issuer fails signature.
**Weaknesses:**

- **[HIGH] HMAC session is a production stand-in** with no rotation seam (`auth.ts:44-50`, `server.ts:350`). A leaked `SESSION_SECRET` forges every operator session; rotating it invalidates all tokens at once. Acceptable for alpha; must be retired for SSO + a rotation story before paid.
- **[MED] No revocation / replay defense** — stateless tokens (no `jti`/nonce) are valid until expiry; a stolen token can't be revoked (`auth.ts:24-29`). Mitigate with short TTL + TLS now; real revocation later.
- **[LOW] No clock-skew tolerance** on SSO `nbf`/`exp` (`sso.ts:218-220`); fine with NTP, may need ±30s in prod.

### 2. Secret handling

**Strong:** tokens encrypted at rest AES-256-GCM (IV.tag.ct), `integration_connections` stores only a `credential_ref`, refresh re-persists ciphertext, token logs are refs-only.
**Weaknesses:**

- **[HIGH] AES data key + `SESSION_SECRET` arrive as plain env vars** (`server.ts:317-321`, `tokenProvider.ts:58-64`). Base64 is not encryption. Production must source these from KMS/Vault. (R-3 in the risk register; matches operating-plan §6 "secrets in KMS".)
- **[MED] Silent fallback to the in-memory fake client** when `CREDENTIAL_SECRET_KEY_BASE64` is absent (`server.ts:327-332`) — a misconfigured prod deploy would _appear_ to run but never make real CRM writes. It logs a warn; should arguably fail closed in a "prod" mode.
- **[LOW] No audit event on credential rotation** (`tokenProvider.ts:244-246`) — only a generic log line.

### 3. Logging / PII

**Strong:** `redactLog` (`logging.ts:48-59`) is a **strict allowlist** of flat scalar keys + forbidden-substring drop; `detail`/nested objects are dropped entirely (so no structural nested-PII leak — the agent's "detail.email escapes" was **incorrect**). `logSafety.guard.test.ts` fails CI on any raw `console.*`.
**Weaknesses:**

- **[MED] Free-text values are not inspected.** `message` and `entity_ref` are allowlisted strings; a developer interpolating raw PII/secret into `message` would pass redaction (it filters key _names_, not values). Developer-discipline gap, not structural.
- **[MED] Raw error string stored in the DB.** `actionLedger.ts:277` writes `result: { error: String(err) }` into `agent_actions.result` (jsonb). A thrown adapter/library error could carry HTTP diagnostic text. The HubSpot token never appears in client errors, so token leakage is unlikely, but **sanitize-before-store** is the right fix.
- **[LOW] 500 handler returns `err.message`** (`server.ts` onError) — controlled errors today, but an uncaught library error could surface internals. Prefer a generic 500 + internal log.

### 4. Approval gates

**Strong, no execution-without-approval path found.** `execute()` refuses non-approved (409, `actionLedger.ts:179`), refuses re-exec of `rolled_back` (`:198-216`), passport+grant is the single authz chokepoint re-checked at execution time (`:242-263`), dual-layer idempotency (unique `(tenant_id, idempotency_key)` + pre-insert lookup). Denials are themselves audited. TOCTOU between fetch and gate is within one transaction (READ COMMITTED) → not practical. **Verdict: sound.**

### 5. Rollback / unpublish

**Strong:** stage rollback encodes the prior stage in the `external_ref` (`hubspot:deal_stage:<id>:<prior>`), engagement archive is idempotent, rollback respects the kill switch, rolled-back actions can't silently re-execute.
**Weakness:** **[MED] blind restore** — if the deal stage was changed externally after execution, rollback restores the _recorded_ prior stage without checking the current one (`adapter.ts` stage-undo, `actionLedger.ts` rollback). Consider verifying current==to_stage before restoring.

### 6. Tenant isolation

**Strong:** RLS `force`d with `using/with check (app_bypass_rls() or tenant_id = app_current_tenant_id())`; `withTenant` sets transaction-scoped `SET LOCAL`; **proven under a real non-superuser `app_user` role** in `kysely.rls.pglite.test.ts` (with a control assertion that superuser sees 2 tenants, app_user fewer). Operator routes take tenant only from the verified principal.
**Weaknesses:**

- **[HIGH — deployment] No runtime guard that the app pool is non-superuser.** RLS is bypassed under a superuser connection; nothing in code asserts `current_user = app_user` at boot. The SOC docs call for this check; it is **not implemented**. (R-1.)
- **[GAP-1 / MED] RLS proven only for migrations 0001–0004.** `audit_events` (0009) and `agent_passports`/`scope_grants` (0010) carry `force row level security` + policies but are **not exercised under `app_user`** in CI (the RLS harness `MIGRATIONS` array stops at 0004). Proven-by-pattern, not by test.
- **[MED] `app_bypass_rls()` escape hatch** exists (`client.ts`, 0001) — defaults off and unused in request paths, but a future `withTenant(..,{bypassRls:true})` in a handler would silently break isolation. No lint/guard.
- **[MED] Webhook tenant via `x-tenant-id`** (`server.ts:56`) is safe _only because_ `webhookHubspot` verifies the HMAC signature first (`handlers.ts`). The control is sequential, not structural — a refactor that reorders it reintroduces cross-tenant access.

### 7. Audit evidence

**Strong:** per-tenant hash chain (`auditChain.ts`), `prev_hash`/`hash` computed by the repo on every insert, linearized by a unique `(tenant_id, prev_hash)` index, `verifyAuditChain` fails closed on unchained/forked/mismatch/broken-link, timestamp canonicalization avoids false positives. SEC-2 exports embed a live verification.
**Weaknesses:**

- **[MED] Tamper-EVIDENT, not tamper-PROOF** (stated honestly, `auditChain.ts:5`, `0009:8`). A DB superuser can rewrite a row _and_ recompute its hash forward undetected; external anchoring is unbuilt future work. SOC-relevant for break-glass control, not a runtime attack.
- **[LOW/MED] No test pins audit tables as insert-only.** Policies today are select+insert; a future migration adding an UPDATE/DELETE policy to `audit_events` would silently make the chain mutable. Add a guard test.
- **[LOW] Verification is on-demand only** — corruption persists until `GET /audit/verify` is called; a periodic background verify would catch it sooner.

---

## Part 3 — Red-team pre-mortem (how launch fails) + minimum fixes

> Framing: a **design-partner alpha** (1 partner, CRM-only) is far closer than a
> **paid GA**. Failures below are grouped by which rollout they block.

### Scenario A — "It looked deployed but isolation was off"

A prod deploy connects with a superuser/`service_role` DB user (common default on
managed Postgres). RLS is silently bypassed; the first multi-tenant onboarding
leaks tenant A's CRM data into tenant B's queries. The RLS _test_ was green the
whole time — it ran under `app_user`; prod didn't.

- **Blocker:** no runtime assertion that the app runs as a non-superuser role.
- **Min fix:** boot-time `SELECT current_user` / probe check that **refuses to start** unless the role is non-superuser _and_ a `SELECT` against a 2-tenant fixture returns only the current tenant; make it a deploy smoke step. (Closes R-1; ~0.5 day.)

### Scenario B — "Secrets in the clear"

`CREDENTIAL_SECRET_KEY_BASE64` / `SESSION_SECRET` live as plain env vars in the
platform dashboard. One screenshot, one leaked CI log, or one over-broad IAM role
exposes every tenant's HubSpot token (key) or lets anyone forge operator sessions.

- **Blocker:** no KMS/Vault sourcing; base64 ≠ encryption.
- **Min fix:** source both from a secret manager at boot; document rotation; add a credential-rotation audit event. (Closes R-3; ~1 day + infra.)

### Scenario C — "Configured wrong, ran fake"

Prod is missing `CREDENTIAL_SECRET_KEY_BASE64`; the system falls back to the
in-memory fake HubSpot client and **silently performs no real writes** while the UI
shows success. The partner thinks tasks were created; nothing reached HubSpot.

- **Blocker:** silent fake-client fallback in a prod context (`server.ts:327-332`).
- **Min fix:** a `DEPLOY_ENV=production` that makes a missing key / fake client a **hard boot failure**; surface client identity on `/health`. (~0.5 day.)

### Scenario D — "No live round-trip has ever happened"

Every CRM guarantee (idempotency, provenance stamps, one-object-per-action) is
proven against the fake client. The very first _real_ HubSpot call hits an unforeseen
API shape (custom required property, rate limit, stage-id mismatch) during the
partner demo.

- **Blocker:** zero live HubSpot executions to date (B-3); HubSpot portal prep is operator-pending.
- **Min fix:** run the 12-step operator handoff once on a sandbox portal; capture the trust packet as first evidence **before** the partner session. (~0.5 day once creds exist.)

### Scenario E — "Audit RLS wasn't actually tested where it matters"

A determined tenant (or a bug) reads another tenant's `audit_events`/`scope_grants`.
Those tables have policies but were never exercised under `app_user` in CI (GAP-1),
so a policy typo on the newer tables wouldn't have been caught.

- **Blocker:** RLS harness covers only migrations 0001–0004.
- **Min fix:** extend `kysely.rls.pglite.test.ts` MIGRATIONS to 0009/0010 and assert cross-tenant read/write denial on `audit_events`, `agent_passports`, `scope_grants`; add a guard test that audit tables expose no UPDATE/DELETE policy. (~0.5 day.)

### Scenario F — "Process gaps fail the SOC review" (paid-GA only)

Branch protection is **off** (a direct push to the release branch would succeed
today), no SAST/dependency scan, no coverage floor, no incident/restore **drill
records**, no signed DPAs, pgBouncer `SET LOCAL` unproven on pooled infra (R-2),
no published pricing, no retention/deletion path.

- **Blockers:** settings/process/infra, not code.
- **Min fixes:** enable branch protection + required `build-test` check (today, ~0.1 day); add `pnpm audit` + SAST + coverage to CI; run one IR table-top + one restore drill and file artifacts; validate `SET LOCAL` on real pooled Postgres; sign DPAs; ship a pricing page; write+script retention/deletion.

### Scenario G — "A logged/stored string leaked PII" (low-likelihood)

A developer interpolates a raw email into a `log({message})` or an adapter error
carrying diagnostic text lands in `agent_actions.result`.

- **Min fix:** sanitize error before storing (`actionLedger.ts:277`); add a lint/test discouraging value interpolation into `message`; (optional) value-level scrub for `message`/`entity_ref`.

---

## Blockers ledger (exact, ranked)

**Must-fix before the DESIGN-PARTNER ALPHA (mostly deploy/ops, small code):**

1. **[HIGH/code]** Boot guard: refuse to start unless DB role is non-superuser + isolation probe passes. _(Scenario A)_
2. **[HIGH/infra]** KMS/Vault for `CREDENTIAL_SECRET_KEY_BASE64` + `SESSION_SECRET`. _(B)_
3. **[HIGH/code]** Fail-closed in production on missing credential key / fake client. _(C)_
4. **[HIGH/ops]** One real HubSpot round-trip on a sandbox + trust-packet evidence. _(D, B-3)_
5. **[MED/code]** Extend RLS test to 0009/0010 + audit-tables-are-append-only guard. _(E, GAP-1)_
6. **[MED/code]** Sanitize stored error strings (`actionLedger.ts:277`). _(G)_
7. **[LOW/settings]** Enable branch protection + required checks (closable today). _(F)_
8. **[housekeeping]** Delete the dead `hubspot/provider.ts` stub (S-3); refresh `go-live-checklist.md` (SEC-2/AUTH-2 now green — DOC-DRIFT).

**Additional must-fix before PAID GA:** SAST + dep scan + coverage floor in CI;
IR + restore drill records; pgBouncer `SET LOCAL` validation (R-2); signed DPAs +
sub-processor list; retention/deletion path (C1.2); published pricing; SOC 2 Type 1
readiness; AUTH-3 live IdP binding for the chosen pilot IdP; retire the HMAC session
for SSO + a key-rotation story.

## What is genuinely solid (do not relitigate)

Approval gating (no unapproved-execution path), idempotency, provenance stamps,
reversible audited rollback, kill switch, RLS-under-non-superuser for core tables,
the tamper-evident audit chain, PII-safe log _structure_, the scope fence (no email
path), and AUTH-2's SSO control logic (tenant isolation, fail-closed mapping,
key-never-exported access review) — all impl+test-backed at 399/64 green.

---

## Delta — 2026-06-14 (post alpha-blocker implementation)

Re-run of the same audit after implementing the alpha blocker set. **Gate now
green at 410 tests / 66 files** (was 399 / 64). Changes are self-contained: no
new migration, no repository-contract change; approval gates and auditability
unchanged.

| Blocker                                   | Status                                    | What changed (file)                                                                                                                                                                                                                                                                   | Residual                                                                                                                                                                                                  |
| ----------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1 Non-superuser DB boot guard            | **CLOSED (code)**                         | `packages/db/src/rlsGuard.ts` `assertEnforcedRlsRole` (refuses superuser / BYPASSRLS); wired in `server.ts buildHandlersFromEnv` — hard-fail in prod, warn in dev; `rlsGuard.pglite.test.ts` (superuser→throws, app_user→passes)                                                      | Effectiveness still depends on prod actually setting `DEPLOY_ENV=production`; an isolation-probe-against-fixtures was _not_ added (the role-attribute check is stronger + simpler). Scenario A mitigated. |
| #2 Secrets → secret management            | **PARTIAL (code seam done; KMS = infra)** | `apps/api/src/secrets.ts` — central `SecretSource` seam (env now, KMS/Vault pluggable) + validation: `SESSION_SECRET` ≥32 chars, `CREDENTIAL_SECRET_KEY_BASE64` must decode to exactly 32 bytes; `secrets.test.ts`                                                                    | The actual KMS/Vault _backend_ is still infra and unprovisioned; env remains the default source. Entropy/size are now enforced; key custody is not.                                                       |
| #3 Fail closed (no fake fallback)         | **CLOSED**                                | `server.ts`: production requires `DATABASE_URL`, requires the credential key (refuses the fake HubSpot client), and requires a session verifier — each throws `SecretConfigError` instead of silently degrading                                                                       | Scenario C mitigated. Dev keeps the warn-and-fake behavior.                                                                                                                                               |
| #4 RLS test → policy-bearing tables       | **CLOSED (GAP-1)**                        | `kysely.rls.pglite.test.ts` now loads 0009/0010 and asserts cross-tenant read/insert denial on `audit_events`, `agent_passports`, `scope_grants`, **plus** that `audit_events` has no UPDATE/DELETE policy and app-role UPDATE/DELETE affect 0 rows (append-only proven, not assumed) | Scenario E mitigated. pgBouncer `SET LOCAL` on pooled infra (R-2) is still unproven — infra, unchanged.                                                                                                   |
| #5 Sanitize stored errors + log values    | **CLOSED**                                | `logging.ts` `sanitizeText`/`sanitizeErrorText` (redacts emails, `Bearer` tokens, long opaque blobs; bounded) + value-scrub of free-text log fields in `redactLog`; `actionLedger.ts` stores `sanitizeErrorText(err)` in `result`                                                     | Scenario G mitigated. Conservative patterns; not a guarantee against every exotic secret shape.                                                                                                           |
| #6 Delete dead stubs + refresh stale docs | **CLOSED**                                | Deleted `hubspot/provider.ts` (+ its index export); refreshed `go-live-checklist.md` (SEC-2 🟢, AUTH-2 🟡 with AUTH-3 pointer) with a status note deferring to this audit                                                                                                             | —                                                                                                                                                                                                         |

### Updated traceability deltas

- **GAP-1 (RLS only 0001–0004): CLOSED** — now 0001–0004 + 0009 + 0010 under `app_user`.
- **§7 "provable tenant isolation":** now **DONE incl. audit/passport/grant tables** (was "0001–0004 only").
- **S-3 dead `provider.ts`: REMOVED.**
- **DOC-DRIFT (go-live-checklist SEC-2/AUTH-2): CORRECTED.**
- Logging finding downgraded: free-text value leak now **mitigated** (value scrub); raw-error-in-DB **mitigated** (sanitize-before-store).

### Still open (unchanged — infra/process, mostly paid-GA)

KMS/Vault custody for the data key + session secret (code seam ready; backend
pending); branch protection + required checks; SAST + dependency scan + coverage
floor in CI; pgBouncer `SET LOCAL` validation (R-2); IR + restore drill records;
signed DPAs + sub-processor list; retention/deletion (DSAR) path; published
pricing; SOC 2 Type 1; AUTH-3 live IdP binding; retire HMAC session for SSO;
audit-chain external anchoring; webhook tenant-resolution co-location refactor;
blind stage-rollback current-state verification. These are tracked, not fixed by
this change set.

### Honest status line

The alpha **code** blockers are closed and tested; the remaining alpha gates are
**deployment/ops** (KMS custody, real DB role at deploy, one live round-trip) and
the rest are **paid-GA** process/infra. The highest-severity runtime risk — a
prod deploy silently running as a superuser — is now refused at boot in
production.
