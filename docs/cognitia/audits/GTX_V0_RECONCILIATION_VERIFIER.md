# GTX v0 — Reconciliation Verifier

**Status:** Non-operative reference. This document records verification findings and
**proposed** (non-binding) recommendations only. It authorizes **no** merge, undraft, retarget,
close, archive, branch deletion, PR-body edit, or code change. Any sequence described here is a
**proposed** ordering for a future, separately-authorized wave. Nothing in this document was, or
should be read to imply was, merged, parked, closed, retargeted, undrafted, or superseded by action.

- **Prepared by:** Controller (GTM OS v0 verification pass)
- **Inspected on:** 2026-06-22
- **Base of record:** `origin/main` @ `d3d198e` (verified this run)
- **Scope:** read-only verification + assembly map. No runtime code, no UI, no state machine, no
  dependency/lockfile/config changes, no PR state changes.

## Evidence labels

| Label        | Meaning                                                                                                                                |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| **VERIFIED** | Source/diff (or PR body + file manifest) was read directly this run via the repo or GitHub API, inspected on 2026-06-22.               |
| **REPORTED** | Known only from PR-list metadata (number, title, branch, base, draft state) as of this verifier — file contents not individually read. |

PR draft/open status is **time-sensitive**: every status below reflects observation **as of this
verifier (inspected on 2026-06-22)** and may have changed since. Nothing here is a permanent claim
about any PR's state.

## How this verifier relates to #143

PR #143 (`docs/cognitia/gtm-os/RECONCILIATION_V0.md`, **REPORTED** open/draft as of this verifier)
already produced a reconciliation map, but it marked several central PRs (#124, #140, #141, and
others) as **REPORTED** (metadata only) and predates **#144**. This verifier **upgrades those to
VERIFIED** by reading the actual diffs of #135, #138, #124, #125, #126, #140, #141 on 2026-06-22,
**adds #144** (a packaged v0 substrate that materially changes the picture), and surfaces one finding
#143 did not: the spine pieces are split across **two runtimes** (TypeScript vs Python) and the
operator console does not call the workflow core. This document does not modify, supersede, or close
#143; it is an independent companion audit.

---

## 1. What exists on `origin/main` (VERIFIED, inspected 2026-06-22)

Confirmed by reading the tree and source at `origin/main` @ `d3d198e`. **None** of the v0-lane PRs
discussed below are merged to `main` as of this verifier.

| Capability                             | Module on `main`                                                                                                                                                                            | Notes                                                                                                                                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Action ledger (TS, DB-bound)           | `packages/agents/src/ledger/actionLedger.ts`                                                                                                                                                | `propose/approve/reject/execute/rollback`; idempotency on `tenant_id + idempotency_key`; refuses execute unless `approval_status === 'approved'`; emits events + audit per transition.                |
| Append-only event registry             | `packages/core/src/events/`                                                                                                                                                                 | `EVENT_PAYLOADS` incl. `agent.action.*`, `inbound.lead.received.v1`, `crm.*`, `calendar.meeting.booked.v1`; `validateEvent`, `makeEvent`.                                                             |
| Consent/compliance + PII-safe prospect | `packages/core/src/gtm/`                                                                                                                                                                    | `normalizeGtmProspect` (hash/mask/drop raw email+phone), `canContactProspect`, `requiresHumanReviewForOutreach`, `classifySourceRisk`, `createGtmProofEvent`, `GTM_OUTREACH_REQUIRES_HUMAN_APPROVAL`. |
| Approval policy                        | `packages/core/src/policies/`, `packages/agents/src/policies/policyGate.ts`                                                                                                                 | `classifyRisk`, `decideApproval` (suppressed → blocked; human approval default).                                                                                                                      |
| Closer schemas + containment guard     | `packages/core/src/schemas/closer.ts`, `packages/core/src/closer.guard.test.ts`                                                                                                             | Guard reserves `packages/agents/src/closer/` + `packages/integrations/src/apify/`; forbids `fetch`/`child_process`/`node:net`/`node:http`/`ApifyClient`/`new Anthropic` in those production paths.    |
| Closer persistence                     | `packages/db/migrations/0020_closer_sources_runs.sql`, `0021_closer_profiles_briefs.sql`, `packages/db/fixtures/closer.fixture.sql`, `packages/db/src/closer.{contract,rls.pglite}.test.ts` | Schema/migrations/fixtures present.                                                                                                                                                                   |
| Mock/governed CRM adapter              | `packages/integrations/src/hubspot/*`                                                                                                                                                       | Typed write plan + reversible rollback + readiness gating.                                                                                                                                            |
| Proof / trust APIs                     | `apps/api/src/proofs.ts`, `apps/api/src/trustPacket.ts`, `apps/api/src/trustMetrics.ts`                                                                                                     | Proof + trust packet endpoints.                                                                                                                                                                       |
| Operator surfaces (web)                | `apps/web/src/app/{approvals,proofs,portal/proof,trust}/`, `apps/web/src/lib/{compliance,approvalQueue,complianceFixtures}.ts`                                                              | Approval queue, compliance evaluation, PII-safe demo fixtures (`DEMO_PROSPECTS`: masked emails, `***-***-0100` phones, `.example` domains).                                                           |
| Architecture doc                       | `docs/architecture.md`                                                                                                                                                                      | Living system doc.                                                                                                                                                                                    |

