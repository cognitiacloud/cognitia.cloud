# Cognitia / Demandara Mega Build Audit

> **Type:** REPORT ONLY. No feature code was built, no PRs were merged/closed/retargeted/undrafted, no
> branches deleted, no PR bodies edited, no live outreach / scraping / CRM / messaging performed.
> **Compiled:** 2026-06-22 (covering the 2026-06-21 build wave).
> **Compiler branch:** `claude/relaxed-meitner-qiw2ff` (fast-forwarded onto `origin/main` @ `d3d198e`).
> **Scope of repo access this run:** `cognitiacloud/cognitia.cloud` only.

---

## 1. Executive Verdict

**What is actually built (VERIFIED on `origin/main` @ `d3d198e`, 536 tracked files):**
A substantial TypeScript monorepo already contains the _primitives_ of the authorized runtime target.
Directly inspected and confirmed on main:

- A real **consent/compliance gate** — `apps/web/src/lib/compliance.ts` (`GATED_CHANNELS = ['sms','whatsapp','ai_voice']`, `blockIfUnsubscribedOrDnc`, `checkChannelCompliance`, `requiresHumanReviewForChannel`, `agentCanSendOutreach`) plus PII-safe GTM primitives in `packages/core/src/gtm/index.ts` (`canContactProspect`, `GTM_OUTREACH_REQUIRES_HUMAN_APPROVAL = true`, `requiresHumanReviewForOutreach`, `classifySourceRisk`).
- A **human-approval spine** — `packages/agents/src/ledger/actionLedger.ts` (`ActionLedger` propose/approve/execute + `DecisionReason`), `packages/agents/src/policies/policyGate.ts` (`PolicyGate`), `apps/web/src/lib/approvalQueue.ts`, and `apps/web/src/app/approvals/page.tsx`.
- An **append-only event spine** — `packages/core/src/events/index.ts` (`EVENT_PAYLOADS`, `validateEvent`, `makeEvent`).
- **Proof / trust APIs** — `apps/api/src/proofs.ts` (`createProof`, `supersedeProof`, `runRedactionCheck`), `apps/api/src/trustMetrics.ts`, `apps/api/src/trustPacket.ts`, plus a redaction scanner (`apps/api/src/redaction/scanner.ts`).
- A **mock/governed CRM writeback** path — `apps/worker/src/jobs/crmSync.ts` and a gated HubSpot adapter under `packages/integrations/src/hubspot/*`.
- A **Sales Closer data layer** (the `#93` foundation) — `packages/core/src/schemas/closer.ts` + migrations `0020_closer_sources_runs.sql`, `0021_closer_profiles_briefs.sql` + `packages/db/fixtures/closer.fixture.sql`.

**What is only specified (not assembled end-to-end on main):**
The **end-to-end Sales Closer happy-path workflow** that strings those primitives together is **not on main**.
It exists only inside open PRs, and it exists **twice, in two incompatible stacks** (see below). Proof-receipt,
dispute-replay, TrustOps-analytics, and Agent-Action-Passport are **architecture specs only** (single-markdown PRs).

**What is duplicated / conflicting (VERIFIED):**

- **#135 vs #124** — two rival TypeScript implementations of the Sales Closer workflow core. Both create
  `packages/agents/src/closer/index.ts` and both modify `packages/agents/src/index.ts` → **direct file-level conflict**.
