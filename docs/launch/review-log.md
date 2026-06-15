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

---

## 2026-06-10 — EVAL-1: golden dataset v1 + CI eval gate (`bbf20bb`, branch `claude/eval-1-golden-gate`)

**What changed:** the V1 trust invariants are now pinned by an executable
golden dataset that runs the **real Mira runtime** in CI.

- `packages/evals/datasets/golden-v1.json`: versioned synthetic scenarios
  (no PII) — fit-account proposal, suppressed-contact respect, ICP ranking
  precision (fit beats non-fit at maxAccounts=1), multi-account coverage.
- `harness.ts`: `runGoldenEval()` executes Mira (v1Mode, in-memory repo,
  deterministic ids/clock) per scenario and scores five rubrics:
  `scope_fence`, `icp_targeting`, `suppression_respect`, `evidence_coverage`,
  `idempotency` — 0/1 each, with failure detail in the result.
- Gate: `golden.test.ts` requires every score to be exactly **1.0** (safety
  invariants, no partial credit). It runs inside `pnpm test` → the existing
  `build-test` CI job → a regression fails CI. No new workflow needed.

**Reviewer checklist results:**

- ✅ Gate passes against the current runtime (all 4 scenarios, all rubrics 1.0).
- ✅ **Falsifiable**: a mutated scenario (narrowed fence) scores 0 and fails —
  verified with a temporary test, then removed; the gate is not decorative.
- ✅ Dataset is synthetic; no PII; versioned (`golden-v1`).
- ✅ Fence untouched: the harness exercises v1Mode exactly as production
  composes it; no runtime behavior changed by this ticket.
- ⚠️ Note: evals now depends on @cognitia/agents + @cognitia/db (workspace) —
  acceptable direction (evals sits above agents); no cycle introduced.

**183 tests green (31 files); typecheck (root + web) + format green.**

With EVAL-1 landed, all five "must (next release)" moat tickets are shipped:
FLY-1, PROV-1, UX-2, MET-1, EVAL-1.

---

## 2026-06-10 — GOV-1: typed write plans, execution preview, audited denials (`4be83ed`, branch `claude/gov-1-typed-write-preview`)

**What changed:** the approval gate can now show exactly what it is gating.

- `packages/integrations/hubspot/writePlan.ts`: one pure assembly for the
  full engagement property map — typed content (`hs_task_subject/body`,
  `hs_note_body`, `hs_timestamp` pinned to proposal time) + idempotency
  property + PROV-1 lineage. The HTTP client and the preview both consume it.
- Closes an audit-discovered gap: executed tasks previously carried only
  `payload_ref: null` + metadata — no human-readable content.
- `ActionLedger.previewExecution` + `GET /agent-actions/:id/preview`
  (read-only, viewer-allowed): exact property map, would_execute /
  denial_reason, idempotent-replay expectation, guardrails, evidence.
- Refused executions now emit `agent.action.execution_denied.v1` + an
  `execution_denied` audit entry (previously a silent 409).
- Console: per-row "Preview write" expander.

**Reviewer checklist results:**

- ✅ **Preview-equals-write proven**: captured HTTP request body through the
  real adapter→client path is byte-identical to the plan (`writePlan.test.ts`).
- ✅ Determinism: every property derives from the action row (timestamps from
  `created_at`, never `now()`); same action ⇒ same plan, replay-safe.
- ✅ No PII in plans (asserted); provenance values are refs/roles only.
- ✅ Approval semantics strengthened, not weakened: preview adds information
  before consent; denials now leave artifacts; fence untouched.
- ✅ Onboarding: content uses standard `hs_*` properties — no new portal setup.

**195 tests green (33 files); typecheck + format green.**

---

## 2026-06-10 — SIM-1: zero-write preflight simulation (branch `claude/sim-1-preflight`)

**What changed:** onboarding gets a day-0, zero-risk artifact — the real Mira
runtime over an ephemeral copy of the tenant's synced data.