**Absent on `main` (VERIFIED, inspected 2026-06-22):**

- `packages/gtm-os/` — the #144 substrate package (below) is not on `main`.
- `packages/agents/src/closer/` — **no workflow runtime on `main`** (only the schemas/guard/migrations above).
- `apps/web/src/app/operator/` and `apps/web/src/lib/operatorConsole.ts`.
- `hermes/skills/signal-bus/` and `hermes/skills/proof-report/`.
- `docs/architecture/proof-receipt-spec.md` and `docs/architecture/dispute-replay-pack.md`.

`docs/cognitia/audits/` exists on `main` (e.g. `AUDIT_BOOKLET_001/`, `V1_1_FINAL_AUDIT.md`); this
file is a novel filename within that existing directory.

**Implication:** the substrate primitives exist and are merged; the v0 demo target is largely an
**assembly** problem on top of them — with the qualifications in §7 and §8, and noting that **#144
already proposes a packaged assembly** (§2).

---

## 2. What exists in #144 — packaged v0 substrate (VERIFIED, inspected 2026-06-22)

**Most material to this verifier.** Inspected via PR body + file manifest on 2026-06-22 (the full
2,992-line diff was not read line-by-line — see §12).

- **PR:** #144 "feat(gtm-os): Proof-Governed GTM OS v0 — mock-only substrate" — base `main`; head
  `claude/dazzling-volta-fztku8`; open/draft as of this verifier; 39 changed files / 53 tests per its body.
- **Adds an isolated package** `@cognitia/gtm-os` at `packages/gtm-os/` plus `docs/gtm-os/`. Per its
  body it touches **no** shared/root files (`pnpm-workspace.yaml`, root `tsconfig.json`,
  `vitest.config.ts`, root `package.json`, `packages/agents/src/index.ts` untouched) and **no**
  `apps/web` files.
- **File manifest (VERIFIED via API):**
  - Engine/state machine: `src/engine/gtmRunEngine.ts` (+ `gtmRunEngine.e2e.test.ts`).
  - Append-only hash-chained ledger: `src/ledger/actionLedger.ts`, `src/hashing.ts` (+ tests);
    `verifyLedger()` tamper detection.
  - Proof receipt per transition: `src/proof/proofChain.ts*` + `verifyReceiptChain()`.
  - Compliance gate: `src/compliance/complianceGate.ts` (reasons `consent_missing`,
    `consent_revoked`, `on_suppression_list`, `pii_unsafe`, `tenant_inactive`, `channel_not_permitted`).
  - Human approval queue: `src/approval/approvalQueue.ts` (named-human decision; no auto-approve).
  - Idempotent mock adapters: `src/adapters/{mockAppointmentAdapter,mockCrmAdapter}.ts`.
  - Tenants: `demandara_internal`, `cognitia_internal`, `budget_wheels_demo` (all internal/demo, mock-mode).
  - PII-safe fixtures: `src/fixtures/leads.ts` (`.example` emails, `555-01xx` phones); `src/pii/piiSafety.ts`.
  - Guards (tests): `src/guards/{noEgress,noProhibitedLanguage,noRawPii}.guard.test.ts`.
  - Ownership manifest: `src/ownership/manifest.ts`, `docs/gtm-os/ownership-manifest.md`,
    `docs/gtm-os/proof-governed-gtm-os-v0.md`, `docs/gtm-os/README.md`.
- **Self-reported verification:** `vitest run packages/gtm-os` → 53 passed / 15 files; root `tsc`
  0 errors; prettier clean. (Self-reported in the PR; not independently re-run by this verifier.)
- **Self-declared positioning:** "W0 substrate", additive/isolated, "does not touch, recreate, or
  merge any existing PR; #135 stays canonical for the W1 Sales Closer core." It also **escalates an
  unresolved overlap**: #123 adds a root `package.json` + `tsconfig.base.json` (a parallel
  npm-workspaces/`node:test` root), conflicting at top level with the pnpm/vitest root and #121.