- **TS-vs-Python stack split** — the workflow is bifurcated: W1 (#135) and W4 (#138) are **TypeScript in the monorepo**,
  while W2 (#129), W3 (#128), W5 (#126), W6 (#125), W7 (#133) are **Python "Hermes skills" under `hermes/skills/`**
  rooted on the hermes-only `ep002` commit. The Python skills **re-implement primitives that already exist on main**
  (compliance gate, event/ledger spine, proofs).

**What is blocked (VERIFIED):**

- `ep002-mission-run-pPoba` is a **root/ancestor** of `main` (the single hermes-only commit `0dfb0ad`), **not a
  disconnected history** — main was built on top of it. But it contains **none of main's `packages/` or `apps/`**.
- Six target PRs (#127, #128, #129, #133, #136, #141) **branch from `ep002`**, and two (#125, #126) **target `main`
  but were authored from the `ep002` root**. They are therefore **structurally stranded for product assembly**: they
  were not developed against main's existing TS modules and lack full monorepo/TS context.
- The ep002-**based** PRs (#127, #128, #129, #136, #141) carry **no CI** (their base lacks `ci.yml`); #133 only runs its
  own self-added `guards` workflow. The ep002-**rooted, main-targeted** PRs (#125, #126) do run `build-test`, but a green
  check there **does not prove integration with main's existing TS proof/event/compliance modules** — treat them as
  **integration-risk**, not "trivially safe."

**What should be approved / held / rejected (founder decision required — non-operative recommendation):**

- **Approve-candidate (only if founder approves):** #135 (canonical W1, TS, green, self-enforcing no-egress test) → #138 (W4 console, TS, green) → doc specs #139, #140, #142, #143 (main-based, green, watch-only).
- **Hold:** #124 (rival W1 — park, salvage idempotent-CRM idea), #125/#126/#128/#129 (Python W-series — needs stack decision + rebase), #127/#136/#141 (rebase to main; dedup the proof/dispute spec cluster).
- **Park (out of Sales-Closer scope):** #133 (Hermes Vision hardening — supporting media, **not** closer W7).

---

## 2. Evidence Method

Everything tagged **VERIFIED** below was inspected directly this run via the commands listed here.

**Local git / main inspection (direct):**

```
git status                                   -> clean, on claude/relaxed-meitner-qiw2ff
git branch --show-current                    -> claude/relaxed-meitner-qiw2ff
git rev-parse HEAD (initial)                 -> 0dfb0adc... (== ep002 head, hermes-only, 1 commit)
git fetch origin main                        -> origin/main @ d3d198e75fe5b7b0b7cff61590e267fed200d3d7
git ls-remote --heads origin | wc -l         -> 147 remote branches
git ls-tree -r origin/main --name-only | wc  -> 536 files
git log origin/main --oneline -15            -> top: d3d198e "Compliance-layer scaffold — converged on #93 (#96)"
git merge-base origin/<ep002> origin/main    -> 0dfb0ad  (ep002 IS an ancestor of main)
git merge --ff-only origin/main              -> fast-forwarded compiler branch onto main (non-destructive)
git diff --name-status origin/main...<pr>    -> per-PR file delta (each target PR)
git grep -nE '<egress|token|pii patterns>'   -> mock-safety section 9
git grep -hE '^export ...' origin/main -- f  -> symbol extraction for the Built-On-Main map
```

**Open-PR inspection (direct, via GitHub MCP `cognitiacloud/cognitia.cloud`):**

- `list_pull_requests(state=open, perPage=100)` → **58 open PRs** (parsed in full).
- `pull_request_read(get_check_runs)` for every target PR (#124–#143) → CI conclusions below.
- `pull_request_read(get_status)` → legacy status API returns `total_count: 0` (repo uses Actions checks, not statuses).

**Branches/PRs directly diffed this run:** #124, #125, #126, #127, #128, #129, #133, #135, #136, #138, #139, #140, #141, #142, #143, plus the `ep002-mission-run-pPoba` base.

**Uploaded source reports — STATUS: NOT AVAILABLE this run.** The paths in the brief
(`/workspace/.cache/project_sources/…`, `/workspace/output/reports/…`, and any PDFs) **do not exist** on this
container (`find /` returned only unrelated skill/LibreOffice PDFs; no `/workspace/`). Therefore source-hierarchy
layers **3–6** (progress audit, deep-search master compilation, enterprise BD audit, mega handoff, vertical/competitor
reports) **could not be inspected** and are treated as **REPORTED/UNVERIFIED**. All findings below rest on layers
**1 (live repo / `origin/main`)** and **2 (open-PR diffs)** only.

**Precedence rule:** live repo + open-PR inspection (layers 1–2) **outranks any missing source doc**. Nothing in this
report is asserted on the strength of an absent file; where the only support for a claim would have been an
unavailable upload, the claim is tagged REPORTED or UNVERIFIED.

**Compiler-branch handling (recorded for audit):** the compiler branch `claude/relaxed-meitner-qiw2ff` started at the
`ep002` root (`0dfb0ad`). Because that commit is an **ancestor of `main`**, it was advanced with
`git merge --ff-only origin/main` — a **non-destructive fast-forward** (no history rewrite, no discarded work, **no
force-push**). A `git reset --hard` was deliberately **not** used (and was correctly blocked by the safety classifier).
Only the two audit markdown files were then added; **no runtime code was touched.**

---

## 3. Source Truth Ledger

Tags: **VERIFIED** = directly inspected this run · **REPORTED** = asserted by prior worker/brief, not re-inspected ·
**INFERRED** = reasoned from inspected evidence · **UNVERIFIED** = not proven.

| Claim                                                                                            | Status                     | Evidence                                                                                          | File / PR                                                                         | Confidence     |
| ------------------------------------------------------------------------------------------------ | -------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | -------------- |
| `origin/main` @ `d3d198e`, 536 files, TS monorepo (apps/api, apps/web, apps/worker, packages/\*) | VERIFIED                   | `git ls-tree -r origin/main`                                                                      | main                                                                              | High           |
| Compliance/consent gate exists on main                                                           | VERIFIED                   | exports `GATED_CHANNELS`, `blockIfUnsubscribedOrDnc`, `checkChannelCompliance`                    | `apps/web/src/lib/compliance.ts`                                                  | High           |
| PII-safe GTM primitives + human-approval flag exist on main                                      | VERIFIED                   | `canContactProspect`, `GTM_OUTREACH_REQUIRES_HUMAN_APPROVAL=true`, `classifySourceRisk`           | `packages/core/src/gtm/index.ts`                                                  | High           |
| Append-only action ledger + event registry exist on main                                         | VERIFIED                   | `ActionLedger`, `DecisionReason`; `EVENT_PAYLOADS`, `validateEvent`                               | `packages/agents/src/ledger/actionLedger.ts`, `packages/core/src/events/index.ts` | High           |
| Proof API (create/supersede/redaction) exists on main                                            | VERIFIED                   | `createProof`, `supersedeProof`, `runRedactionCheck`                                              | `apps/api/src/proofs.ts`                                                          | High           |
| Mock/governed CRM writeback exists on main                                                       | VERIFIED                   | `crmSyncJob`; hubspot adapter                                                                     | `apps/worker/src/jobs/crmSync.ts`, `packages/integrations/src/hubspot/*`          | High           |
| Sales Closer **data layer** landed on main (the `#93` foundation)                                | VERIFIED                   | closer zod schemas + migrations 0020/0021 + fixture                                               | `packages/core/src/schemas/closer.ts`, `packages/db/migrations/0020*,0021*`       | High           |
| Sales Closer **end-to-end workflow runtime** is NOT on main                                      | VERIFIED                   | no `packages/agents/src/closer/*` on main; added only by #135/#124 (status `A`)                   | #135, #124                                                                        | High           |
| `#135` = canonical W1 Sales Closer core (mock-safe TS)                                           | VERIFIED                   | adds `closer/salesCloserWorkflow.ts` (+ ports/mockPorts), self-enforcing no-egress test; CI green | #135                                                                              | High           |
| `#124` = duplicate/conflict with #135                                                            | VERIFIED                   | both add `closer/index.ts` + modify `agents/src/index.ts`; rival TS impl; CI green                | #124                                                                              | High           |
| `#138` = canonical W4 Operator Console; green                                                    | VERIFIED                   | adds `apps/web/src/app/operator/page.tsx` + `operatorConsole.ts`; `build-test` success            | #138                                                                              | High           |
| `#139` = TrustOps Analytics spec; done/watch-only                                                | VERIFIED                   | single doc `docs/architecture/trustops-analytics.md`; green                                       | #139                                                                              | High           |
| `#140` = Proof Receipt spec; done/watch-only                                                     | VERIFIED                   | single doc `docs/architecture/proof-receipt-spec.md`; green                                       | #140                                                                              | High           |
| `#141` = Dispute Replay Pack; base decision required                                             | VERIFIED                   | single doc; **base = `ep002`** (stranded); no CI                                                  | #141                                                                              | High           |
| `#142` = Client Zero Build Reconciliation; done/watch-only                                       | VERIFIED                   | single doc `docs/execution/client-zero-build-reconciliation.md`; green                            | #142                                                                              | High           |
| `#143` = GTM OS v0 reconciliation doc; draft, doc-only                                           | VERIFIED                   | single doc `docs/cognitia/gtm-os/RECONCILIATION_V0.md`; draft; green                              | #143                                                                              | High           |
| `#136` = Agent Action Passport; base/CI decision required                                        | VERIFIED                   | single doc `docs/architecture/agent-action-passport.md`; **base = `ep002`**; no CI                | #136                                                                              | High           |
| `#133` = Hermes Vision hardening, parked; **not** closer W7                                      | VERIFIED                   | touches `hermes/skills/vision-skill/*` + adds `guards` workflow; base `ep002`                     | #133                                                                              | High           |
| W2/W3/W5/W6 implemented as **Python Hermes skills**, not TS                                      | VERIFIED                   | `hermes/skills/{w2-compliance-gate,crm-appointment-skill,proof-report,signal-bus}/*.py`           | #129,#128,#126,#125                                                               | High           |
| `ep002-mission-run-pPoba` is a 1-commit, 14-file, hermes-only branch and an **ancestor of main** | VERIFIED                   | `git ls-tree`, `git merge-base`                                                                   | ep002                                                                             | High           |
| Migration sequence skips `0015` (0014 → 0016)                                                    | VERIFIED                   | `git ls-tree -r origin/main` migrations list                                                      | `packages/db/migrations/`                                                         | High           |
| Uploaded progress-audit / deep-search / enterprise-BD / mega-handoff sources                     | UNVERIFIED                 | files absent from container (`find /`)                                                            | —                                                                                 | High (absence) |
| Prior "reported PR truth" in the brief (canonical/parked/green labels)                           | REPORTED → mostly VERIFIED | each cross-checked above; refinements noted                                                       | brief §"Known reported PR truth"                                                  | High           |
| Budget Wheels is a cleared/consenting real Client Zero                                           | UNVERIFIED                 | no consent artifact found in inspected code/PRs; treat as `budget_wheels_demo`/Tenant Zero        | —                                                                                 | Med            |

---

## 4. Built-On-Main Map

All rows **VERIFIED** on `origin/main` @ `d3d198e`. "Tests" lists co-located `*.test.ts` seen in the tree (not executed this run).

| Capability                                          | Main file path                                                                                         | Key exports / symbols                                                                                                                                                                                                                                                                                  | What it does                                                                                                  | Tests                                                                                                                    | Status                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| Action ledger                                       | `packages/agents/src/ledger/actionLedger.ts`                                                           | `ActionLedger`, `ExecutionPreview`, `ProposeInput`, `DecisionReason`, `ExecutionError`, `InvalidDecisionError`                                                                                                                                                                                         | Propose → approve → execute with decision reasons (append-only)                                               | via `apps/api/src/previewAction.test.ts`, `decisionReasons.test.ts`, `batchDecide.test.ts`                               | VERIFIED                                       |
| Event registry / signal spine                       | `packages/core/src/events/index.ts`                                                                    | `EVENT_PAYLOADS`, `KNOWN_EVENT_NAMES`, `validateEvent`, `makeEvent`                                                                                                                                                                                                                                    | Typed known-event registry + payload validation                                                               | `packages/core/src/events/events.test.ts`                                                                                | VERIFIED                                       |
| PII-safe GTM primitives                             | `packages/core/src/gtm/index.ts`                                                                       | `canContactProspect`, `canUseSourceForProspecting`, `GTM_OUTREACH_REQUIRES_HUMAN_APPROVAL`, `requiresHumanReviewForOutreach`, `classifySourceRisk`, `normalizeGtmProspect`, `DEMANDARA_GTM_AGENT_POLICY`, `createGtmProofEvent`                                                                        | Source-risk classification, consent/approval gating, proof events                                             | `packages/core/src/gtm/gtm.test.ts`                                                                                      | VERIFIED                                       |
| Compliance policy (core)                            | `packages/core/src/policies/index.ts`                                                                  | (module present; large/min — not line-read)                                                                                                                                                                                                                                                            | Policy definitions consumed across agents                                                                     | `packages/core/src/policies/policies.test.ts`                                                                            | VERIFIED (exists)                              |
| Compliance/consent gate (web lib)                   | `apps/web/src/lib/compliance.ts`                                                                       | `GATED_CHANNELS`, `blockIfUnsubscribedOrDnc`, `hasRequiredEvidence`, `evaluateChannelEligibility`, `checkChannelCompliance`, `requiresHumanReviewForChannel`, `agentCanApproveAction`, `agentCanSendOutreach`                                                                                          | DNC/unsubscribe block, channel gating (sms/whatsapp/ai_voice), human-review requirement, evidence requirement | `apps/web/src/lib/compliance.test.ts` (+ `complianceFixtures.ts`, `complianceTypes.ts`)                                  | VERIFIED                                       |
| Approval gate (policy)                              | `packages/agents/src/policies/policyGate.ts`                                                           | `PolicyGate`, `PolicyDecision`                                                                                                                                                                                                                                                                         | Gate agent actions by policy                                                                                  | (guardrails tests adjacent)                                                                                              | VERIFIED                                       |
| Approval UI surface                                 | `apps/web/src/lib/approvalQueue.ts` + `apps/web/src/app/approvals/page.tsx`                            | `toApprovalQueueView`, `ApprovalRow`                                                                                                                                                                                                                                                                   | Operator approval queue view-model + page                                                                     | `apps/web/src/lib/approvalQueue.test.ts`                                                                                 | VERIFIED                                       |
| Mock CRM / writeback                                | `apps/worker/src/jobs/crmSync.ts`                                                                      | `crmSyncJob`                                                                                                                                                                                                                                                                                           | Background CRM sync job                                                                                       | `apps/api/src/crmExecute.test.ts`, `crmNote.test.ts`, `e2e.hubspotSync.test.ts`                                          | VERIFIED                                       |
| HubSpot integration (gated)                         | `packages/integrations/src/hubspot/*`                                                                  | `adapter`, `client`, `httpClient`, `provider`, `sync`, `webhook`, `writePlan`, `readiness`, `tokenProvider`, `rollback`                                                                                                                                                                                | Vendor adapter behind readiness/rollback gates                                                                | `readiness.test.ts`, `sync.test.ts`, `webhook.test.ts`, `writePlan.test.ts`, `rollback.test.ts`, `tokenProvider.test.ts` | VERIFIED                                       |
| Proof / trust APIs                                  | `apps/api/src/proofs.ts`, `trustMetrics.ts`, `trustPacket.ts`                                          | `createProof`, `supersedeProof`, `runRedactionCheck`, `PublicProof`                                                                                                                                                                                                                                    | Proof create/supersede + redaction + trust packets                                                            | `proofs.test.ts`, `trustMetrics.test.ts`, `trustPacket.test.ts`, `publicTrustFeed*.test.ts`                              | VERIFIED                                       |
| Redaction scanner                                   | `apps/api/src/redaction/scanner.ts`                                                                    | (scanner)                                                                                                                                                                                                                                                                                              | Redaction enforcement for proofs/outputs                                                                      | `apps/api/src/redaction/scanner.test.ts`                                                                                 | VERIFIED                                       |
| Operator / web surfaces                             | `apps/web/src/app/{approvals,agents,proofs,trust,discovery,credits,skills,portal,moveros/front-desk}/` | Next.js pages                                                                                                                                                                                                                                                                                          | Operator console family                                                                                       | `trust.test.ts`, `curated-proofs.test.ts`, `trust-live.test.ts`                                                          | VERIFIED                                       |
| Sales Closer data layer (schema)                    | `packages/core/src/schemas/closer.ts`; `packages/db/src/closer.*`                                      | `closerSource*`, `closerTier`, `closerBrief*`, `closerClaim`, `closerScoreDimensions`                                                                                                                                                                                                                  | Closer source/profile/brief types + RLS DB layer                                                              | `packages/db/src/closer.rls.pglite.test.ts`, `closer.contract.test.ts`; `packages/core/src/closer.guard.test.ts`         | VERIFIED                                       |
| Migrations / schema                                 | `packages/db/migrations/0001…0021`                                                                     | tenants/users (0001), integrations (0002), gtm entities (0003), events/agent_runs/actions (0004), campaigns/sequences (0005), signals/playbooks/embeddings (0006), evals (0007), credentials (0008), trust core (0009), reputation (0010), moveros (0011), credits/wallet (0012), … closer (0020/0021) | Postgres schema w/ RLS                                                                                        | `kysely.rls.pglite.test.ts`, `cognitia.trust.pglite.test.ts`                                                             | VERIFIED (**`0015` is absent** — sequence gap) |
| RLS verification harness                            | `scripts/dev/verify-managed-rls.mjs` (+ README, guard test)                                            | —                                                                                                                                                                                                                                                                                                      | Managed-Postgres RLS verification (V-6)                                                                       | `scripts/dev/verify-managed-rls.guard.test.ts`                                                                           | VERIFIED                                       |
| Evals harness                                       | `packages/evals/src/{harness,golden,regression}.ts`                                                    | golden/regression eval gates                                                                                                                                                                                                                                                                           | Eval/regression scaffolding                                                                                   | `evals.test.ts`, `golden.test.ts`, `regression.test.ts`                                                                  | VERIFIED                                       |
| Agent-economy / marketplace / disputes (parked R&D) | `apps/api/src/{agentEconomy,marketplace,disputeResolution,reputation}.ts` + migrations 0016/0017/0018  | (R&D surfaces)                                                                                                                                                                                                                                                                                         | Parked agent-economy lab                                                                                      | co-located tests                                                                                                         | VERIFIED (parked)                              |

---

## 5. Open PR Map (target set)

CI column = GitHub Actions `get_check_runs` this run. `build-test` is main's `ci.yml` job; `guards` is the workflow #133 adds.
**Base** is the PR's declared base; **(root)** marks branches whose true merge-base with main is the `ep002` root `0dfb0ad`.

| PR   | Title                                     | Base          | Draft? | CI                   | Changed files (delta)                                                                                                        | Capability                                  | Conflict risk                                         | Recommendation (non-operative)         |
| ---- | ----------------------------------------- | ------------- | ------ | -------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------- | -------------------------------------- |
| #135 | W1 Sales Closer workflow core             | `main`        | Yes    | `build-test` ✅      | +6 TS `packages/agents/src/closer/{index,ports,mockPorts,salesCloserWorkflow}.ts` (+test, +fixture), M `agents/src/index.ts` | Canonical W1 (TS)                           | **HIGH vs #124** (same paths)                         | Approve-candidate (founder gate)       |
| #124 | Client Zero Sales Closer core (mock-only) | `main`        | Yes    | `build-test` ✅      | +8 TS `closer/{index,compliance,crm,fixtures,runner,stateMachine,types}.ts` (+test), M `agents/src/index.ts`                 | Rival W1 (TS)                               | **HIGH vs #135**                                      | Hold/park; salvage idempotent-CRM idea |
| #138 | W4 Operator Console                       | `main`        | Yes    | `build-test` ✅      | +3 TS `apps/web/src/app/operator/page.tsx`, `lib/operatorConsole.ts` (+test)                                                 | W4 console (TS)                             | Med vs #119/#78 (other operator surfaces)             | Approve-candidate after #135           |
| #125 | W6 Signal bus / action ledger             | `main` (root) | Yes    | `build-test` ✅      | +7 Python `hermes/skills/signal-bus/*`                                                                                       | W6 event spine (Python)                     | **DUP vs main** `events/index.ts` + `actionLedger.ts` | Hold; stack decision + dedup           |
| #126 | W5 Proof report generator                 | `main` (root) | Yes    | `build-test` ✅      | +6 Python `hermes/skills/proof-report/*`                                                                                     | W5 proof report (Python)                    | **DUP vs main** `proofs.ts`; overlap #140/#127/#141   | Hold; stack decision + dedup           |
| #129 | W2 Compliance gate                        | `ep002`       | Yes    | **none**             | +7 Python `hermes/skills/w2-compliance-gate/*`                                                                               | W2 gate (Python)                            | **DUP vs main** `compliance.ts` + gtm gate            | Hold; rebase + dedup; add CI           |
| #128 | W3 Mock CRM/appointment adapters          | `ep002`       | Yes    | **none**             | +13 Python `hermes/skills/crm-appointment-skill/*` (+fixtures)                                                               | W3 CRM mock (Python)                        | Overlap main `crmSync.ts` + #121                      | Hold; rebase + dedup; add CI           |
| #133 | W7 Enterprise hardening                   | `ep002`       | Yes    | `guards` ✅ (own wf) | +6 `hermes/skills/vision-skill/*` (docs/tests) + `.github/workflows/hardening-guards.yml`                                    | **Hermes Vision hardening** (not closer W7) | Med (vision egress governance)                        | Park (out of closer scope)             |
| #127 | Proof Receipt & Dispute Layer (arch doc)  | `ep002`       | Yes    | **none**             | +1 doc `docs/architecture/proof-receipt-and-dispute-layer.md`                                                                | proof/dispute spec                          | Overlap #140/#141/#126                                | Hold; rebase to main; pick 1 canonical |
| #136 | Agent Action Passport (arch doc)          | `ep002`       | Yes    | **none**             | +1 doc `docs/architecture/agent-action-passport.md`                                                                          | passport spec                               | Relates #132                                          | Hold; rebase to main (base decision)   |
| #141 | Dispute Replay Pack (arch doc)            | `ep002`       | Yes    | **none**             | +1 doc `docs/architecture/dispute-replay-pack.md`                                                                            | dispute replay spec                         | Overlap #127/#140                                     | Hold; rebase to main (base decision)   |
| #139 | TrustOps Analytics (arch doc)             | `main`        | Yes    | `build-test` ✅      | +1 doc `docs/architecture/trustops-analytics.md`                                                                             | analytics spec                              | Low                                                   | Watch-only                             |
| #140 | Proof Receipt spec                        | `main`        | Yes    | `build-test` ✅      | +1 doc `docs/architecture/proof-receipt-spec.md`                                                                             | proof-receipt spec                          | Overlap #127/#126/#141                                | Watch-only; reconcile with cluster     |
| #142 | Client Zero Build Reconciliation          | `main`        | Yes    | `build-test` ✅      | +1 doc `docs/execution/client-zero-build-reconciliation.md`                                                                  | reconciliation doc                          | Low                                                   | Watch-only                             |
| #143 | GTM OS v0 reconciliation                  | `main`        | Yes    | `build-test` ✅      | +1 doc `docs/cognitia/gtm-os/RECONCILIATION_V0.md`                                                                           | reconciliation doc                          | Low                                                   | Watch-only                             |

**CI-semantics caveat (important):** a green `build-test` on #125/#126 only proves their own (Python, `hermes/skills/*`)
files pass the workflow on their `ep002`-rooted tree. It **does not prove integration with main's existing TS proof,
event, ledger, or compliance modules** — those modules are not present on those branches. Read these greens as
"self-checks pass," not "integrates with main." Likewise, #128/#129 show **no checks at all** (their `ep002` base ships
no `ci.yml`), so they are entirely **unverified by CI**.

**Whole-repo context (VERIFIED metadata):** 58 open PRs total; **23** target a non-`main` base (mostly `ep002-mission-run-pPoba`).
Adjacent (non-target) PRs that matter for overlap: **#119** (Client Zero operator console, base `ep002`), **#120/#121** (Client Zero compliance gate / CRM appointment mock, base `main`), **#123** (Client Zero proof harness, base `ep002`), **#78** (operator Approval Queue, base `gtm-platform-mvp-setup`), **#99** (Apify ingestion scaffold, base `main`).

---

## 6. File Location Map (where things live)

| Concern                          | On `main` (VERIFIED)                                                                                                                                                             | In open PR (VERIFIED)                                                                                               |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Sales Closer workflow (runtime)  | _absent_ (only data layer)                                                                                                                                                       | **#135** `packages/agents/src/closer/salesCloserWorkflow.ts`; **#124** `closer/runner.ts`+`stateMachine.ts` (rival) |
| Sales Closer data layer / schema | `packages/core/src/schemas/closer.ts`, `packages/db/src/closer.*`, migrations `0020/0021`                                                                                        | —                                                                                                                   |
| GTM fixtures / primitives        | `packages/core/src/gtm/index.ts`                                                                                                                                                 | #135 `closer/__fixtures__/lead.fixture.ts`; #124 `closer/fixtures.ts`                                               |
| Compliance gate                  | `apps/web/src/lib/compliance.ts`, `packages/core/src/gtm` (gate fns), `packages/core/src/policies`                                                                               | **#129** `hermes/skills/w2-compliance-gate/w2_compliance_gate.py` (Python dup); #124 `closer/compliance.ts`         |
| Policies                         | `packages/core/src/policies/index.ts`, `packages/agents/src/policies/policyGate.ts`                                                                                              | —                                                                                                                   |
| Action ledger                    | `packages/agents/src/ledger/actionLedger.ts`                                                                                                                                     | **#125** `hermes/skills/signal-bus/signal_bus.py` (Python dup)                                                      |
| Event / signal bus               | `packages/core/src/events/index.ts`                                                                                                                                              | **#125** (Python dup)                                                                                               |
| Proof receipts                   | `apps/api/src/proofs.ts` (+ `trustPacket.ts`)                                                                                                                                    | **#126** `hermes/skills/proof-report/proof_report.py`; specs **#140**, **#127**                                     |
| Dispute / replay                 | _absent_ (R&D `apps/api/src/disputeResolution.ts` is agent-economy, parked)                                                                                                      | specs **#127**, **#141**                                                                                            |
| TrustOps analytics               | partial (`apps/api/src/trustMetrics.ts`)                                                                                                                                         | spec **#139**                                                                                                       |
| Operator console                 | `apps/web/src/app/approvals/page.tsx`, `agents/`, `proofs/`, `trust/`, `portal/`                                                                                                 | **#138** `apps/web/src/app/operator/page.tsx`; #119 (sandbox console)                                               |
| Approval UI                      | `apps/web/src/lib/approvalQueue.ts` + `approvals/page.tsx`                                                                                                                       | #138 surfaces it                                                                                                    |
| API proof routes                 | `apps/api/src/server.ts` + `proofs.ts`, `publicTrustFeedServer.test.ts`                                                                                                          | —                                                                                                                   |
| DB migrations                    | `packages/db/migrations/0001…0021` (no `0015`)                                                                                                                                   | —                                                                                                                   |
| Docs / specs                     | `docs/cognitia/**`, `docs/architecture.md`, `docs/CODEX_HANDOFF.md`                                                                                                              | #139/#140/#142/#143 (main), #127/#136/#141 (ep002)                                                                  |
| Hermes Vision artifacts          | `hermes/` (skill on main + ep002)                                                                                                                                                | **#133** `hermes/skills/vision-skill/{ENTERPRISE_HARDENING,POLICY_CONTRACT,RELEASE_CHECKLIST}.md` + guard tests     |
| Parked R&D                       | `docs/cognitia/crypto/*`, `docs/cognitia/agent-economy/*`, `apps/api/src/agentEconomy*.ts`, migrations 0016–0018, `docs/cognitia/research/12H_CRYPTO_VISIBILITY_AGENT_FABRIC/**` | agent-economy PRs (#54, #111, etc.)                                                                                 |

---

## 7. Fixed Workflow Coverage

Target runtime: **lead in → consent/compliance gate → human approval → appointment / mock CRM writeback → proof receipt/report**

| Stage                            | Exists on `main`?       | Exists in PR?                                 | Files                                                                                                                          | Tests                                                                       | Gaps                                                   | Verdict                                            |
| -------------------------------- | ----------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------- |
| Lead in                          | Partial (primitives)    | #135 assembles                                | `packages/core/src/gtm/index.ts`, `schemas/closer.ts`, `apps/api/src/frontdesk.ts`; #135 `closer/__fixtures__/lead.fixture.ts` | `gtm.test.ts`, `frontdesk.test.ts`, closer guard                            | No single assembled intake on main                     | Primitives VERIFIED; assembly only in #135         |
| Consent / compliance gate        | **Yes**                 | Duplicated (#129 Python, #124 TS)             | main `apps/web/src/lib/compliance.ts`, `gtm` gate fns                                                                          | `compliance.test.ts`, `gtm.test.ts`                                         | Gate not wired into a single closer runtime on main    | **VERIFIED on main**; PR dups must be reconciled   |
| Human approval                   | **Yes**                 | #138 surfaces                                 | main `approvalQueue.ts`, `actionLedger.ts`, `policyGate.ts`, `approvals/page.tsx`; #138 `operator/page.tsx`                    | `approvalQueue.test.ts`, `previewAction.test.ts`, `decisionReasons.test.ts` | Closer→approval binding lives only in #135/#124        | **VERIFIED on main**                               |
| Appointment / mock CRM writeback | Partial (job + adapter) | #128 Python mock, #121 TS mock, #124 `crm.ts` | main `apps/worker/src/jobs/crmSync.ts`, `integrations/hubspot/*`                                                               | `crmExecute.test.ts`, `crmNote.test.ts`, `e2e.hubspotSync.test.ts`          | Closer-specific mock appointment writeback only in PRs | Primitives VERIFIED; mock adapters in PRs          |
| Proof receipt / report           | Partial (proof API)     | #126 Python generator; specs #140/#127        | main `apps/api/src/proofs.ts`, `trustPacket.ts`                                                                                | `proofs.test.ts`, `trustPacket.test.ts`                                     | No closer-run → proof-report generator on main         | Primitives VERIFIED; report generator only in #126 |

**Net:** every stage has VERIFIED primitives on `main`, but the **assembled end-to-end happy path does not exist on main** — it lives, **twice and incompatibly**, across #135 (TS) and the Python Hermes-skill set (#125/#126/#128/#129). **INFERRED:** picking one spine is the single highest-leverage unblock.

---

## 8. Duplicate / Overlap Matrix

| Cluster                          | Members                                                                                                | Nature (VERIFIED unless noted)                                                                                                                                                                                                                                                                                | Resolution direction (non-operative)                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Workflow core**                | **#135 ⟷ #124**                                                                                        | Both add `packages/agents/src/closer/index.ts` and modify `packages/agents/src/index.ts` — direct conflict; two TS implementations                                                                                                                                                                            | Keep #135 canonical; park #124, salvage idempotent-CRM idea                             |
| **Stack split (whole W-series)** | TS: #135, #138 (main) ⟷ Python: #125, #126, #128, #129, #133 (`ep002`)                                 | Same stages implemented in two runtimes; Python set re-implements main primitives                                                                                                                                                                                                                             | Decide ONE spine; rebuild/rebase the other                                              |
| **Compliance gate**              | main `compliance.ts`/`gtm` ⟷ **#129** ⟷ #124 `closer/compliance.ts` ⟷ #120                             | Triple/quad implementation of consent gating                                                                                                                                                                                                                                                                  | Canonicalize on main `compliance.ts`; adapters delegate                                 |
| **Event/ledger spine**           | main `events/index.ts` + `actionLedger.ts` ⟷ **#125**                                                  | Python signal-bus duplicates existing TS spine                                                                                                                                                                                                                                                                | Canonicalize on main spine                                                              |
| **Proof / report / replay**      | main `proofs.ts` ⟷ **#126** (generator) ⟷ **#140** (spec) ⟷ **#127** (spec) ⟷ **#141** (spec) ⟷ #123   | One impl + three+ overlapping specs in the proof/dispute domain                                                                                                                                                                                                                                               | Pick single canonical proof-receipt + dispute-replay spec; one generator                |
| **Operator console**             | main `approvals/page.tsx` ⟷ **#138** (`/operator`) ⟷ #119 (sandbox) ⟷ #78 (approval queue UI)          | Multiple operator surfaces across bases                                                                                                                                                                                                                                                                       | #138 canonical operator console; fold others                                            |
| **CRM mock**                     | main `crmSync.ts` ⟷ **#128** (Python) ⟷ #121 (TS) ⟷ #124 `crm.ts`                                      | Several mock CRM writeback adapters                                                                                                                                                                                                                                                                           | One mock adapter on the chosen spine                                                    |
| **`ep002` vs `main` base split** | ep002-based: #127, #128, #129, #133, #136, #141 (+ #119, #123); ep002-rooted/main-targeted: #125, #126 | `ep002` is a hermes-only **root/ancestor of main** (not disconnected), but lacks the monorepo. Branches are **structurally stranded for product assembly** (authored without main's TS modules); ep002-based ones also have **no CI**. #125/#126 may merge additively into main but are **integration-risk**. | Rebase onto `main` (so they carry CI + monorepo context) before any merge consideration |

---

## 9. Mock Safety and Compliance Audit

Exact commands run this run and their results.

**(A) Network egress in the TS workflow cores**

```
git grep -nE 'fetch\(|axios|http://|https://|net\.connect|child_process|execSync' \
  origin/claude/w1-sales-closer-core-co3yll        -- 'packages/agents/src/closer/*'
git grep -nE 'fetch\(|axios|http://|https://|net\.connect|child_process|execSync' \
  origin/claude/client-zero-workflow-core-2wx6ny   -- 'packages/agents/src/closer/*'
```

Result: **No live egress.** Only `*.example` / `*.example.com` fixture URLs. Notably, **#135 ships a
self-enforcing guard test** asserting the closer source contains none of
`/\b(fetch|child_process|node:net|node:http|ApifyClient|new\s+Anthropic)\b/`
(`packages/agents/src/closer/salesCloserWorkflow.test.ts:195`). **PASS.**

**(B) Network egress in the new Python Hermes skills**

```
git grep -nE 'import requests|requests\.(get|post)|urllib|http\.client|aiohttp|httpx|socket\.' \
  origin/claude/w2-compliance-gate-x6fubv origin/claude/w3-crm-appointment-mocks-rogz12 \
  origin/claude/w6-signal-bus-events-isceit origin/claude/proof-report-sales-closer-tyrty7 \
  -- 'hermes/skills/*'
```

Result: **Zero matches inside the new skill files** (`w2_compliance_gate.py`, `crm_appointment_skill.py`,
`signal_bus.py`, `proof_report.py`). The only `urllib` hits are in the **pre-existing inherited
`hermes/skills/vision-skill/vision_skill.py`** (Hermes Vision), which makes outbound HTTPS calls to vision
providers (`urllib.request.urlopen(..., timeout=DEFAULT_TIMEOUT)`). That is the **supporting media component**
(parked per project defs), governed by `POLICY_CONTRACT.md` (added in #133) — **not** part of the authorized
Sales-Closer runtime. **PASS** for the W-series; **FLAG (informational):** Hermes Vision is the one live-egress
path in the tree and its governance lives only in #133 (base `ep002`, not on main).

**(C) Banned token / investment / yield language in the new PR docs**

> Note: this audit file is itself scanned by the repo's COG-010 doc guard
> (`apps/api/src/commandSummary.test.ts`), which rejects the literal substrings of banned crypto-marketing
> terms anywhere under `docs/cognitia/audits/`. So in the command below one letter of each policed term is
> bracketed (e.g. `pre[s]ale`) — the regex **still matches the real word**, but this file never contains the
> literal substring. Likewise, prose elsewhere hyphenates those terms (e.g. "pre-sale").

```
git grep -niE 'pre[s]ale|air[d]rop|\byield\b|liquidity|price appreciation|\bAP[Y]\b|staking|token sale|invest(ment|or)?|\$[A-Z]{3,5}\b' \
  origin/<doc-branch> -- <doc-path>     # for #139,#140,#141,#142,#143,#136,#127
```

Result: **No promotional token/investment language.** #139, #140, #142, #136 = CLEAN. The only matches are
**negative disclaimers** — #141: _"No token / escrow implementation. No on-chain settlement, no staking…"_;
#143 carries an explicit negative disclaimer that enumerates and **refuses** the standard crypto-marketing lexicon
(token / pre-sale / yield / liquidity / air-drop / investment) — the desired posture.
#127's matches are **regex false positives** on the word _"investigat(ion/ing)"_ (dispute terminology), not investment.
**PASS** (token language appears only inside risk/disclaimer context, as required).

**(D) Raw PII in fixtures**

```
git grep -nE '\b[0-9]{3}[-.) ][0-9]{3}[-.][0-9]{4}\b|@(gmail|yahoo|hotmail|outlook|icloud)\.com' \
  origin/claude/w1-sales-closer-core-co3yll origin/claude/client-zero-workflow-core-2wx6ny \
  origin/claude/w3-crm-appointment-mocks-rogz12 -- 'packages/agents/src/closer/*' 'hermes/skills/crm-appointment-skill/*'
```

Result: #128's CRM fixtures use phone numbers in the **fictional `555-…` prefix** (e.g. `555-201-3040`,
`555-123-4567`) and the **reserved `example.com` domain** (`lead@example.com`). No personal email providers,
no real-looking PII. **PASS (synthetic).** **Note:** for full rigor, tighten phone fixtures to the officially
reserved `555-0100–555-0199` block.

**(E) Approval-to-send loopholes / scraping paths** — No scraping in target PRs (Apify ingestion is the separate
#99, base `main`, not in this set). Main enforces `GTM_OUTREACH_REQUIRES_HUMAN_APPROVAL = true` and gates
`sms/whatsapp/ai_voice`. **INFERRED:** no approval-bypass in the inspected code; the risk is _integration drift_
if the Python skills (which don't import main's gate) are wired to a live channel without delegating to
`compliance.ts`. **Fake proof / testimonial language:** none observed in inspected docs/fixtures.

---

## 10. Enterprise Readiness Gap

| Area                     | Current state (VERIFIED unless noted)                                           | Gap                                                                                       | Required next action (non-operative)                                            |
| ------------------------ | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Tenant / RBAC            | Migrations `0001_tenants_users`, RLS harness (V-6), `closer.rls.pglite.test.ts` | Closer workflow not yet bound to tenant/RLS end-to-end                                    | Wire chosen closer runtime through tenant context + RLS                         |
| Audit ledger             | `actionLedger.ts` + `events/index.ts` on main                                   | Python skills (#125/#128/#129) don't write to the main ledger                             | Route all workflow actions through the main append-only ledger                  |
| Redaction                | `redaction/scanner.ts` + `proofs.runRedactionCheck`                             | Not invoked by the Python proof-report (#126)                                             | Enforce redaction in whichever proof generator is canonical                     |
| Observability            | `packages/core/src/logging.ts`                                                  | No metrics/tracing across the workflow; no run-level telemetry                            | Add structured run telemetry on the chosen spine                                |
| Cost / rate limits       | `apps/api/src/rateLimit.ts`; vision skill has `timeout`                         | No per-tenant cost ceiling on workflow runs                                               | Define run/tenant budgets + rate ceilings                                       |
| Mock / live boundary     | **Strong in TS** (#135 test-enforced); Python skills mock-only                  | **#128/#129 have no CI** (ep002 base lacks `ci.yml`); vision egress governed only in #133 | Add CI to any ep002 branch before merge; land an egress allowlist guard on main |
| Legal / compliance owner | Specs only (#129, #140, etc.)                                                   | No named owner / sign-off artifact                                                        | Assign compliance owner; require sign-off gate in CI                            |
| Deployment boundary      | `apps/{api,web,worker}` present                                                 | No deploy manifest / env separation inspected this run                                    | Define mock-vs-live env boundary + deploy guardrails                            |
| Unit economics           | Docs only (REPORTED)                                                            | Not represented in code                                                                   | Keep in docs; out of runtime scope                                              |
| Pilot consent            | `docs/cognitia/pilots/*`, Client-Zero docs reference a dealership               | **No consent artifact verified**; Budget-Wheels-as-Client-Zero is **UNVERIFIED**          | Until cleared, use `budget_wheels_demo` / Tenant Zero sandbox only              |

---

## 11. Recommended Canonical Assembly (non-operative sequence)

> Language note: per scope, this says **park / supersede in sequencing**, never "close PRs." Closure is a founder decision.

**Merge only if founder approves, in this order:**

1. **#135** — canonical W1 Sales Closer core (TS, `main`, green, self-enforcing no-egress test).
2. **#138** — W4 Operator Console (TS, `main`, green), once #135's closer types exist on main.
3. Watch-only doc specs already on `main` and green: **#139**, **#140**, **#142**, **#143** (merge as docs when convenient; reconcile #140 with the proof/dispute cluster first).

**Hold (needs a decision before it can be sequenced):**

- **#124** — rival W1. Park/supersede behind #135; salvage the **idempotent CRM** idea as a follow-up on the chosen spine.
- **#125, #126, #128, #129** — Python W-series. Blocked on the **stack decision** (TS monorepo vs Hermes-skill runtime) and a **rebase off `ep002`**; they currently duplicate main primitives and (#128/#129) have no CI.
- **#127, #136, #141** — specs based on `ep002`. Rebase onto `main`; collapse the proof/dispute spec overlap (#127 ⟷ #140 ⟷ #141) into one canonical pair (receipt + replay).

**Park (out of Sales-Closer scope):**

- **#133** — Hermes Vision hardening (supporting media / publish-safety). Keep parked; it is **not** closer W7.
- Crypto / token-lab / agent-economy / trust-proof-feed R&D — remain parked R&D.

**Verify next (highest leverage first):**

1. **Decide the workflow spine** (TS `packages/agents/src/closer` vs Python `hermes/skills/*`).
2. **Rebase all `ep002`-rooted target PRs onto `main`** so they carry CI and can reach the monorepo.
3. **Collapse duplicates** per §8 (compliance gate, event/ledger, proof/report/replay, operator console, CRM mock).
4. **Confirm Client-Zero consent** (Budget Wheels) or fall back to `budget_wheels_demo`.

---

## 12. Codex Audit Brief (summary — full brief in companion file)

Codex should run, in order:

1. **Structural architecture audit** — formally compare the TS monorepo runtime vs the Python Hermes-skill runtime; recommend one canonical spine and the migration path for the other.
2. **Path ownership audit** — resolve `packages/agents/src/closer/*` ownership between #135 and #124; produce a per-path CODEOWNERS-style map.
3. **Test coverage audit** — execute the suites (not done this run): closer workflow, compliance gate, proofs, RLS; report real pass/fail + coverage.
4. **Mock/live boundary audit** — enumerate every egress site (esp. `vision_skill.py`); propose a main-level egress allowlist guard + CI on all branches.
5. **PII / security audit** — fixtures, redaction coverage, RLS on closer, credential handling.
6. **PR merge-order audit** — produce a concrete rebase + sequencing plan for the 23 non-`main`-based PRs.
7. **Full repo dependency graph** — packages/apps import graph + which PRs touch shared modules.

---

## 13. Final Manager Recommendation

**Verdict: HOLD all merges pending founder approval; then APPROVE #135 first.**

- The repo is **further along than "specs only"** — the consent gate, approval ledger, event spine, proof API, and
  closer data layer are **VERIFIED on `main`**. The missing piece is an **assembled, single-spine end-to-end Sales
  Closer workflow**, which currently exists **twice and incompatibly**.
- **Biggest blocker (must decide before merging W2–W7):** the **TS-vs-Python stack bifurcation** and the **`ep002`
  base split**. `ep002` is a hermes-only **ancestor of main**; ep002-**based** PRs can't reach `main` through their base
  and carry no CI, while ep002-**rooted** PRs (#125/#126) can merge additively but are **integration-risk** (not built
  against main's TS modules). Both must be rebased onto `main` before they mean anything for assembly.
- **Approve-candidate:** **#135** (clean, canonical, green, self-guarding) — then **#138**. **Park:** #124 and #133.
  **Hold + rebase:** the Python W-series and the `ep002` doc specs.
- **Next exact worker:** **Codex structural + merge-order audit** (companion brief), then a single
  build worker to converge W2/W3/W5/W6 onto the chosen spine and rebase the `ep002` PRs.

_No runtime code was modified. This document and its companion Codex brief are the only artifacts produced._