- `apps/api/src/preflight.ts`: snapshot tenant accounts/contacts into an
  ephemeral `InMemoryRepository`, run `createGtmServices` (v1Mode — the
  production fence) over the copy, report would-be proposals **with the full
  GOV-1 write plan each**, ranked accounts, and suppressed exclusions.
  Nothing persists: the simulation's runs/actions/events die with the copy.
- `POST /agent-runs/mira/preflight` (same role as runMira); console gains a
  "Preflight (no writes)" button + report panel.
- This is the EVAL-1 harness pattern pointed at live tenant data: "we ran our
  CI harness on your CRM before anything could touch it."

**Reviewer checklist results:**

- ✅ **Zero-mutation guarantee tested**: after preflight, live repo has 0
  agent_actions, 0 events, 0 audit_events; repeatable (two runs agree, still
  zero writes).
- ✅ Honors icp/maxAccounts like a live run; suppressed contacts reported.
- ✅ Role-gated like runMira (viewer 403, anonymous 401).
- ✅ Fence untouched; lineage ids in the report are simulated (documented).

**Onboarding runbook updated: preflight is now step one before any live run.**

---

## 2026-06-10 — UNDO-1: typed rollback for executed CRM writes (branch `claude/undo-1-rollback`)

**What changed:** every write can now be previewed before (GOV-1) **and undone
after** — with the undo as accountable as the execution.

- `HubspotClient.archiveEngagement` (HubSpot's reversible delete — recycle
  bin, not destruction): Fake (idempotent, logged) + Http (DELETE
  `/crm/v3/objects/{object}/{id}`, 404 = already gone = success).
- `IntegrationAdapter.rollback?` (optional — irreversible types simply don't
  implement it and the ledger refuses with that reason);
  `AdapterRegistry.rollback` routes by action type.
- `ActionLedger.rollback`: requires executed status + the recorded
  `external_ref`; transitions to new `rolled_back` execution status; records a
  `rolled_back` feedback label (reject taxonomy: why was this write wrong?),
  emits `agent.action.rolled_back.v1`, audits. **Refusals are audited as
  `rollback_denied`** (mirrors GOV-1's audited denials). Idempotent.
- `POST /agent-actions/:id/rollback` (mutating role; structured reason
  mandatory — 400 without). Console: "Undo write" on executed rows, reusing
  the mandatory-reason panel.

**Reviewer checklist results:**

- ✅ e2e: execute → rollback archives the exact external object; label +
  event + audit recorded; second rollback is a no-op (no re-archive).
- ✅ Refusals: unexecuted action → 409 + `rollback_denied` audit; email
  action types refused as irreversible; unknown refs refused.
- ✅ HTTP layer: DELETE captured; 404 tolerated; other errors propagate.
- ✅ Trust metrics unskewed: `rolled_back` labels are not rejections;
  approval rate unchanged.
- ✅ Fence untouched: rollback removes our own write — no new outreach
  surface; archive is reversible in HubSpot's recycle bin.

**214 tests green (36 files); typecheck + format green.**

---

## 2026-06-10 — TRUST-2: exportable trust packet (branch `claude/trust-2-packet`)

**What changed:** trust is now an exportable artifact, not an API response.

- `GET /reports/trust-packet` (read-only, viewer-allowed): one tenant-scoped
  JSON for procurement/security reviewers, admins, and champions. Contents:
  live trust metrics (now incl. `rolled_back` count), full decision history
  (reason codes, approvers), full audit trail (incl. `execution_denied` /
  `rollback_denied`), the CRM write contract (idempotency + provenance +
  content properties), **ten control attestations each citing the CI test
  file that enforces it**, and the golden eval gate **re-run live at export
  time** with its result embedded.
- Console: "Export trust packet" downloads the JSON.

**Honesty invariants (tested):**

- ✅ Every control attestation's evidence file exists in the repo (a test
  walks all pointers — they cannot go stale).
- ✅ Metrics/decisions/audits derive from a real flow at export time.
- ✅ The embedded eval result is a real run (scenarios ≥ 4, failed = 0).
- ✅ No raw PII anywhere in the packet (regex-asserted).
- ✅ Tenant-scoped; 401 without principal.

