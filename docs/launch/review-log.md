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

---

## 2026-06-09 — Reconciliation audit (read-only verify; docs in sync)

**HEAD `94388e8`** (local == origin, clean tree). **No new commits since the last
governance review** (`94388e8`); **UI-1 not landed** (no `.tsx`, no `next` dep).

**Verified against the branch (all confirmed true):**

- **Tests: 139 green (25 files); typecheck clean.** Matches the docs' claim.
- **Fence intact:** no `/webhooks/email` route; `v1Mode: true` at both prod composition
  sites (`server.ts:184` buildHandlers, `server.ts:234` buildHandlersFromEnv); the email
  adapter is registered ONLY on the non-v1 path. Keyword scan hits are benign —
  `brand_voice` guardrail, `ProviderKind` type-literal enum (`'ads'|'voice'`), and doc
  comments; **no implemented email/voice/ads/LinkedIn/Salesforce/enrichment/autopilot**.

**Done vs pending:** API-1 ✅, B-1 ✅, CRM-1 (code) ✅ — all in code. Pending: UI-1 (code),
live HubSpot creds (B-3), deploy-time controls (B-5), pgBouncer validation (B-2).

**Design-partner alpha: NOT code-complete — blocked on UI-1** (Gate 1 product surface),
then operator live setup (B-3) + deploy controls (B-5). Everything else for alpha is green
in code. UI-1 is the single remaining code blocker for an alpha.

**Exact next best action:** Codex builds **UI-1** (Next.js approval console) — all deps
exist (apiClient + view-model + session-auth contract); apply the pre-staged UI-1 reviewer
checklist before marking done. No doc corrections required this pass (docs already match reality).

---

## 2026-06-09 — UI-1 LANDED (commit `1623554`) + reviewer checklist applied

**What:** Next.js approval console at `/approvals` (apps/web). Sign-in by pasting the
operator session token (operator-handoff step 7) → `Authorization: Bearer`; queue over
`ApiClient.listActions()` (new) + existing view-model; Run Mira / Approve / Reject /
Execute / Refresh / Sign out. Root `pnpm typecheck` now chains the web (tsx) typecheck,
so CI covers the console. `next build` passes; serve smoke OK (/, /approvals render).
**140 tests green (25 files).**

**Reviewer checklist results:**

- ✅ No email affordances (static grep: only the fence comment + "No emails are sent" footer).
- ✅ CRM-only rows via view-model; v1 API yields only `crm.*`.
- ✅ Tenant from session only — no tenant input; `x-tenant-id` omitted by the client.
- ✅ Execute disabled until `approval_status==='approved'`; 409 surfaced as an explicit
  banner ("approve before executing"), never assumed success.
