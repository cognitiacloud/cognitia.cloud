# GTX v0 — Reconciliation Verifier

**Status:** Non-operative reference. This document records verification findings and
**proposed** (non-binding) recommendations only. It authorizes **no** merge, undraft, retarget,
close, archive, branch deletion, PR-body edit, or code change. Any sequence described here is a
**proposed** ordering for a future, separately-authorized wave. Nothing in this document was, or
should be read to imply was, merged, parked, closed, retargeted, undrafted, or edited.

- **Prepared by:** Controller (GTM OS v0 verification pass)
- **Inspected on:** 2026-06-22
- **Base of record:** `origin/main` @ `d3d198e` (verified this run)
- **Scope:** read-only verification + assembly map. No runtime code, no UI, no state machine, no
  dependency/lockfile changes, no PR state changes.

## Evidence labels

| Label        | Meaning                                                                                                                                      |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **VERIFIED** | Source/diff was read directly this run (`origin/main` source, or the PR diff via the GitHub API), inspected on 2026-06-22.                   |
| **REPORTED** | Known only from PR-list metadata (number, title, branch, base, draft state) as of 2026-06-22 — file contents not individually read this run. |

PR draft/open status is **time-sensitive** and reflects observation on 2026-06-22 only; it may have
changed since.

## How this verifier relates to #143

PR #143 (`docs/cognitia/gtm-os/RECONCILIATION_V0.md`, **REPORTED** open/draft as of 2026-06-22)
already produced a reconciliation map, but it marked several central PRs (#124, #140, #141, and
others) as **REPORTED** (metadata only). This verifier **upgrades those to VERIFIED** by reading the
actual diffs of #135, #138, #124, #125, #126, #140, and #141 on 2026-06-22, and adds one finding
#143 did not surface: the v0 pieces are split across **two runtimes** (TypeScript vs Python) and the
operator console does not call the workflow core — so assembly is a real, non-trivial gap, not a
formality. This document does not modify, supersede, or close #143; it is an independent companion
audit.

---

## 1. What exists on `origin/main` (VERIFIED, inspected 2026-06-22)

Confirmed by reading the tree and source at `origin/main` @ `d3d198e`.

| Capability                             | Module on `main`                                                                                                                                                                            | Notes                                                                                                                                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Action ledger (TS, DB-bound)           | `packages/agents/src/ledger/actionLedger.ts`                                                                                                                                                | `propose/approve/reject/execute/rollback`; idempotency on `tenant_id + idempotency_key`; refuses execute unless `approval_status === 'approved'`; emits events + audit per transition.                |
| Append-only event registry             | `packages/core/src/events/`                                                                                                                                                                 | `EVENT_PAYLOADS` incl. `agent.action.*`, `inbound.lead.received.v1`, `crm.*`, `calendar.meeting.booked.v1`; `validateEvent`, `makeEvent`.                                                             |
| Consent/compliance + PII-safe prospect | `packages/core/src/gtm/`                                                                                                                                                                    | `normalizeGtmProspect` (hash/mask/drop raw email+phone), `canContactProspect`, `requiresHumanReviewForOutreach`, `classifySourceRisk`, `createGtmProofEvent`, `GTM_OUTREACH_REQUIRES_HUMAN_APPROVAL`. |
| Approval policy                        | `packages/core/src/policies/`, `packages/agents/src/policies/policyGate.ts`                                                                                                                 | `classifyRisk`, `decideApproval` (suppressed → blocked; human approval default).                                                                                                                      |
| Closer schemas + containment guard     | `packages/core/src/schemas/closer.ts`, `packages/core/src/closer.guard.test.ts`                                                                                                             | Guard reserves `packages/agents/src/closer/` + `packages/integrations/src/apify/` and forbids `fetch`/`child_process`/`node:net`/`node:http`/`ApifyClient`/`new Anthropic` in those production paths. |
| Closer persistence                     | `packages/db/migrations/0020_closer_sources_runs.sql`, `0021_closer_profiles_briefs.sql`, `packages/db/fixtures/closer.fixture.sql`, `packages/db/src/closer.{contract,rls.pglite}.test.ts` | Schema/migrations/fixtures present.                                                                                                                                                                   |
| Mock/governed CRM adapter              | `packages/integrations/src/hubspot/*`                                                                                                                                                       | Typed write plan + reversible rollback + readiness gating.                                                                                                                                            |
| Proof / trust APIs                     | `apps/api/src/proofs.ts`, `apps/api/src/trustPacket.ts`, `apps/api/src/trustMetrics.ts`                                                                                                     | Proof + trust packet endpoints.                                                                                                                                                                       |
| Operator surfaces (web)                | `apps/web/src/app/{approvals,proofs,portal/proof,trust}/`, `apps/web/src/lib/{compliance,approvalQueue,complianceFixtures}.ts`                                                              | Approval queue, compliance evaluation, PII-safe demo fixtures (`DEMO_PROSPECTS`: masked emails, `***-***-0100` phones, `.example` domains).                                                           |
| Architecture doc                       | `docs/architecture.md`                                                                                                                                                                      | Living system doc.                                                                                                                                                                                    |