**Net:** "audit logs reviewable by the customer" — the procurement ask — is
now one click, and every claim in the artifact is either live-derived or
points at the CI gate that enforces it.

---

## 2026-06-10 — REGR-1: rejection→regression flywheel (branch `claude/regr-1-rejection-flywheel`)

**What changed:** operator rejections now have a path into the CI gate.

- `packages/evals/src/regression.ts`: `buildRegressionScenario` converts a
  rejected action + label + tenant rows into an **anonymized** golden-scenario
  candidate (synthetic ids/names; behavioral inputs only) pinning "this
  target must not be proposed again under these inputs", with
  `source: {kind: operator_rejection, reason_code}` provenance.
- `datasets/regressions-v1.json` (adopted, append-only) seeded with one
  scenario; the golden gate now also runs every adopted regression.
- `GET /agent-actions/:id/regression-candidate` (rejected actions only —
  409 otherwise); console "Export regression" on rejected rows.

**Honest semantics, proven in tests:**

- ✅ An UNFIXED rejection **fails** the harness (icp_targeting = 0) — the
  candidate demands a behavior change; it is not decoration.
- ✅ With the fix applied (ICP/ranking change), the same pin **passes** —
  the adopted scenario locks the fix forever.
- ✅ Anonymization: tenant names/domains/ids asserted absent from candidates.
- ✅ Gate extension: adopted regressions run in CI with provenance checked.

**Net:** the flywheel the eval research describes — "every production failure
becomes a test" — is now a product workflow: reject → export → fix → adopt →
CI-locked.

---

## 2026-06-10 — ENF-1: enforced kill switch, governance matrix, audit explorer (branch `claude/enf-1-enforced-governance`)

**What changed:** the audit found the runbook's primary operational control —
the tenant kill switch — was documented but NOT enforced anywhere in code.
This wave makes governance enforced, visible, and exported.

- **Enforced kill switch:** `ActionLedger` now checks the tenant's
  integration connection before execution AND rollback; any non-`active`
  status halts with 409 + audited denial (`connection_paused` /
  `connection_error`) + event. Missing row = no gate (dev mode, documented);
  production always has a row. New repo primitive
  `updateIntegrationConnectionStatus` proven on BOTH engines via the shared
  repository contract (memory + PGlite).
- **Explicit pause/resume semantics:** `POST /integrations/:system/pause`
  (any operator — pulling the cord is cheap) /
  `/resume` (**owner only** — recovery is deliberate; new `requireOwner`
  gate). Both flips audited. Console: status chip, EMERGENCY STOP / Resume
  button, and a halted banner.
- **Governance matrix:** `GET /governance` — per-action-type capabilities
  DERIVED FROM CODE (policy gate + adapter registry): risk, approval
  requirement, suppression verdict + reason, executable-in-deployment
  (fence), rollback support; plus the role matrix and kill-switch semantics.
  Proven derived, not hardcoded: a non-v1 composition flips email to
  executable in the test. Console "Governance" panel renders it.
- **Audit explorer:** `GET /audit` (viewer-allowed, newest-first, limit
  capped) + console "Audit trail" panel — audit rows were written everywhere
  but inspectable nowhere.
- **Trust packet** gains `governance` + `integration` (kill-switch state)
  sections and an 11th control attestation (`tenant_kill_switch`) citing
  `killSwitch.test.ts` — the evidence-pointer test enforces the file exists.

**Reviewer checklist results:**

- ✅ Paused → execute 409, zero CRM writes, audited denial + event; rollback
  equally gated; `error` status halts too (any non-active).
- ✅ Resume as operator → 403; as owner → execution restored (tested).
- ✅ Pause/resume flips audited with actor + subject `integration:hubspot`.
- ✅ Pause with no connection row → 404 (not a silent no-op).
- ✅ Contract: status updates round-trip + tenant-scoped on memory AND PGlite.
- ✅ Docs-honesty: the runbook's kill-switch claim now cites the enforcing
  code and test instead of describing a fiction.

---

## 2026-06-10 — RDY-1: connection readiness gate (branch `claude/rdy-1-connection-readiness`)

