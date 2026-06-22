# Proof-Governed GTM OS v0 — Build Reconciliation & Ownership Map

**Status:** Non-operative reference. This document records findings and
recommendations only. It does **not** authorize any merge, undraft, retarget,
close, archive, branch deletion, PR-body edit, or code change. Any sequencing
described here is a recommendation for a future, separately-authorized wave.

**Prepared by:** Controller (GTM OS v0 build-wave intake)
**Date:** 2026-06-22
**Scope of this wave:** ownership map + reconciliation only. No feature code was
written.

---

## 1. Why this document exists

The GTM OS v0 build target is:

> lead in → consent/compliance gate → human approval → appointment / mock CRM
> writeback → proof receipt / report

Before writing code, the wave performed the required ownership map. The finding:
**the entire v0 target already exists** — partly merged on `main`, and partly
spread across multiple open PRs (often several competing PRs per component).
There is no path in the requested scope that can be added without colliding with
merged code or an open PR. Per the wave's hard rule ("if path ownership overlaps
another open PR, stop and report"), the wave stopped and produced this map
instead of duplicating work.

This document is the deliverable. It maps each stage of the build target to the
code that already implements it, names a recommended canonical owner per
component, and lists the genuine gaps that a future authorized wave could build
without conflict.

### Evidence labels

| Label | Meaning |
| --- | --- |
| **VERIFIED** | File contents were read directly from the repo (`main`) or from the PR diff during this run. |
| **REPORTED** | Known only from PR list metadata (number, title, branch, base, draft state) during this run — file contents not individually read. |
| **ACCEPTED** | Assumed from naming/convention; not directly checked this run. |

---

## 2. Build target → existing substrate on `main` (VERIFIED)

All rows below were confirmed by reading the source on `origin/main` during this
run.

| Target stage | Module on `main` (VERIFIED) | Key exported behavior |
| --- | --- | --- |
| Action ledger / run actions | `packages/agents/src/ledger/actionLedger.ts` | `ActionLedger.propose / approve / reject / execute / rollback`; idempotency on `tenant_id + idempotency_key`; mandatory structured decision reason; refuses execution unless `approval_status === 'approved'`; emits immutable events + audit on every transition |
| Append-only event registry | `packages/core/src/events/index.ts` | `EVENT_PAYLOADS` incl. `agent.action.proposed/approved/rejected/executed/execution_denied/rolled_back`, `inbound.lead.received.v1`, `crm.*`, `calendar.meeting.booked.v1`; `validateEvent`, `makeEvent` |
| Consent / compliance + PII-safe prospect | `packages/core/src/gtm/index.ts` | `normalizeGtmProspect` (hashes/masks/drops raw email+phone), `canContactProspect`, `canUseSourceForProspecting`, `classifySourceRisk`, `requiresHumanReviewForOutreach`, `createGtmProofEvent`, `GTM_OUTREACH_REQUIRES_HUMAN_APPROVAL` |
| Approval policy | `packages/core/src/policies/index.ts`, `packages/agents/src/policies/policyGate.ts` | `classifyRisk`, `decideApproval` (suppressed → blocked; default human approval) |
| Mock / governed CRM writeback | `packages/integrations/src/hubspot/*` (`adapter.ts`, `writePlan.ts`, `rollback.ts`, `readiness.ts`, `sync.ts`) | typed CRM write plan + reversible rollback; readiness gating |
| Proof receipt / trust packet | `apps/api/src/proofs.ts`, `apps/api/src/trustPacket.ts`, `apps/api/src/trustMetrics.ts` | proof + trust packet endpoints |
| Operator surfaces | `apps/web/src/app/approvals/`, `discovery/`, `proofs/`, `trust/`; `apps/web/src/lib/compliance.ts`, `approvalQueue.ts`, `complianceFixtures.ts` | approval queue, compliance evaluation, demo fixtures |
| Runs / events / actions schema | `packages/db/migrations/0004_events_agent_runs_actions.sql`, `0020_closer_sources_runs.sql`, `0021_closer_profiles_briefs.sql` | persisted runs/actions/events + closer sources/runs/profiles |

**Implication:** the run/ledger model, prospect workspace fields, compliance
gate, approval gate, mock CRM writeback, and proof receipt primitives are
**already present and merged**. A v0 demo is an *assembly* problem, not a
*build-from-scratch* problem.

---

## 3. Open-PR ownership of the v0 target