---

## 3. What exists in #135 (VERIFIED, inspected 2026-06-22)

- **PR:** #135 "W1 Sales Closer workflow core (mock-safe happy path)" — base `main`; open/draft as of this verifier.
- **Paths:** `packages/agents/src/closer/{ports.ts, salesCloserWorkflow.ts, mockPorts.ts, index.ts, __fixtures__/lead.fixture.ts}` + one barrel line in `packages/agents/src/index.ts`.
- **State machine:** `lead_received → compliance_check_required → human_approval_required → appointment_requested → crm_writeback_requested → proof_report_requested → completed`, plus terminal `blocked_compliance|blocked_approval|blocked_appointment|blocked_crm|blocked_proof`. A `pending` approval halts in `human_approval_required` (no autonomous advance past a human).
- **Boundaries:** compliance/approval/appointment/CRM/proof are injected **ports** (`CloserPorts`); `mockPorts.ts` provides in-memory fakes; deterministic via injected clock/id.
- **Proof emission:** builds **2** `GtmProofEvent`s via core `createGtmProofEvent` (appointment + CRM) through the proof port. It does **not** emit a receipt per transition and does not implement the #140 receipt schema.
- **Reuse:** core `gtm` guardrails. PII-safe fixture. 20 tests per the diff.

## 4. What exists in #138 (VERIFIED, inspected 2026-06-22)

- **PR:** #138 "W4 Operator Console — mock-safe Sales Closer workflow" — base `main`; open/draft as of this verifier.
- **Paths:** `apps/web/src/app/operator/page.tsx`, `apps/web/src/lib/operatorConsole.ts`, `apps/web/src/lib/operatorConsole.test.ts`.
- **Surface:** `'use client'` console with a mock-safe banner; PII-safe lead detail, compliance badge (`human_review_required|blocked`), blocked reasons, approve/reject (approve refused when blocked), simulated CRM (`written: false`) + appointment, and a proof-report log of `ComplianceProofEvent`s.
- **Key finding (VERIFIED):** `operatorConsole.ts` derives its own view-model from the **web compliance lib** + **`DEMO_PROSPECTS`**. It does **not** import or call #135's `SalesCloserWorkflow` (nor #144's `@cognitia/gtm-os`). The console and the workflow core are independent implementations of the same spine.

## 5. What exists in the proof/report PRs

| PR   | Title (trimmed)                      | Path                                       | Runtime    | Base                             | Evidence (as of this verifier, 2026-06-22)                                                                                                                                                                                                       |
| ---- | ------------------------------------ | ------------------------------------------ | ---------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| #125 | W6 Signal bus / action ledger        | `hermes/skills/signal-bus/`                | **Python** | `main`                           | **VERIFIED** — append-only sha256 hash-chained JSONL ledger; events `lead.created`, `compliance.checked`, `approval.*`, `appointment.mock_created`, `crm.mock_written`, `proof.generated`; `verify`/`proof_report`. Not imported by any TS code. |
| #126 | W5 Proof report generator            | `hermes/skills/proof-report/`              | **Python** | `main`                           | **VERIFIED** — generator over a completed workflow JSON; `verified`/`likely_inference`/`unknown` + human-approval record + sha256 integrity; fail-closed PII + hype-language guards. Not imported by any TS code.                                |
| #140 | Proof receipt specification          | `docs/architecture/proof-receipt-spec.md`  | **Doc**    | `main`                           | **VERIFIED** — 13 required fields; 7-stage lifecycle; append-only, digests-not-PII. No code.                                                                                                                                                     |
| #141 | Dispute Replay Pack architecture     | `docs/architecture/dispute-replay-pack.md` | **Doc**    | `claude/ep002-mission-run-pPoba` | **VERIFIED** — content-addressed bundle + `manifest.json`/`pack_hash` + redaction map; evidentiary, not adjudicative. No code. Base is the integration branch, not `main`.                                                                       |
| #123 | Client Zero acceptance-proof harness | proof harness                              | —          | `claude/ep002-mission-run-pPoba` | **REPORTED** (metadata only). #144 flags it adds a conflicting root `package.json` + `tsconfig.base.json`.                                                                                                                                       |
| #127 | Proof Receipt & Dispute Layer doc    | architecture doc                           | Doc        | `claude/ep002-mission-run-pPoba` | **REPORTED** (metadata only).                                                                                                                                                                                                                    |

---

## 6. What is duplicated (proposed reconciliation clusters)

Observations only — no PR state change is implied.