**Thesis fit (CRM-first, approval-gated, governed action system):** turns the
manual HubSpot go-live checklist into an automated, operator-visible gate that
proves the portal is correctly configured before the first governed CRM write —
directly de-risking live operator setup (B-3, otherwise non-code/human-blocked).

**What changed:**

- `HubspotClient.listObjectProperties` (read-only): Fake (defaults to
  all-required-present; settable to simulate misconfig) + Http
  (`GET /crm/v3/properties/{object}`).
- `REQUIRED_ENGAGEMENT_PROPERTIES` (idempotency + 6 provenance props) — the
  custom properties a write needs; content props are standard and excluded.
- `checkHubspotReadiness()` — verifies connection `active` + every required
  property present on Tasks **and** Notes; returns a structured report naming
  exactly what's missing.
- `GET /integrations/readiness` (read-only, viewer-allowed): 200 when ready,
  409 with the report when misconfigured, 503 when no read client (dev).
- Console: "Check readiness" button + pass/fail checklist panel.
- Runbook §4: readiness gate is now the first verify step.

**Why it's honest:** read-only (lists property definitions, never writes);
catches the runbook's #1 documented failure mode (write rejected on a missing
property) ahead of time rather than at execution.

**Tests (+13):** ready-all-present; missing-provenance-on-notes names the prop;
missing-idempotency flagged; inactive/not_connected → not ready; property-read
failure surfaced; HTTP path hits `/crm/v3/properties/:object`; endpoint
200/409/409-not-connected/503/401; client route. Plus the `CountingHubspotClient`
test helper updated for the extended interface.

---

## 2026-06-10 — ALPHA-1: full-lifecycle acceptance, deploy smoke, handoff alignment (branch `claude/alpha-1-live-readiness`)

**Thesis fit:** one CI-enforced test of the entire governed lifecycle, an
automated post-deploy smoke check, and a corrected operator handoff make the
live alpha verifiable end to end — strengthening the CRM-first,
approval-gated, governed GTM action system exactly where it meets reality
(B-3 setup / B-5 deploy controls).

**What changed:**

- `apps/api/src/lifecycle.acceptance.test.ts` — the product-truth test: ONE
  journey covering readiness READY → zero-write preflight → propose →
  preview → audited pre-approval denial (409, zero writes) → reasoned
  approval → one provenance-stamped execution with **preview/write parity
  asserted key-by-key** → idempotent re-execute → kill-switch halt of
  rollback (audited) → owner-only resume (operator 403) → accountable undo →
  reject + anonymized regression export → live metrics
  (approved/rejected/rolled_back = 1/1/1, rate 0.5) → **audit census** (9
  required entries: proposed, execution_denied, approved, executed,
  integration_paused, rollback_denied, integration_resumed, rolled_back,
  rejected) → trust packet consistency with a green embedded eval run.
- `apps/api/scripts/smoke-deploy.mjs` (+ typed `.d.mts`) — post-deploy smoke
  automating the runbook's HTTP checks: health/db, auth-fail-closed, email
  fence 404, session auth, **governance fence drift** (email must not be
  executable), kill-switch enforced, readiness (WARN when portal unset —
  valid pre-setup state), trust metrics, viewer RBAC 403. Exit non-zero on
  required failure → pipeline-gateable (B-5). Missing tokens = SKIP, never a
  silent pass. 8 tests incl. every failure path and dead-deploy short-circuit.
- Trust packet: two new control attestations — `connection_readiness_gate`
  and `full_lifecycle_acceptance` — with CI-evidence pointers (the existing
  pointer-existence test now enforces both files).
- `operator-handoff.md` rewritten to match shipped reality: **fixes a
  critical gap (the six provenance properties were missing from prereqs and
  step 4 — the exact write-rejection failure RDY-1 catches)**; now a 12-step
  flow with readiness gate (step 8) and preflight (step 10); product
  pause/resume replaces raw SQL in rollback (SQL kept as break-glass);
  trust-packet export added to SOC 2 capture; smoke script in step 3.
- `deploy-verification.md`: automated smoke section first; manual checks
  2/6/8 remain explicitly manual.