The repository currently has ~57 open PRs. The ones whose paths overlap the v0
target are below. PRs marked VERIFIED had their diffs read this run; others are
REPORTED from PR-list metadata.

| Target item | PR | Title (verbatim, trimmed) | Base | Path owned | Evidence |
| --- | --- | --- | --- | --- | --- |
| Workflow core (the exact lead→…→proof state machine, with allowed/blocked/rejected/approved tests) | **#135** | "W1 Sales Closer workflow core (mock-safe happy path)" | `main` | `packages/agents/src/closer/` | **VERIFIED** |
| Workflow core (duplicate) | **#124** | "Client Zero Sales Closer workflow core (mock-only)" | `main` | `packages/agents/src/closer/` (overlaps #135) | REPORTED |
| Operator console (MOCK banner, compliance badge, blocked reasons, approve/reject, mock CRM/appointment, proof report, no send controls) | **#138** | "W4 Operator Console — mock-safe Sales Closer workflow" | `main` | `apps/web/src/app/operator/`, `apps/web/src/lib/operatorConsole.ts` | **VERIFIED** |
| Operator console (sandbox variant) | **#119** | "Client Zero Sales Closer — operator console (sandbox)" | `claude/ep002-mission-run-pPoba` | operator console surface | REPORTED |
| Append-only action ledger / signal bus (lead/compliance/approval/appointment/crm/proof events, idempotent, hash-chained) | **#125** | "W6: Signal bus / action ledger (append-only event spine)" | `main` | `hermes/skills/signal-bus/` | **VERIFIED** |
| Proof report generator (consent/compliance/approval + verified/inference/unknown, no token language, idempotent checksum) | **#126** | "W5 Proof Harness: Sales Closer proof report generator" | `main` | `hermes/skills/proof-report/` | **VERIFIED** |
| Proof receipt spec | **#140** | "Add proof receipt specification for GTM actions" | `main` | proof-receipt doc | REPORTED |
| Proof harness (client-zero) | **#123** | "Client Zero acceptance-proof harness" | `claude/ep002-mission-run-pPoba` | proof harness | REPORTED |
| Proof receipt & dispute layer doc | **#127** | "Add Proof Receipt & Dispute Layer architecture doc" | `claude/ep002-mission-run-pPoba` | architecture doc | REPORTED |
| Dispute replay pack doc | **#141** | "Add Dispute Replay Pack architecture doc" | `claude/ep002-mission-run-pPoba` | architecture doc | REPORTED |
| Compliance gate (W2) | **#129** | "W2 compliance gate for the Sales Closer workflow" | `claude/ep002-mission-run-pPoba` | compliance gate | REPORTED |
| Compliance gate (client-zero) | **#120** | "Client Zero compliance gate adapter" | `main` | compliance gate adapter | REPORTED |
| Mock CRM / appointment (W3) | **#128** | "W3: Mock CRM/appointment adapters (Client Zero)" | `claude/ep002-mission-run-pPoba` | mock CRM/appointment adapters | REPORTED |
| Mock CRM / appointment (client-zero) | **#121** | "Client Zero: mock appointment → CRM writeback adapter (mock-only)" | `main` | mock appointment→CRM adapter | REPORTED |
| TrustOps analytics doc | **#139** | "Add TrustOps analytics architecture doc" | `main` | trustops analytics doc | REPORTED |
| Build/moat reconciliation doc | **#142** | "Client Zero build/moat reconciliation" | `main` | execution reconciliation doc | REPORTED |
| Approval queue UI (Lane B) | **#78** | "operator Approval Queue + Run visibility surfaces" | `claude/gtm-platform-mvp-setup-vYLBG` | operator approval/run UI | REPORTED |
| Agent Action Passport (docs) | **#136**, **#132** | passport architecture/spec | `ep002` | passport docs | REPORTED |

**Conclusion:** every one of the 7 requested build items is owned by at least
one open PR, and the two most central (workflow core #135, operator console
#138) were read this run and confirmed to implement the v0 target almost
exactly, including the mock-safety guardrails (no send/SMS/call/WhatsApp
controls; mock-only CRM; PII-safe lead detail; mandatory human approval).

---

## 4. Duplicate clusters (for a future authorized reconciliation)

These are observations, not actions. This wave performs no PR state changes.

1. **Workflow core:** #135 (VERIFIED, base `main`) vs #124 (REPORTED, base
   `main`) — overlapping `packages/agents/src/closer/`.