**Absent on `main` (VERIFIED, inspected 2026-06-22):**

- `packages/agents/src/closer/` — **no workflow runtime on `main`** (only the schemas/guard/migrations above).
- `apps/web/src/app/operator/` and `apps/web/src/lib/operatorConsole.ts`.
- `hermes/skills/signal-bus/` and `hermes/skills/proof-report/`.
- `docs/architecture/proof-receipt-spec.md` and `docs/architecture/dispute-replay-pack.md`.

`docs/cognitia/audits/` exists on `main` (e.g. `AUDIT_BOOKLET_001/`, `V1_1_FINAL_AUDIT.md`); this
file is a novel filename within that existing directory.

**Implication:** the substrate primitives (run/ledger, prospect normalization, compliance gate,
approval policy, mock CRM adapter, proof/trust API, demo fixtures) are present and merged. The v0
demo target is largely an **assembly** problem on top of them — with the qualifications in §6 and §8.

---

## 2. What exists in #135 (VERIFIED, inspected 2026-06-22)

- **PR:** #135 "W1 Sales Closer workflow core (mock-safe happy path)" — base `main`; open/draft as of 2026-06-22.
- **Paths:** `packages/agents/src/closer/{ports.ts, salesCloserWorkflow.ts, mockPorts.ts, index.ts, __fixtures__/lead.fixture.ts}` + one barrel line in `packages/agents/src/index.ts`.
- **State machine:** `lead_received → compliance_check_required → human_approval_required → appointment_requested → crm_writeback_requested → proof_report_requested → completed`, plus terminal `blocked_compliance|blocked_approval|blocked_appointment|blocked_crm|blocked_proof`. A `pending` approval halts in `human_approval_required` (no autonomous advance past a human).
- **Boundaries:** compliance/approval/appointment/CRM/proof are injected **ports** (`CloserPorts`); `mockPorts.ts` provides in-memory fakes; deterministic via injected clock/id.
- **Proof emission:** builds **2** `GtmProofEvent`s via core `createGtmProofEvent` (`gtm.discovery.booked.v1` at appointment, `gtm.proposal.generated.v1` at CRM) and records them through the proof port. It does **not** emit a receipt per transition, and does not implement the #140 receipt schema.
- **Reuse:** `normalizeGtmProspect`, `canContactProspect`, `requiresHumanReviewForOutreach`, `GTM_OUTREACH_REQUIRES_HUMAN_APPROVAL`, `createGtmProofEvent` from `@cognitia/core`. PII-safe fixture (no contact email/phone). 20 tests per the diff.

## 3. What exists in #138 (VERIFIED, inspected 2026-06-22)