**260 tests green (45 files; +9: lifecycle acceptance + 8 smoke paths); typecheck + format green.**

---

## 2026-06-10 — WHY-1: decision rationale + data freshness at approval time (branch `claude/why-1-decision-rationale`)

**Thesis fit:** makes the governed approval gate _informed rather than blind_ —
visibility-before-action and signal-freshness control, the two beat-Alta paths
most relevant to the CRM-first, approval-gated thesis. Not breadth; depth on
the gate that already exists.

**What changed:**

- `deriveAccountEvidence()` extracted as the canonical evidence derivation in
  `contextBuilder.ts`; `ContextBuilder.buildEvidence` now delegates to it, so
  the operator's rationale reuses the EXACT facts the agent grounded on (one
  source of truth, no drift).
- `apps/api/src/rationale.ts` — pure `buildActionRationale(action, account,
contacts)`: fit/timing/combined recomputed from the account's signal
  columns, the human-readable grounding facts, and freshness
  (`data_updated_at`, `age_days`, and **`stale_since_proposal`** = the account
  changed after the proposal → re-run recommended).
- `GET /agent-actions/:id/rationale` (read-only, viewer-allowed, tenant-scoped).
- Console: a "Why" expander per row — account facts, score, evidence claims,
  and a red staleness warning when the data moved after proposal.
- Trust packet: `decision_rationale_visibility` control attestation
  (CI-evidence-pointed). Operator handoff step 11 now opens "Why" before approving.

**Proof:** score breakdown (0.9/0.8/0.86), canonical evidence claims surfaced,
freshness age in whole days, `stale_since_proposal` true when account updated
after proposal, champion-fact inclusion, graceful degradation when the account
is gone, 404/401/tenant-scoping, client route. The evidence refactor did not
regress Mira (mira.test.ts green).

---

## 2026-06-10 — RDM-1: README coherence + CI-enforced evidence index (branch `claude/rdm-1-readme-coherence`)