1. **v0 substrate vs primitives:** #144 (VERIFIED, base `main`) re-implements, inside one isolated
   TS package, concepts that also exist as separate efforts — append-only ledger (cf. #125 Python,
   and TS `actionLedger.ts` on `main`), proof receipt/report (cf. #126 Python, #140 spec), compliance
   gate (cf. #120/#129), idempotent mock CRM/appointment (cf. #121/#128, and the idempotent-mock idea
   from parked #124), and tenants. #144 positions itself as additive and isolated, not a replacement.
2. **Workflow core:** #135 (VERIFIED, base `main`) and #124 (VERIFIED, base `main`) both add
   `packages/agents/src/closer/` and the same barrel line — a direct file-level collision.
3. **Operator console:** #138 (VERIFIED, base `main`) and #119 (REPORTED, base `ep002`).
4. **Proof line:** #126 (VERIFIED, Python) / #140 (VERIFIED, doc) / #123 (REPORTED) / #127 (REPORTED) / #141 (VERIFIED, `ep002`) — plus #144's in-package TS proof chain.
5. **Compliance gate:** #120 (REPORTED, `main`) and #129 (REPORTED, `ep002`) — plus #144's in-package gate.
6. **Mock CRM / appointment:** #121 (REPORTED, `main`) and #128 (REPORTED, `ep002`) — plus #144's in-package adapters.
7. **Root/build config:** #123 (REPORTED) introduces a parallel root config that #144 flags as
   conflicting with the current pnpm/vitest root and with #121.

---

## 7. Spine coverage verdict

Target spine: **lead in → consent/compliance gate → human approval → mock appointment / CRM writeback → proof receipt / report.**

| Stage                            | #144 (packaged substrate)                                            | #135 (workflow core)                                   | #138 (operator console)                         |
| -------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------- |
| lead in                          | ✅ VERIFIED — PII-safe `fixtures/leads.ts`.                          | ✅ `normalizeGtmProspect`.                             | ✅ `DEMO_PROSPECTS`.                            |
| consent / compliance gate        | ✅ VERIFIED — `complianceGate` with machine-readable reasons.        | ✅ doctrine + compliance port.                         | ✅ `summarizeCompliance`.                       |
| human approval                   | ✅ VERIFIED — `approvalQueue`, named human, no auto-approve.         | ✅ approval port; pauses on `pending`.                 | ✅ `applyOperatorDecision`; refused if blocked. |
| mock appointment / CRM writeback | ✅ VERIFIED — idempotent mock adapters, approval-guarded.            | ✅ appointment + CRM ports (mock).                     | ✅ simulated; `crm.written: false`.             |
| proof receipt / report           | ✅ VERIFIED — hash-chained **receipt on every transition** + report. | ⚠️ PARTIAL — 2 events only; no per-transition receipt. | ⚠️ PARTIAL — UI log only; not #140/#125/#126.   |

**Verdict:** #135 and #138 each cover the spine as mock-safe demos but **separately** (the console
does not drive the engine), and their proof stage is partial. **#144 is the only single artifact that
covers the full spine end to end in one runtime, including a proof receipt on every transition** — it
is, in effect, the assembled substrate this verifier would otherwise have proposed as future work.
The richer proof artifacts (#125 ledger, #126 report, #140 spec, #141 replay) remain **not wired into
the TypeScript flow** and partly duplicate #144's in-package equivalents.

---

## 8. What is genuinely missing (integration gaps, given #144)

#144 closes most of the _code_ gaps a from-scratch integration layer would have filled (per-transition
receipt + ledger append, tenants, idempotent adapters, end-to-end run). What remains genuinely
unowned/unresolved, verified by absence on `main` and by reading the diffs on 2026-06-22:

1. **Reconciliation of #144 ↔ canonical #135 core.** #144 states #135 stays canonical for the W1
   closer core, but #144 also ships its own engine; nothing yet reconciles the two (which one a future
   wave standardizes on, and how #144's ledger/receipt primitives back #135).
2. **Console wiring.** Neither #138 nor any PR drives #135 _or_ #144 from the operator UI; #138
   re-derives its own view-model.
3. **Runtime duplication.** #144's TS ledger/proof vs the Python #125/#126 vs the doc-only #140/#141 —
   no decision on a single home/source-of-truth for the proof line.
4. **Root/build-config conflict (#123).** Flagged by #144; needs a founder base/root decision before
   #123 or #121 lands.
5. **Tenant clearance for `budget_wheels_demo`.** Treated as a **sandbox/demo** tenant in #144;
   real, documented consent/control would be required before it is anything more.

---

## 9. Is a thin integration layer needed later?

**Proposed verdict:** the substrate such a layer would provide **already exists as an open PR (#144)**
as of this verifier. So the remaining work is **reconciliation**, not a new build — and it is a
**future, proposed** activity, **gated on founder approval and on the relevant canonical PRs (#135,
#138) landing**. This document is **not** authorization to merge #144, to build a reconciliation
layer, or to take any PR action.

Constraints any future reconciliation should respect (proposed): keep it additive and mock-only (no
live outreach, CRM/calendar, vendor calls, network, or raw PII); reuse existing exports rather than
re-derive; pick a single home for the proof line; and resolve the #123 root-config question first.

---

## 10. Proposed (non-operative) merge/park sequence

A **proposed** ordering for a future, separately-authorized wave, **contingent on founder approval**.
No PR is merged, parked, closed, retargeted, undrafted, or superseded by this document; "recommended
canonical" and "recommended park" are advisory labels only.

1. **Substrate:** #144 is the recommended-canonical packaged W0 substrate (additive, isolated, base
   `main`). Its own body proposes merging it first; this verifier records that as a **proposal**, not
   an action.
2. **Workflow core:** recommended canonical = #135; recommended park = #124 (duplicate at the same path).
3. **Operator console:** recommended canonical = #138; recommended park = #119. Follow-up proposal:
   wire #138 to #135/#144 rather than its parallel view-model.
4. **Compliance gate / mock CRM+appointment:** where `main`-based and `ep002`-based PRs overlap
   (#120 vs #129; #121 vs #128), the proposal prefers the `main`-based PR; pending confirmation that
   #144's and/or #135's in-package equivalents do not already subsume them.
5. **Proof line:** adopt #140 as the proposed receipt spec of record; reconcile #125 (Python), #126
   (Python), #123, #127, #141, and #144's in-package proof chain into a single line with one runtime home.
6. **Root config (#123):** resolve before #123 or #121 lands.

---

## 11. Proposed next-worker prompt (future / not authorization)

Included **only because §8 verifies remaining gaps.** This is a **proposed** brief for a future
worker; it is **not** authorization to implement, and it is **gated on (a) founder approval and (b)
the relevant canonical PRs (#144 as substrate, #135 core, #138 console) landing on `main`**.

> **Future worker — "GTM OS v0 Reconciliation" (gated on founder approval + #144/#135/#138 landing;
> mock-only; report back before any PR state change).** Reconcile the packaged substrate (#144's
> `@cognitia/gtm-os`) with the canonical closer core (#135) and operator console (#138): standardize
> on one engine, back #135's ports with #144's ledger/receipt/approval primitives, and drive #138's
> console from that engine (rather than its parallel view-model). Pick a single runtime home for the
> proof line (#144 TS vs #125/#126 Python vs #140/#141 docs) and bridge it explicitly. Confirm
> `budget_wheels_demo` stays a sandbox tenant unless cleared. No live outreach, CRM/calendar, vendor
> calls, network, raw PII, or new dependencies. Resolve the #123 root-config question first.

---

## 12. Mock-safety & guardrail attestation (this document)

This wave wrote **one markdown document and no code**. It asserts:

- No live outreach of any kind, and no instruction to perform any.
- No real prospect data and no raw PII; any illustrative contact referenced uses `.example`/
  `.invalid`/`.test` domains and `555-01xx` numbers only.
- No crypto/fundraising hype language is introduced; parked-lane vocabulary is referred to by
  category, not spelled out.
- No scraping or platform-ToS-violating collection.
- No network calls, vendor SDKs, or secrets added.
- Budget Wheels is treated as a **sandbox/demo** tenant; it is not represented as a real, cleared client.

## 13. Unresolved ambiguity

- **PR status is point-in-time.** All open/draft labels reflect observation **as of this verifier
  (2026-06-22)** and may have changed since.
- **#144 depth.** #144 was verified via its PR body + full file manifest (inspected 2026-06-22); its
  2,992-line diff was not read line-by-line, and its test/tsc/prettier results are self-reported in
  the PR, not independently re-run here.
- **#141 base branch.** #141 targets `claude/ep002-mission-run-pPoba`, not `main`, as do the other
  `ep002`-based PRs noted REPORTED; their content is not reflected on `main`.
- **Not all open PRs were diffed.** This verifier read the diffs/manifests of #144, #135, #138, #124,
  #125, #126, #140, #141 (VERIFIED) and took the remainder from list metadata (REPORTED).
- **Root/base reality.** Several PRs target `ep002` and #123 introduces a parallel root config; the
  assembled state differs between `main` and the integration branch. A future wave should pick one
  canonical base before reconciling.