- **PR:** #138 "W4 Operator Console — mock-safe Sales Closer workflow" — base `main`; open/draft as of 2026-06-22.
- **Paths:** `apps/web/src/app/operator/page.tsx`, `apps/web/src/lib/operatorConsole.ts`, `apps/web/src/lib/operatorConsole.test.ts`.
- **Surface:** `'use client'` console with a mock-safe banner; lead detail (PII-safe), compliance badge (`human_review_required|blocked`), blocked reasons, approve/reject controls (approve refused when blocked), simulated CRM (`written: false`) and appointment status, and a proof-report log of `ComplianceProofEvent`s.
- **Key finding (VERIFIED):** `operatorConsole.ts` derives its own view-model from the **web compliance lib** (`./compliance`) and **`DEMO_PROSPECTS`** fixtures. It does **not** import or call #135's `SalesCloserWorkflow` / `CloserPorts`. The console and the workflow core are two independent implementations of the same spine.

## 4. What exists in the proof/report PRs

| PR   | Title (trimmed)                      | Path                                       | Runtime    | Base                             | Evidence (2026-06-22)                                                                                                                                                                                                                                                                               |
| ---- | ------------------------------------ | ------------------------------------------ | ---------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #125 | W6 Signal bus / action ledger        | `hermes/skills/signal-bus/`                | **Python** | `main`                           | **VERIFIED** — append-only sha256 hash-chained JSONL ledger; events `lead.created`, `compliance.checked`, `approval.requested/granted/rejected`, `appointment.mock_created`, `crm.mock_written`, `proof.generated`; idempotent, PII-redacted, `verify`/`proof_report`. Not imported by any TS code. |
| #126 | W5 Proof report generator            | `hermes/skills/proof-report/`              | **Python** | `main`                           | **VERIFIED** — generator over a completed sales-closer workflow JSON; classifies `verified`/`likely_inference`/`unknown`, includes a human-approval record + sha256 integrity checksum; fail-closed PII + hype-language guards. Not imported by any TS code.                                        |
| #140 | Proof receipt specification          | `docs/architecture/proof-receipt-spec.md`  | **Doc**    | `main`                           | **VERIFIED** — 13 required fields; 7-stage lifecycle (`lead_intake`, `compliance_check`, `approval`, `message_draft`, `appointment_mock`, `crm_mock_writeback`, `proof_report_generation`); append-only, digests-not-PII. No code.                                                                  |
| #141 | Dispute Replay Pack architecture     | `docs/architecture/dispute-replay-pack.md` | **Doc**    | `claude/ep002-mission-run-pPoba` | **VERIFIED** — content-addressed bundle + `manifest.json`/`pack_hash` + redaction map; evidentiary, not adjudicative. No code. Base is the integration branch, not `main`.                                                                                                                          |
| #123 | Client Zero acceptance-proof harness | proof harness                              | —          | `claude/ep002-mission-run-pPoba` | **REPORTED** (metadata only, 2026-06-22).                                                                                                                                                                                                                                                           |
| #127 | Proof Receipt & Dispute Layer doc    | architecture doc                           | Doc        | `claude/ep002-mission-run-pPoba` | **REPORTED** (metadata only, 2026-06-22).                                                                                                                                                                                                                                                           |

---

## 5. What is duplicated (proposed reconciliation clusters)

Observations only — no PR state change is implied.

1. **Workflow core:** #135 (VERIFIED, base `main`) and #124 (VERIFIED, base `main`) both add
   `packages/agents/src/closer/` and both append the same barrel line to
   `packages/agents/src/index.ts` — a direct file-level collision. #124 uses states
   `received/compliance_blocked/awaiting_human_approval/approved/appointment_ready/crm_written/proof_ready/rejected`;
   #135 uses the `*_required`/`blocked_*` naming. Same module, same target, two designs.
2. **Operator console:** #138 (VERIFIED, base `main`) and #119 (REPORTED, base `ep002`) — overlapping operator-console surface.
3. **Proof line:** #126 (VERIFIED generator, Python) / #140 (VERIFIED spec, doc) / #123 (REPORTED harness) / #127 (REPORTED doc) / #141 (VERIFIED replay doc, `ep002`).
4. **Compliance gate:** #120 (REPORTED, base `main`) and #129 (REPORTED, base `ep002`).
5. **Mock CRM / appointment:** #121 (REPORTED, base `main`) and #128 (REPORTED, base `ep002`).
6. **"Action ledger" naming:** #125 (VERIFIED, Python `hermes/skills/`) vs `packages/agents/src/ledger/actionLedger.ts` (VERIFIED, TS on `main`). Different layers and runtimes that share a name, not a strict duplicate.

