# TrustOps Analytics (Sales Closer)

> **MOCK / SANDBOX.** This subsystem analyzes mock Sales-Closer workflow and
> proof events only. It makes no production-readiness claims, touches no live
> data, and performs no network egress. All examples use the
> `budget_wheels_demo` tenant (Tenant Zero).

TrustOps turns a list of mock workflow-run summaries into funnel + safety +
trust metrics and a human-readable report. It is pure, deterministic, and
self-contained: it defines its own input vocabulary and does not import from
sibling lanes.

Source: `packages/agents/src/trustops/metrics.ts`,
`packages/agents/src/trustops/report.ts`.

## Input shape

The analytics input unit is `WorkflowRunSummary` — one record per lead driven
through the (mock) Sales Closer workflow. It mirrors, but does not import, the
closer-lane `WorkflowRun` shape. It carries **no raw PII**: the only identifier
is an opaque `runId`, plus optional aggregate counts and non-PII reason strings.

| Field | Meaning |
| --- | --- |
| `runId` | Opaque, non-PII run identifier |
| `tenant` | Tenant scope (sandbox: `budget_wheels_demo`) |
| `status` | `completed` \| `blocked` \| `awaiting_approval` |
| `compliance` | `pass` \| `blocked` |
| `approval` | `approved` \| `rejected` \| `pending` (undefined if never reached) |
| `appointment` | `requested` \| `succeeded` \| `failed` \| `skipped` |
| `crm` | `ok` \| `failed` \| `skipped` (CRM writeback is always mock) |
| `proofEventsRecorded` | Count of proof events recorded during the run |
| `blockedReason` | Non-PII reason string when blocked |

## Metric definitions

`computeTrustOpsMetrics(runs)` produces:

- **leadsReceived** — total runs analyzed.
- **compliancePass / complianceBlock** — compliance boundary outcomes.
- **approvalApproved / approvalRejected / approvalPending** — human-approval
  outcomes. There is no autonomous send path; every run needs a human gate.
- **appointmentRequested / appointmentSucceeded** — scheduler outcomes
  (`succeeded` implies `requested`).
- **crmWritten** — mock CRM writebacks that returned `ok`.
- **proofEventsRecorded** — total proof events across all runs.
- **completed / blocked / awaitingApproval** — terminal run dispositions.
- **blockedReasons** — blocked runs grouped by `(stage, reason)`, sorted by
  count desc then stage then reason. Stage is derived by `classifyBlockStage`.
- **approvalCoverage** — fraction of runs that reached the approval gate and
  received an explicit decision (approved or rejected, not pending), in [0, 1].
  No runs reaching the gate ⇒ coverage `1` (vacuously covered).
- **egress** — a `noLiveEgress: true` attestation, always present.

## Trust / safety score model

`computeTrustScore(metrics)` returns a 0-100 score with a transparent,
auditable breakdown. Component weights sum to 100.

| Component | Weight | Achieved (ratio) |
| --- | ---: | --- |
| Human-approval coverage | 40 | `approvalCoverage` |
| Compliance-block handling | 25 | `1` unless completed runs exceed compliance passes |
| No-live-egress attestation | 25 | `1` when attestation holds, else `0` |
| Proof-event coverage of completed runs | 10 | `min(1, proofEvents / completed)` |

Points earned per component = `round(weight * ratio)`. The total is clamped to
`[0, 100]`. Each component is independently inspectable so a reviewer can see
exactly why a score is what it is.

## Report

`buildTrustOpsReport(runs)` computes metrics + score and renders a deterministic
markdown report (`renderTrustOpsReport`). Every report opens with the
`MOCK / SANDBOX` banner and includes: the score breakdown table, the funnel
table, run dispositions, safety section (approval coverage + blocked reasons),
and the egress attestation. The report contains only aggregates and reason
strings — never raw PII.

## Capability status

| Capability | Status |
| --- | --- |
| Funnel + safety metric computation (pure) | REAL |
| Trust/safety score (0-100, transparent) | REAL |
| Markdown report rendering | REAL |
| No-live-egress attestation | REAL (sandbox invariant) |
| Input event source (workflow runs) | MOCK / SANDBOX |
| CRM writeback reflected in metrics | MOCK |
| Live ingestion / persistence of metrics | PLANNED |
| Alta analytics dashboard wiring | PLANNED |

## Mapping to Alta analytics

In the Alta analytics model, these metrics map as follows (all PLANNED for live
wiring; current implementation is sandbox-only):

- **Funnel** → Alta lead → qualified → meeting-booked conversion funnel.
- **approvalCoverage** + **complianceBlockHandling** → Alta trust/safety
  governance KPIs (human-in-the-loop coverage, suppression honoring).
- **blockedReasons** → Alta drop-off / objection analysis.
- **Trust score** → a single Alta "TrustOps health" gauge backed by the
  transparent component breakdown.
- **egress attestation** → Alta compliance/audit panel ("no live egress").

When promoted from sandbox, the only change is the input source: real
(consented, suppression-aware) run summaries replace the mock ones. The metric
definitions, score model, and report are unchanged.
