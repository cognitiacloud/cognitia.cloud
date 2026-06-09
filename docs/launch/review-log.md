# V1 Review Log

> Governance/review record. Append-only. Audits branch state vs
> `docs/competitive/operating-plan.md` (scope fence) and tracks blockers.

## Companion docs (this overnight pass)

- `docs/launch/go-live-checklist.md` — Gate 0/1/3 checklist.
- `docs/launch/tickets/{API-1,CRM-1,UI-1}.md` — start-this-week specs.
- `docs/runbooks/{hubspot-onboarding,incident-response,access-review}.md`.
- `docs/security/{control-matrix,evidence-checklist}.md`.
- `docs/testing/v1-acceptance.md`.

---

## 2026-06-09 — Overnight governance pass (base HEAD `ea7677e`)

**Branch audit:** clean tree; **no Codex implementation changes present** — all three
tracks (API-1, CRM-1, UI-1) unstarted. 124 tests green (21 files).

**Scope-fence check:** ✅ intact. No email route, no email send path executed by default,
no voice/LinkedIn/ads/Salesforce/enrichment/autopilot code. **One latent risk (B-1).**

**Verified current state (for ticket grounding):**

- API composes `InMemoryRepository` + reads `x-tenant-id` header (`server.ts`). → API-1.
- HubSpot side-effect adapter defaults to `FakeHubspotClient`; `createGtmServices` registers it. → CRM-1.
- Approval queue = client + view-model only; no Next.js page. → UI-1.
- RLS proven under non-superuser; idempotency + approval-refusal + no-PII-log tests exist (Gate-0 controls already green).

---

## Blockers

### B-1 — Latent email path is not fenced in CODE (only in docs)

- **What:** Mira still proposes `email.draft.send`, and `StubEmailAdapter` is registered in `createGtmServices`. If an operator approves+executes such an action, the email adapter runs. The fence "no email in V1" is documentation-only.
- **Why it matters:** a single approve+execute would breach scope-fence rules #1/#6. Fences must be enforced by code, not trust.
- **Immediate next action (Codex, small):** add a `v1Mode` flag to `createGtmServices` that (a) omits `StubEmailAdapter` from the prod `AdapterRegistry`, and (b) restricts Mira proposals to `crm.*` action types; add FEN-2/FEN-3 tests from `v1-acceptance.md`.
- **Blocks:** **V1 (Gate 1).**

### B-2 — pgBouncer transaction-mode `SET LOCAL` unvalidated on real infra

- **What:** the no-leak guarantee is proven in PGlite, not against pooled Postgres (pgBouncer transaction mode).
- **Why it matters:** session-mode pooling or a misconfig could leak tenant context under concurrency.
- **Immediate next action:** deploy pgBouncer in **transaction mode**; add a pooled concurrency isolation test before paying customers.
- **Blocks:** **before first paying customer (Gate 3).** Not a blocker for a single design-partner alpha.

### B-3 — CRM-1 requires live HubSpot credential + portal property

- **What:** real CRM write-back needs a HubSpot private-app/OAuth token and the `cognitia_idempotency_key` property on Tasks/Notes.
- **Why it matters:** without the property, dedupe silently no-ops → duplicate objects; without the token, execute can't run.
- **Immediate next action (Codex/human — STOP for planning agent; live creds):** follow `docs/runbooks/hubspot-onboarding.md`; seed the encrypted credential + `integration_connections` row.
- **Blocks:** **V1 (Gate 1).**

### B-4 — Auth provider undecided (API-1)

- **What:** auth-derived tenant needs an auth mechanism (OIDC/magic-link for V1).
- **Why it matters:** until then, tenant is header-trusted = auth bypass; cannot touch real customer data.
- **Immediate next action (Codex):** pick OIDC issuer/library; implement `verifySession()` → `{ tenantId, userRef, role }`; replace header read in `server.ts`/`handlers.ts`.
- **Blocks:** **V1 (Gate 0).**

### B-5 — Deploy-time controls unprovable in repo

- **What:** non-superuser DB role, KMS key, TLS, backups/PITR are configured at deploy, not in code.
- **Why it matters:** Gate-0 SOC 2 controls (AC-5, SC-1, CR-1, BC-1) need real config + evidence.
- **Immediate next action (human/infra):** provision per `control-matrix.md`; capture evidence per `evidence-checklist.md` §B.
- **Blocks:** **V1 (Gate 0)** — ops, not code.

---

## Handoff for Codex (smallest next actions, in order)

1. **API-1** — `verifySession()` + swap `InMemoryRepository`→`createPostgresRepository` + RBAC; promote isolation/idempotency tests to required CI checks. _(unblocks everything)_
2. **B-1 fence guard** — `v1Mode` in `createGtmServices` (drop email adapter; Mira→`crm.*` only) + FEN-2/FEN-3 tests. _(small, closes the only live fence risk)_
3. **CRM-1** — inject real `HttpHubspotClient` into the execute-path adapter + worker scheduler over `integration_connections`; keep fake client for tests; extend `e2e.hubspotSync.test.ts`. _(then human seeds live cred — B-3)_
4. **UI-1** — scaffold Next.js `approvals` page against a mocked session; wire real auth after API-1.