**Thesis fit:** coherence and truthfulness (beat-Alta path #1). The first
artifact a technical evaluator reads now tells the truth about the governed
action system instead of understating it.

**What changed:**

- Root `README.md` Status fixed: it claimed "Bootstrap scaffold … business
  logic is intentionally stubbed" — **false**. Now: "Working governed CRM
  action system, not a scaffold," with the human/data-blocked remainder named.
- Added a **capability → operator surface → proof (test)** table: 15 shipped
  governance behaviors, each mapped to its endpoint/console surface and the CI
  test that proves it. The scope fence and remaining-work are stated honestly.
- Corrected overstatements: the integrations line claimed Salesforce/email/
  voice/ads adapters (only HubSpot is live; email is fenced); agent table now
  shows Mira **Live**.
- `readmeEvidence.test.ts` — a CI guard that asserts every `*.test.ts` cited in
  the README exists. If a cited test is renamed/deleted, the README is lying
  and CI fails — docs/implementation coherence is now mechanically enforced,
  the same discipline as the trust-packet attestation pointers.

**270 tests green (47 files); typecheck + format green.** No code behavior
changed; this is a truthfulness fix with a drift guard.

---

## 2026-06-10 — LEARN-1: per-segment governance scorecards (branch `claude/learn-1-scorecards`)

**Thesis fit:** the performance-reporting surface that proves the value of
governed actions (a Priority-B gap vs Alta's analytics) AND the data-derived
substrate for earned autonomy that `evals.md` §3a documented but had not
shipped. Derived live from the ledger; no new channel, no autonomy.

**What changed:**

- `apps/api/src/scorecards.ts` — `computeScorecards(actions, labels)` groups by
  `action_type × risk_level` and reuses `computeTrustMetrics` over each slice
  (the per-segment numbers are the SAME computation as the aggregate, no second
  metric impl). Each segment carries a conservative **read-only**
  `autonomy_indicator` (≥ 20 decisions, ≥ 95% approval, zero policy/risk
  rejections, zero rollbacks). `median` extracted from trustMetrics for reuse.
- `GET /metrics/scorecards` (read-only, viewer-allowed, tenant-scoped).
- Trust packet now embeds the `scorecards` section + a `per_segment_scorecards`
  control attestation (CI-evidence-pointed).
- Console: a "Scorecards" panel — per-segment approved/rejected/executed/
  rolled-back, approval rate, top reject reasons, and a "✓ trusted" indicator
  with an explicit "V1 grants no autonomy" note.
- `evals.md` §3a updated: the per-segment scorecard is now shipped (was planned).

**Proof:** segmented metrics equal the per-slice aggregate; autonomy indicator
is conservative and **falsifiable** (a single `policy_or_risk` rejection or one
rollback disqualifies a segment; a low-volume perfect segment does not clear
the bar); empty tenant → no segments; endpoint 401/tenant-scoping; packet
embedding; client route. Trust-packet + metrics suites unchanged and green.

---

## 2026-06-10 — CRM-NOTE-1: second governed CRM action type (grounded context note) (branch `claude/crm-note-1-grounded-context-note`)

**Mandate-authorized in-thesis breadth.** The biggest buyer-visible liability
was that every governed primitive was demonstrated on ONE action type
(`crm.task.create`) — "it only makes follow-up tasks." This adds a second,
genuinely valuable governed write that proves the lifecycle generalizes. Still
inside the V1 fence (operating-plan §0 already scopes "tasks/notes"); no new
channel, no autonomy.

**What changed:**

- Mira now proposes a `crm.note.create` **grounded account-context note**
  alongside the task per fit account (only when grounding evidence exists, so
  never an empty note). The note carries the same evidence pack; its body is
  human-readable account context with the governance trail (reviewed/approved,
  cognitia\_\* lineage, "see the Why panel"), built deterministically from the
  action row so the GOV-1 preview==write invariant still holds for notes.
- engagementContent gives notes their own honest human framing (no raw
  evidence ids); the task body is likewise cleaned to "grounded in N CRM facts".
- The note flows through the ENTIRE governed lifecycle, proven end to end:
  preview (→ notes object, hs_note_body), approve (mandatory reason), execute
  (one provenance-stamped note), undo (reversible archive), rationale (WHY
  generalizes), and it surfaces as its own LEARN-1 scorecard segment.

**Proof:** `crmNote.test.ts` (+5) — both types proposed; typed note preview;
full approve→execute→undo; rationale; scorecard segment. Golden gate stayed
green throughout (minProposals is a floor; notes target the same selected
accounts so suppression/targeting invariants hold). Count assertions in the
lifecycle/preflight tests updated to the dual-type behavior and strengthened to
assert both types are present.

**284 tests green (49 files); typecheck + format green.**

---

## 2026-06-10 — RUN-1: run/plan review surface (branch `claude/run-1-run-plans`)

**In-thesis breadth (the governed answer to "campaigns").** A Mira run already
groups the actions it proposed (`agent_run_id`); this makes that grouping the
operator's reviewable unit of work — closing the buyer-mental-model gap
("where are my campaigns?") without multichannel, by reusing the run grouping
and batch-approve already present.

**What changed:**

- `Repository.listAgentRuns(tenantId)` (newest first) — added to the contract
  and BOTH engines (in-memory + Kysely/Postgres), proven by the shared
  repository contract on PGlite.
- `apps/api/src/runPlans.ts` — pure `buildRunPlans(runs, actions)`: per-run
  rollup (total / proposed / approved / rejected / executed / rolled_back +
  action-type counts) and `fully_reviewed` (true only when nothing is still
  awaiting a decision).
- `GET /agent-runs` (read-only, viewer-allowed, tenant-scoped).
- Console: a "Runs" panel — when, objective, action mix, awaiting/approved/
  rejected/executed counts, and a review-complete indicator.

**Proof:** `runPlans.test.ts` (+6) — rollup by approval/execution/type;
`fully_reviewed` false while any action is pending and false for an empty run;
endpoint 401/tenant-scoping; rollup reflects live decisions. Repository contract
covers `listAgentRuns` on memory AND Postgres.

**290 tests green (51 files); typecheck + format green.**