---

## 6. Spine coverage verdict

Target spine: **lead in → consent/compliance gate → human approval → mock appointment / CRM writeback → proof receipt / report.**

| Stage                            | #135 (workflow core)                                                                                                          | #138 (operator console)                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| lead in                          | ✅ VERIFIED — `normalizeGtmProspect` over `RawGtmProspectInput`.                                                              | ✅ VERIFIED — `DEMO_PROSPECTS` fixtures, PII-safe projection.                                      |
| consent / compliance gate        | ✅ VERIFIED — doctrine + compliance port; `canContactProspect`.                                                               | ✅ VERIFIED — `summarizeCompliance` → `blocked` / `human_review_required`.                         |
| human approval                   | ✅ VERIFIED — approval port; pauses on `pending`, terminal on reject.                                                         | ✅ VERIFIED — `applyOperatorDecision`; approve refused when blocked.                               |
| mock appointment / CRM writeback | ✅ VERIFIED — appointment + CRM ports (mock); `blocked_appointment`/`blocked_crm`.                                            | ✅ VERIFIED — simulated appointment + `crm.written: false`.                                        |
| proof receipt / report           | ⚠️ PARTIAL — emits 2 `GtmProofEvent`s, not a per-transition receipt; no #140 receipt schema; no per-transition ledger append. | ⚠️ PARTIAL — UI log of `ComplianceProofEvent`s only; not the #140 receipt, not wired to #125/#126. |