**Planning agent stop reason:** remaining work is implementation (Codex) and live-credential/infra setup (human). No further doc tightening adds value without those landing.

---

## 2026-06-09 — Implementation pass (API-1, B-1, CRM-1)

**Commits:** `450d688` (API-1) · `4dd1cd9` (B-1) · `d9463c3` (CRM-1). **139 tests green.**

**API-1 (DONE — Gate 0).** Auth-derived tenant + RBAC; `x-tenant-id` no longer trusted
on operator routes (session `Authorization: Bearer` via `HmacSessionVerifier`, the
OIDC seam). `buildHandlersFromEnv` composes `KyselyRepository` when `DATABASE_URL`
is set, with a real `/health` DB ping. Tests prove forged `x-tenant-id` cannot escape
the session tenant, no-session→401, viewer→403, expired→401. **Resolves B-4** (auth
mechanism chosen: signed-session HMAC seam; OIDC issuer swaps in behind `SessionVerifier`).

**B-1 (DONE — Gate 1).** Fence enforced in code: `v1Mode` drops the email adapter and
gates Mira to `crm.*` only. FEN-1..3 green (no `/webhooks/email` route; no email
handler in the v1 registry; a v1 Mira run proposes only `crm.*`).

**CRM-1 (CODE DONE — Gate 1; live creds pending).** `createGtmServices({ hubspotClient })`
injects the real `HttpHubspotClient` into the execute-path adapter; `buildHandlersFromEnv`
builds it when `CREDENTIAL_SECRET_KEY_BASE64` is set, else fake + a warning. Idempotency
proven (`crmExecute.test.ts`): approve→execute calls the client once; re-execute is a no-op.

### Operator handoff to finish CRM-1 go-live (B-3 — live creds, not code)

Per `docs/runbooks/hubspot-onboarding.md`:

1. Create a HubSpot private app / OAuth app with least-priv CRM read + tasks/notes write scopes.
2. Create the `cognitia_idempotency_key` custom property on **Tasks** and **Notes** (without it, dedupe silently no-ops).
3. Provide env: `DATABASE_URL`, `SESSION_SECRET`, `HUBSPOT_WEBHOOK_SECRET`, and
   `CREDENTIAL_SECRET_KEY_BASE64` (a 32-byte base64 AES key from KMS).
4. Seed the encrypted credential via `SecretStore.put(credential_ref, …)` + an
   `integration_connections` row (`status='active'`).
5. Verify: approve a `crm.task.create` → exactly one HubSpot task; re-execute → no duplicate.

### Still open

- **B-2** (post-V1, Gate 3): validate `SET LOCAL` under pgBouncer transaction mode on real infra.
- **B-5** (Gate 0, ops): provision app_user role / KMS / TLS / backups + capture evidence.
- **UI-1** (Gate 1): Next.js approval console (next track for Codex).

---

## 2026-06-09 — Overnight governance/ops pass #2 (docs-only, no code)

**Audit:** no new Codex commits since `bda39e7`; UI-1 not yet landed. Reality verified
against docs: **139 tests green (25 files), typecheck clean, no `/webhooks/email` route,
v1Mode in prod composition** — governance docs match the branch. Fence intact.

**Added (lane: ops/sec/docs — no implementation files touched):**

- Runbooks: `deploy-verification.md`, `secret-rotation.md`, `backup-restore-drill.md`.
- Security: `risk-register.md` (13 risks, residuals), `vendor-access-register.md`
  (sub-processors + internal access), control-matrix ownership/cadence appendix.
- Launch: `operator-handoff.md` (shortest-path 10-step live test + rollback),
  `design-partner-alpha-checklist.md`, go-live **gate-status dashboard**
  (green/yellow/red, owner, next action; alpha vs paid vs post-V1).
- UI-1 ticket: reviewer checklist + post-API-1 integration contract.

**Commits:** `13e425e` ops · `36843a3` sec · `a136bc1` docs · `f94a48d` review.

**Blocker status (precise + assigned):**

- B-2 (pgBouncer SET LOCAL on real infra) — Gate 3, ENG-platform — pooled isolation test before scale.
- B-3 (live HubSpot creds + portal property + AES key) — Gate 1, Operator — run `operator-handoff.md`.
- B-5 (deploy-time controls: app_user/KMS/TLS/backups) — Gate 0, Ops — provision + capture evidence.
- UI-1 — Gate 1, ENG-web (Codex) — scaffold console; reviewer checklist pre-staged.

**No scope drift.** Email/voice/ads/LinkedIn/Salesforce/enrichment/autopilot remain fenced out.

### Next safe high-leverage task for Codex

**UI-1** (Next.js approval console). All deps exist: API client + view-model
(`apps/web/src/lib/*`), and the session-auth contract (Bearer; 401/403/409). Build
against a mocked session first; wire real auth after. Apply the UI-1 reviewer
checklist before marking done.