2. **Operator console:** #138 (VERIFIED, base `main`) vs #119 (REPORTED, base
   `ep002`) — overlapping operator console surface.
3. **Proof layer:** #126 (VERIFIED generator) vs #140 (REPORTED spec) vs #123
   (REPORTED harness) vs #127/#141 (REPORTED dispute/receipt docs).
4. **Compliance gate:** #129 (REPORTED, base `ep002`) vs #120 (REPORTED, base
   `main`).
5. **Mock CRM/appointment:** #128 (REPORTED, base `ep002`) vs #121 (REPORTED,
   base `main`).
6. **Base-branch split:** a large subset of PRs target the integration branch
   `claude/ep002-mission-run-pPoba` rather than `main`, so their work is not yet
   reflected on `main`.

### Recommended sequencing (non-operative)

For a future, separately-authorized integration wave only:

- **#135 canonical** workflow core; **#124 parked** (overlapping duplicate).
- **#138 canonical** operator console; #119 treated as the sandbox-variant input
  to reconcile against #138 later.
- **Proof / report PRs (#126, #140, #123, #127, #141) reconciled later** into a
  single proof-receipt + dispute-replay line.
- **Compliance gate (#120 / #129)** and **mock CRM/appointment (#121 / #128)**
  reconciled to one canonical adapter each, preferring the `main`-based PR to
  avoid the `ep002` base-branch detour.

No PR is to be closed, retargeted, merged, undrafted, archived, or edited as
part of this recommendation. Selection and execution require a separate
authorization.

---

## 5. Genuine gaps (no open PR owns these — future build candidates)

1. **Thin integration/orchestration layer** that composes only already-merged
   `main` exports (`ActionLedger`, core `gtm`, core `events`, hubspot mock
   adapter, `apps/api/src/proofs.ts`) into one runnable v0 flow. Must live in a
   **new module name** distinct from `packages/agents/src/closer/` (owned by
   #135) — e.g. a `gtmOs` module — to stay non-overlapping.
2. **Tenant wiring** for the two intended tenants:
   - Demandara / Cognitia internal tenant.
   - **`budget_wheels_demo` — "Tenant Zero sandbox."** Budget Wheels is to be
     treated as a controlled **sandbox** tenant unless the founder confirms
     real, documented consent/control. No real Budget Wheels prospect data is to
     be used until that confirmation exists.
3. **End-to-end demo runbook** stitching the operator console (#138) to the
   workflow core (#135) to the proof report (#126) once those are reconciled.

These are listed as candidates only; this document authorizes none of them.

---

## 6. Mock-safety & guardrail attestation for this wave

This wave wrote **one markdown document and no code**. It asserts:

- **No live outreach** of any kind (no SMS, calls, WhatsApp, LinkedIn
  automation, email send, ads, or vendor calls).
- **No real prospect data and no raw PII.** This document contains no contact
  data; any illustrative contact in the codebase uses `.example` addresses and
  `555-01xx` phone numbers only.
- **No token / presale / yield / liquidity / airdrop / listing / payment-rail /
  investment language.** Integrity in the referenced proof tooling is a local
  SHA-256 content digest, described as such — not a "chain", "ledger token", or
  financial instrument.
- **No scraping** and no platform-ToS-violating data collection.
- **No network calls, vendor SDKs, or `process.env` secrets** were added.
- MoverOS is not Client Zero; Hermes Vision is not represented as the company
  direction; Budget Wheels is treated as a sandbox tenant per §5.

---

## 7. Unresolved ownership ambiguity

- **Cross-PR ownership not exhaustively scanned.** Path ownership for the v0
  target was established by reading #135, #138, #125, #126 directly (VERIFIED)
  and the remaining overlapping PRs from list metadata (REPORTED). The full file
  lists of all ~57 open PRs were not individually fetched, so a non-target PR
  could touch an unrelated file under `docs/cognitia/` that was not observed.
- **New doc path confirmed novel on `main`.** `docs/cognitia/gtm-os/` is absent
  from `origin/main` (verified this run). It was not confirmed absent across all
  open PR branches; the name was chosen to be novel and is not referenced by any
  observed PR title or branch.
- **Base-branch reality.** Because many PRs target `claude/ep002-mission-run-pPoba`,
  the true "assembled" state differs between `main` and that integration branch.
  A future wave should pick one canonical base before reconciling.