**Verdict:** #135 and #138 **each** cover the spine end-to-end as mock-safe demos, but they cover it
**separately** — #138 re-implements the workflow view-model rather than driving #135's engine — and
the "proof receipt/report" stage is partial in both. The richer proof artifacts (#125 ledger, #126
report, #140 receipt spec, #141 replay) exist but are **not wired into the TypeScript flow**.

---

## 7. What is genuinely missing (no PR owns these — integration gaps)

All verified by absence on `main` and by reading the relevant diffs on 2026-06-22:

1. **Console ↔ engine wiring.** #138 does not call #135's `SalesCloserWorkflow`. Nothing makes the
   operator console drive the canonical workflow core; they would diverge over time.
2. **Per-transition proof receipt (#140 schema) in code.** #135 emits only 2 `GtmProofEvent`s; no
   PR emits a #140-shaped receipt for every transition in executable code.
3. **Per-transition action-ledger append in the TS workflow.** The TS workflow does not append to
   `packages/agents/src/ledger/actionLedger.ts` (or any append-only ledger) on each transition.
4. **Tenant / workspace wiring.** No PR wires the intended tenants — `demandara_internal`,
   `cognitia_internal`, and `budget_wheels_demo` (a **sandbox** tenant unless real, documented
   consent/control is confirmed) — into the demo.
5. **TS ↔ Python runtime bridge.** #125 (ledger) and #126 (proof report) are Python `hermes` skills;
   the workflow core/console are TypeScript. They share only a conceptual JSON contract, with no
   code bridge.

---

## 8. Is a thin integration layer needed later?

**Proposed verdict: yes — but as a future, separately-authorized wave, gated on #135 and #138
landing first. This document is not authorization to implement it.**

Rationale: §6–§7 show the spine pieces exist but are not assembled, the proof stage is partial, and
two of the four proof/ledger pieces are in a different runtime. A thin assembly layer is the
non-duplicative way to close that — but only once the canonical core (#135) and console (#138) are
in place, to avoid building against moving targets.

Constraints any such future layer **must** respect (proposed):

- New module name (e.g. a `gtmOs` assembly module) — **never** `packages/agents/src/closer/`
  (recommended canonical home of #135) and **never** a second `apps/web/src/app/operator/`.
- Mock-only: no live outreach, no live CRM/calendar, no vendor calls, no network, no raw PII.
- Compose existing exports rather than re-derive logic; adopt #140 as the receipt shape of record.

---

## 9. Proposed (non-operative) merge/park sequence

A **proposed** ordering for a future, separately-authorized integration wave. No PR is merged,
parked, closed, retargeted, undrafted, or edited by this document; "recommended canonical" and
"proposed park" are advisory labels only.

1. **Workflow core:** recommended canonical = #135 (base `main`, self-contained, guard-compatible);
   proposed park = #124 (overlapping duplicate at the same path).
2. **Operator console:** recommended canonical = #138 (base `main`); proposed park = #119 (sandbox
   variant on `ep002`). Follow-up recommended: repoint #138 at #135's engine (see §8) rather than
   keeping the parallel view-model.
3. **Compliance gate / mock CRM+appointment:** where a `main`-based and an `ep002`-based PR overlap
   (#120 vs #129; #121 vs #128), the proposal prefers the `main`-based PR to avoid the integration-
   branch detour — pending confirmation that #135's in-engine ports do not already subsume them.
4. **Proof line:** adopt #140 as the proposed receipt spec of record; reconcile #126 (Python
   generator), #123 (harness), #127 and #141 (docs) into a single proof-receipt + dispute-replay
   line, and decide a single runtime home (TS vs Python) for it.
5. **Integration wave (last):** only after #135 + #138 land, the future `gtmOs` assembly layer of §8.

---

## 10. Proposed next-worker prompt (future / not authorization)

Included **only because §7 verifies a real gap.** This is a **proposed** brief for a future,
separately-authorized worker; it is **not** authorization to implement, and it is **gated on #135
and #138 landing on `main`**.

> **Future worker — "GTM OS v0 Assembly" (gated on #135 + #138 merged; mock-only; report back before
> any PR state change).** In a **new** `gtmOs` assembly module (never `packages/agents/src/closer/`
> and never a second `/operator` route), compose the already-landed pieces into one runnable v0
> demo: drive #135's `SalesCloserWorkflow` from the operator console (repointing #138 rather than
> duplicating it); on **every** transition, append to the existing `actionLedger` and emit a
> proof receipt shaped per #140 (`docs/architecture/proof-receipt-spec.md`); add a tenant registry
> for `demandara_internal`, `cognitia_internal`, and `budget_wheels_demo` (sandbox unless cleared).
> No live outreach, no live CRM/calendar, no vendor calls, no network, no raw PII, no new
> dependencies. Decide a single runtime home for the proof line (TS vs the Python #125/#126 skills)
> and bridge it explicitly.

---

## 11. Mock-safety & guardrail attestation (this document)

This wave wrote **one markdown document and no code**. It asserts:

- No live outreach of any kind, and no instruction to perform any.
- No real prospect data and no raw PII; any illustrative contact referenced in the codebase uses
  `.example`/`.invalid`/`.test` domains and `555-01xx` numbers only.
- No crypto/fundraising hype language is introduced; where parked-lane vocabulary is discussed it is
  referred to by category, not spelled out.
- No scraping or platform-ToS-violating collection.
- No network calls, vendor SDKs, or secrets added.
- Budget Wheels is treated as a **sandbox** tenant; it is not represented as a real, cleared client.

## 12. Unresolved ambiguity

- **PR status is point-in-time.** All open/draft labels reflect observation on 2026-06-22 and may
  have changed since.
- **#141 base branch.** #141 targets the integration branch `claude/ep002-mission-run-pPoba`, not
  `main`, so its content is not reflected on `main`; the same is true for the other `ep002`-based
  PRs noted as REPORTED.
- **Not all open PRs were diffed.** This verifier read the diffs of #135, #138, #124, #125, #126,
  #140, and #141 (VERIFIED) and took the remainder from list metadata (REPORTED). A non-target PR
  could touch an unrelated file not observed here.
- **Base-branch reality.** Because several PRs target `ep002` rather than `main`, the assembled state
  differs between `main` and that integration branch; a future wave should pick one canonical base
  before reconciling.
