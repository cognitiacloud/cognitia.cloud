# Codex Full-Structure Audit Brief — Cognitia / Demandara

> **Companion to:** `docs/cognitia/audits/MEGA_BUILD_AUDIT_2026-06-21.md`
> **Type:** REPORT-ONLY brief. This document **commissions an audit**; it does not authorize any merge, close,
> retarget, undraft, archive, PR-body edit, branch deletion, or feature code. Codex's job is to **verify and map**,
> then hand a sequencing plan back to the founder.
> **Compiled:** 2026-06-22 (covering the 2026-06-21 wave). **Baseline:** `origin/main` @ `d3d198e` (536 files).
> **Precedence rule:** live repo + open-PR inspection outranks any missing/uploaded source doc.

---

## 0. Why this brief exists

The 2026-06-21 build wave produced an end-to-end "Sales Closer" workflow **twice, in two incompatible runtimes**, plus
a set of overlapping proof/dispute specs, spread across two base branches. The Mega Build Audit established the _facts_;
Codex must now establish the _structural decision inputs_ a founder needs: one canonical spine, a rebase plan, a
dedup plan, and a real (executed) test/coverage + security picture.

**Single most important question for Codex to answer:**

> Should the canonical Sales Closer spine be the **TypeScript monorepo** (`packages/agents/src/closer/*`, as in #135)
> or the **Python Hermes-skill runtime** (`hermes/skills/*`, as in #125/#126/#128/#129)? Produce the migration path
> for whichever is _not_ chosen.

---

## 1. Ground truth Codex must start from (VERIFIED this run)

- `origin/main` @ `d3d198e`, **536 files**, pnpm TS monorepo: `apps/{api,web,worker}`, `packages/{core,agents,db,integrations,evals,workflows}`, `hermes/`, `docs/`, `scripts/`.
- `ep002-mission-run-pPoba` (`0dfb0ad`) is a **1-commit, 14-file, hermes-only branch** and an **ancestor of `main`** — a root, **not a disconnected history**.
- **58 open PRs**; **23** target a non-`main` base (mostly `ep002`).
- Main already exposes the workflow **primitives** (gate, approval ledger, event spine, proof API, closer data layer). The **assembled runtime** is not on main.
- Migration sequence **skips `0015`** (`0014` → `0016`) — confirm intentional.

---

## 2. PR families (manager output)

### Family A — main-based (full monorepo context; CI = `build-test`)

| PR   | Capability                                   | Stack      | CI   | Note                                             |
| ---- | -------------------------------------------- | ---------- | ---- | ------------------------------------------------ |
| #135 | W1 Sales Closer core (**canonical**)         | TS         | ✅   | self-enforcing no-egress test                    |
| #124 | W1 Sales Closer core (**rival/dup of #135**) | TS         | ✅   | direct path conflict with #135                   |
| #138 | W4 Operator Console                          | TS         | ✅   | clean additive `apps/web/.../operator`           |
| #139 | TrustOps Analytics spec                      | doc        | ✅   | watch-only                                       |
| #140 | Proof Receipt spec                           | doc        | ✅   | overlaps #127/#141/#126                          |
| #142 | Client Zero Build Reconciliation             | doc        | ✅   | watch-only                                       |
| #143 | GTM OS v0 reconciliation                     | doc        | ✅   | watch-only                                       |
| #125 | W6 Signal bus / ledger                       | **Python** | ✅\* | _ep002-rooted, main-targeted → integration-risk_ |
| #126 | W5 Proof report generator                    | **Python** | ✅\* | _ep002-rooted, main-targeted → integration-risk_ |

\* Green `build-test` here proves **only** that the branch's own Python files pass on an `ep002`-rooted tree. It
**does not prove integration** with main's TS proof/event/ledger/compliance modules (absent on those branches).

### Family B — ep002-based / Hermes (no full monorepo context)

| PR   | Capability                           | Stack       | CI          | Note                                        |
| ---- | ------------------------------------ | ----------- | ----------- | ------------------------------------------- |
| #129 | W2 Compliance gate                   | Python      | **none**    | dup of main `compliance.ts` + gtm gate      |
| #128 | W3 Mock CRM/appointment              | Python      | **none**    | overlaps main `crmSync.ts` + #121           |
| #133 | "W7" Enterprise hardening            | Python/docs | `guards` ✅ | actually **Hermes Vision** hardening — park |
| #127 | Proof Receipt & Dispute Layer (spec) | doc         | **none**    | overlaps #140/#141/#126                     |
| #136 | Agent Action Passport (spec)         | doc         | **none**    | base decision required                      |
| #141 | Dispute Replay Pack (spec)           | doc         | **none**    | base decision required                      |

All Family-B branches are **structurally stranded for product assembly**: authored without main's TS modules; ep002-based
ones also lack CI. They must be **rebased onto `main`** to carry CI + monorepo context before they mean anything for assembly.

---

## 3. Duplicate clusters (manager output — Codex to verify + collapse-plan)

1. **Workflow core:** #135 ⟷ #124 — both create `packages/agents/src/closer/index.ts` + modify `packages/agents/src/index.ts`. **Conflict.**
2. **Stack split (whole W-series):** TS (#135, #138) ⟷ Python (#125, #126, #128, #129, #133).
3. **Compliance gate:** main `apps/web/src/lib/compliance.ts` + `packages/core/src/gtm` ⟷ #129 (Python) ⟷ #124 `closer/compliance.ts` ⟷ #120.
4. **Event/ledger spine:** main `packages/core/src/events/index.ts` + `packages/agents/src/ledger/actionLedger.ts` ⟷ #125 (Python).
5. **Proof / report / replay:** main `apps/api/src/proofs.ts` ⟷ #126 (generator) ⟷ #140 ⟷ #127 ⟷ #141 ⟷ #123.
6. **Operator console:** main `apps/web/src/app/approvals/page.tsx` ⟷ #138 (`/operator`) ⟷ #119 ⟷ #78.
7. **CRM mock:** main `apps/worker/src/jobs/crmSync.ts` ⟷ #128 (Python) ⟷ #121 (TS) ⟷ #124 `closer/crm.ts`.

---

## 4. Exact file-location map (condensed — full map in audit §6)

| Concern            | main (VERIFIED)                                                                                                                                                 | PR overlay                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Closer runtime     | _absent_                                                                                                                                                        | #135 `packages/agents/src/closer/salesCloserWorkflow.ts`; #124 `closer/runner.ts`,`stateMachine.ts` |
| Closer data layer  | `packages/core/src/schemas/closer.ts`, `packages/db/migrations/0020,0021`, `packages/db/fixtures/closer.fixture.sql`                                            | —                                                                                                   |
| Compliance gate    | `apps/web/src/lib/compliance.ts`, `packages/core/src/gtm/index.ts`, `packages/core/src/policies/index.ts`                                                       | #129 `hermes/skills/w2-compliance-gate/`; #124 `closer/compliance.ts`                               |
| Approval / ledger  | `packages/agents/src/ledger/actionLedger.ts`, `packages/agents/src/policies/policyGate.ts`, `apps/web/src/lib/approvalQueue.ts`                                 | #138 `apps/web/src/app/operator/page.tsx`                                                           |
| Event / signal bus | `packages/core/src/events/index.ts`                                                                                                                             | #125 `hermes/skills/signal-bus/`                                                                    |
| Proof receipts     | `apps/api/src/proofs.ts`, `apps/api/src/trustPacket.ts`                                                                                                         | #126 `hermes/skills/proof-report/`; specs #140, #127                                                |
| Dispute / replay   | _absent for closer_                                                                                                                                             | specs #127, #141                                                                                    |
| TrustOps analytics | `apps/api/src/trustMetrics.ts` (partial)                                                                                                                        | spec #139                                                                                           |
| Mock CRM writeback | `apps/worker/src/jobs/crmSync.ts`, `packages/integrations/src/hubspot/*`                                                                                        | #128 `hermes/skills/crm-appointment-skill/`; #121                                                   |
| DB migrations      | `packages/db/migrations/0001…0021` (no `0015`)                                                                                                                  | —                                                                                                   |
| Hermes Vision      | `hermes/skills/vision-skill/*`                                                                                                                                  | #133 hardening docs/tests + `hardening-guards.yml`                                                  |
| Parked R&D         | `docs/cognitia/{crypto,agent-economy}/*`, `apps/api/src/agentEconomy*.ts`, migrations 0016–0018, `docs/cognitia/research/12H_CRYPTO_VISIBILITY_AGENT_FABRIC/**` | agent-economy PRs                                                                                   |

---

## 5. Codex audit work order (the brief)

Run in dependency order. Each task lists **inputs**, **method**, **deliverable**, **acceptance**.

### 5.1 Structural architecture audit _(blocks everything else)_

- **Input:** #135 closer TS; #125/#126/#128/#129 Python skills; main `packages/core` + `packages/agents`.
- **Method:** map each W-stage's responsibilities in both runtimes; identify which already exists on main; assess reuse vs reimplementation.
- **Deliverable:** a one-page **spine recommendation** (TS monorepo vs Hermes-skill) + a migration path for the loser.
- **Acceptance:** every W-stage (W1–W7) mapped to exactly one canonical home with a named owner module.

### 5.2 Path-ownership audit

- **Input:** #135 vs #124 (`packages/agents/src/closer/*`), #138 vs #119/#78 (operator).
- **Method:** per-file conflict matrix; propose CODEOWNERS-style ownership.
- **Deliverable:** ownership map + which rival to supersede (sequencing only, no closure).
- **Acceptance:** no path owned by two open PRs without a resolution note.

### 5.3 Test-coverage audit _(execute — not done in the Mega audit)_

- **Input:** main test suite (`*.test.ts`), pglite RLS tests, Python `test_*.py` in skills.
- **Method:** actually run `pnpm test` / `vitest` and the Python skill tests; capture pass/fail + coverage for the closer workflow, compliance gate, proofs, RLS.
- **Deliverable:** real coverage table; flag untested merge-critical paths.
- **Acceptance:** measured (not assumed) pass/fail for every capability in audit §4.

### 5.4 Mock/live boundary audit

- **Input:** grep results in audit §9; `hermes/skills/vision-skill/vision_skill.py` (only live-egress path); ep002 branches' missing CI.
- **Method:** enumerate every egress site; verify the #135 banned-egress guard; design a **main-level egress allowlist guard** + require CI on all branches.
- **Deliverable:** egress inventory + proposed CI guard spec.
- **Acceptance:** zero unaccounted egress in any closer-runtime candidate; vision egress governed on main, not only in #133.

### 5.5 PII / security audit

- **Input:** fixtures (#124/#135/#128), `apps/api/src/redaction/scanner.ts`, `apps/api/src/frontdesk/pii.ts`, closer RLS tests, credential store.
- **Method:** confirm synthetic-only fixtures (tighten phones to reserved `555-0100–555-0199`); verify redaction is invoked by whichever proof generator is canonical; verify RLS on closer tables.
- **Deliverable:** security findings + redaction/RLS coverage statement.
- **Acceptance:** no real PII; redaction enforced on the canonical proof path; closer RLS proven.

### 5.6 PR merge-order audit

- **Input:** the 23 non-`main`-based PRs; families in §2; clusters in §3.
- **Method:** produce a concrete **rebase + sequencing plan** (rebase each ep002 PR onto main; collapse duplicates).
- **Deliverable:** ordered, non-operative sequence (merge-candidate / hold / park) with preconditions.
- **Acceptance:** every target PR has a single disposition + precondition; no instruction to close.

### 5.7 Full repo dependency graph

- **Input:** `packages/*` + `apps/*` imports.
- **Method:** build import graph; mark shared modules touched by multiple PRs.
- **Deliverable:** graph + "high-blast-radius module" list.
- **Acceptance:** every shared module touched by ≥2 open PRs is flagged.

---

## 6. Top 10 verified findings (manager output)

1. **Main is past "specs only."** Consent gate, approval ledger, event spine, proof API, and the Sales Closer **data layer** are **VERIFIED on `main`** (`d3d198e`, 536 files).
2. **The assembled end-to-end Sales Closer workflow is NOT on main** — it exists only in open PRs.
3. **It exists twice, incompatibly:** TS (#135 / rival #124) vs Python Hermes skills (#125/#126/#128/#129).
4. **#135 ⟷ #124 hard-conflict:** both add `packages/agents/src/closer/index.ts` and modify `packages/agents/src/index.ts`.
5. **`ep002` is a hermes-only root/ancestor of main**, not a separate history; PRs on it lack monorepo context.
6. **6 ep002-based PRs carry no CI** (#127/#128/#129/#136/#141 — #133 only runs its own `guards`).
7. **#125/#126 are integration-risk:** main-targeted but authored from `ep002`; green `build-test` ≠ integration with main's TS modules.
8. **#133 is mislabeled** — it is **Hermes Vision** hardening (supporting media), **not** Sales Closer W7; park it.
9. **Mock-safety holds in the inspected code:** no live egress in the closer cores or new Python skills; #135 ships a self-enforcing no-egress test; the only egress is the pre-existing `vision_skill.py`. No promotional token/investment language (only negative disclaimers); fixtures are synthetic (`555-`/`example.com`).
10. **Uploaded source reports are absent** from the environment → all claims that would rest solely on them are REPORTED/UNVERIFIED; **migration `0015` is missing** from the sequence.

---

## 7. Top 5 founder decisions needed (manager output)

1. **Pick the canonical spine:** TypeScript monorepo (`packages/agents/src/closer`) **or** Python Hermes skills (`hermes/skills/*`). _Everything downstream depends on this._
2. **Resolve #135 vs #124:** confirm #135 canonical and park #124 (salvage its idempotent-CRM idea), or the reverse.
3. **Authorize a rebase of the `ep002` PRs onto `main`** (so #127/#128/#129/#136/#141, and the #125/#126 reroot, gain CI + monorepo context) — _or_ explicitly decide they are scratch/parked.
4. **Choose one proof/dispute canonical** from the overlap cluster (#126 generator + #140/#127/#141 specs) and one operator console (#138 vs #119/#78).
5. **Confirm Client-Zero consent (Budget Wheels)** — cleared/consenting real tenant, or fall back to `budget_wheels_demo` / Tenant Zero sandbox. (Currently **UNVERIFIED** — default to sandbox.)

---

## 8. Guardrails for Codex (carry forward)

- **Non-operative:** verify and map only. No merge/close/retarget/undraft/archive/PR-body-edit/branch-deletion; no feature code.
- **No live anything:** no outreach, scraping, CRM writes, SMS/WhatsApp/calls, ads, vendor calls, or real prospect data.
- **No token/presale/yield/airdrop/investment language** except inside an explicit risk/banned-language section.
- **Precedence:** repo/PR evidence > any uploaded doc. Tag every claim VERIFIED / REPORTED / INFERRED / UNVERIFIED.
- **Scope:** repository `cognitiacloud/cognitia.cloud` only.