- ✅ 401 and 403 surfaced with explicit explanations; Sign out returns to sign-in.
- ⚠️ Minor (accepted for alpha): viewers still SEE approve/execute buttons (the client
  doesn't decode the role) — the server enforces 403 and the banner explains it.
  Enforcement is server-side (the control); hiding buttons is pre-GA polish.
- ⚠️ Minor (accepted for alpha): 401 shows a banner rather than auto-redirecting to
  sign-in; token stored in tab-scoped sessionStorage. Pre-GA: real login + httpOnly session.
- ✅ Build hygiene: typecheck/test/format all green at root; `.next/` gitignored.

**Gate moved:** Gate 1 product surface → 🟢 (code).

### ALPHA CODE-COMPLETE: YES

All V1 code blockers are done (API-1, B-1, CRM-1, UI-1). Remaining for a live
design-partner alpha is **non-code**: B-3 operator/live HubSpot setup
(`operator-handoff.md` 10-step) and B-5 deploy-time controls (app_user/KMS/TLS/backups,
evidence per `evidence-checklist.md`). B-2 (pgBouncer) remains a Gate-3 pre-paid item.

---

## 2026-06-09 — Launch verification pass: rollout blocker found & fixed (`bda92b7`)

**Dry-running the operator handoff against the code found a guaranteed live failure:**
the prod composition used the SecretStore's default in-memory backing — a seeded
credential could never persist (runtime `secret_not_found` at first execute), and no
operator tooling existed for handoff steps 5–7. Fixed within the authorized
"tiny blocker found during rollout" scope: migration `0008_credential_ciphertexts`
(ciphertext-only system vault; documented RLS exception), `CredentialCiphertextStore`,
env wiring, `issue-session.mjs` + `seed-hubspot-credential.mjs`, and 3 regression tests
proving the operator-seeded blob resolves through the REAL production path.
**143 tests green (26 files).** Fence untouched. New artifact:
`docs/launch/alpha-rollout-record.md` (live execution log + go/no-go).

---

## 2026-06-10 — FLY-1: decision-reason flywheel landed (`926e5ca`, branch `claude/fly-1-decision-reasons`)

**What changed:** approve/reject now **require a structured reason** in both the
approval console and the API, and every decision is persisted to
`feedback_labels` (migration 0007 — no new migration needed) as a queryable,
self-contained label: `{ reason_code, note, approver_ref, action_type,
risk_level, target_ref }` under `subject_ref = agent_action:<id>`.

- Reason codes are closed enums in `@cognitia/core` (`approveReasonCode` /
  `rejectReasonCode`); `other` requires a note. Free-text-only reasons are not
  accepted — labels must be machine-segmentable.
- Ledger is the single write path (`recordDecisionLabel`); `InvalidDecisionError`
  backstops non-API callers. `reason_code` also lands on the approved/rejected
  events and audit entries.
- API: 400 without a valid reason; new read endpoints `GET /decisions` and
  `GET /agent-actions/:id/decisions`. 401/403/409 behavior unchanged
  (regression-tested).
- UI: inline reason panel (select + note); minimal by design.
- How labels feed evals/scorecards/autonomy: `docs/evals.md` §3a.

**Reviewer checklist results:**

- ✅ Approve without reason → 400; action stays `proposed`; still 409 on execute.
- ✅ Reject without reason → 400; invalid/out-of-enum codes → 400; `other` w/o note → 400.
- ✅ Label persisted + queryable per action and tenant-wide; tenant-isolated.
- ✅ Repository contract test (in-memory AND PGlite/Postgres) covers jsonb
  round-trip + subject/tenant filtering; migration 0007 added to the PGlite harness.
- ✅ Fence untouched: no new channels, no email, no autopilot — approval remains
  mandatory; v1Mode/FEN tests unchanged and green.
- ⚠️ Minor (accepted): web reason-code lists are duplicated constants (kept in
  sync with core by comment, not import) — web app doesn't depend on
  `@cognitia/core`; revisit if codes change often.

**154 tests green (28 files); typecheck (root + web) green.**

**Operator-visible change:** approving/rejecting now asks "why" (one select +
optional note). `operator-handoff.md` step 9 and the Gate-1 checklist updated.

---

## 2026-06-10 — PROV-1: in-CRM execution provenance (`52148cb`, `91d16d9`, branch `claude/prov-1-hubspot-provenance`)

**What changed:** every CRM object Cognitia writes now carries execution lineage
as namespaced `cognitia_*` HubSpot properties, so the action is auditable inside
the customer's own system of record.

- `core`: typed `ActionProvenance` (agent / agent_run_id / agent_action_id /
  evidence_count / risk_level / approved_by) — refs and roles only, no raw PII.
- `integrations`: `HubspotWriteInput.provenance` flows to the HTTP client, which
  maps it to `cognitia_*` properties on the **create** body only; exported
  `PROVENANCE_PROPERTIES` as the single source of truth (mirrored in
  `hubspot-onboarding.md`). Optional `provenance` arg threaded through
  adapter/registry/types (additive — other adapters ignore it).
- `agents`: `ledger.execute` resolves provenance (agent from the run, approver
  from the FLY-1 approval label) and passes it down. Best-effort and
  non-blocking; degrades gracefully if run/label are missing.

**Reviewer checklist results:**

- ✅ Provenance stamped on create (agent/run/action/evidence/risk/approver).
- ✅ Approver resolved from the FLY-1 label; omitted (not faked) when absent.
- ✅ **Idempotency intact:** dedupe still searches only on the idempotency key;
  a replay collapses to the prior object and does **not** re-stamp — proven in
  both the HTTP-client test and the e2e test (`writeLog` length stays 1).
- ✅ **Approval intact:** execute without approval still refused; never writes.
- ✅ Fence untouched: no new channels, no email, no autopilot. Provenance is
  additive accountability, never a control surface; never gates execution.
- ⚠️ Operational dependency: the 6 `cognitia_*` properties must exist on Tasks
  and Notes in the portal (a write to a missing property is rejected). Documented
  as REQUIRED in `hubspot-onboarding.md` §2a + go-live/operator checklists.

**161 tests green (30 files); typecheck (root + web) + format green.**

How provenance supports the accountability moat: `beat-alta-10x.md` §9a.

---

## 2026-06-10 — UX-2: batch approve/reject + decision-history view (`f07feac`, `0ad0711`, branch `claude/ux-2-batch-and-history`)

**What changed:** the approval console can now act on many proposals at once and
review past decisions — the first ticket that _consumes_ FLY-1 reasons and
PROV-1 approver lineage.

- `api`: `POST /agent-actions/batch-approve` + `/batch-reject` — a capped,
  non-empty id list plus one shared structured reason. Reuses FLY-1's
  closed-enum validation per kind; each action still gets its own label.
  Per-id results: **200** when all succeed, **207** when some ids fail (each
  `{id, ok, status, error}`), so partial failure is explicit, not silent.
- `web`: multi-select (proposed rows only) + bulk action bar (approve/reject
  selected, select-all-proposed, clear), reusing the existing reason panel;
  the batch summary is surfaced ("Approved N/M; K failed"). New
  **decision-history** view (toggle) backed by `GET /decisions`, showing
  decision / reason+note / approver / action ref.

**Reviewer checklist results:**

- ✅ Batch shares FLY-1 validation: missing/out-of-enum reason → 400; `other`
  requires a note; empty id list → 400.
- ✅ Partial failure returns 207 with per-id status (unknown id → 404), and the
  remaining ids still apply.
- ✅ RBAC/auth unchanged: viewer → 403, no principal → 401; single-action
  approve/reject/execute and 409 guardrails untouched.
- ✅ Tenant isolation: history/decisions scoped to the session tenant.
- ✅ Fence untouched: CRM-only, human approval still mandatory per action, no
  new channels, no autopilot. Batch is an operator-ergonomics layer over the
  same per-action ledger path — not bulk autonomy.

**173 tests green (32 files); typecheck (root + web) + format green.**

---

## 2026-06-10 — MET-1: trust-metrics endpoint + console strip (`3ba6627`, `b7ddab6`, branch `claude/met-1-trust-metrics`)

**What changed:** the accountability data (FLY-1 labels, ledger statuses,
idempotent replays) is now aggregated into auditable trust numbers.

- `api`: `GET /metrics/trust` (read-only, viewer-allowed, tenant-scoped) —
  action counts, approval rate over decided actions, approve/reject
  reason-code mixes, median proposal→decision latency, duplicate writes
  prevented (idempotent replays collapsed). Computed live from
  `agent_actions` + `feedback_labels` via a pure `computeTrustMetrics()` —
  no separate counters to drift.
- `web`: compact strip under the console header (approval rate / decisions /
  executed / median decision time / duplicates prevented). Best-effort: a
  metrics failure never blocks the approval queue.

**Reviewer checklist results:**

- ✅ Pure math unit-tested: empty-tenant nulls, rate over decided-only,
  reason mixes, median latency, replay counting, malformed-label tolerance.
- ✅ E2E: run → approve → execute is reflected in the endpoint.
- ✅ Auth unchanged: 401 without principal; tenant-scoped (other tenant sees
  zeros); read-only so viewers may see it.
- ✅ Fence untouched: no new channels, no email, no autopilot; metrics are
  derived reads, never a control surface.

**181 tests green (30 files); typecheck (root + web) + format green.**

These are the numbers the published trust benchmarks (dossier §10.3) will
draw from; EVAL-1 (golden dataset + CI gate) is the remaining must-ship.
