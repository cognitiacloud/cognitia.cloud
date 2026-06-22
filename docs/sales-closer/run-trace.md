# Sales Closer Run Trace — Developer-facing Timeline & Result Summary

> **Status:** Implemented (mock spine). In-memory/mock only — no DB, no external
> logging, no vendor monitoring.
> **Module:** `packages/agents/src/closer/runTrace.ts`
> **Tests:** `packages/agents/src/closer/runTrace.test.ts`

## Purpose

The Sales Closer workflow core (`SalesCloserWorkflow.run`, `salesCloserWorkflow.ts`)
walks one lead through a mock-safe state machine and returns a `WorkflowRun` — an ordered
`transitions[]` log plus the `proofs[]` it collected. That record is complete but not
shaped for a human reading a demo or a report.

`buildRunTrace(run)` is a **pure derivation** over that `WorkflowRun`. It produces a flat,
JSON-safe, PII-redacted timeline where each line aligns, for one transition:

- the **state** entered,
- the **event** (which boundary drove the transition),
- the **timestamp**,
- the **policy decision**,
- the **approval state**,
- the **mock writeback result**, and
- the **proof receipt id**.

It adds **no behavior**: it never runs the workflow, calls a port, or mutates the run.
Importing or calling it cannot change how a run executes — the trace is a read-only view.

## How to produce a trace

```ts
import {
  buildRunTrace,
  traceToJsonString,
  createSalesCloserWorkflow,
  createMockCloserPorts,
} from '@cognitia/agents';

const run = await createSalesCloserWorkflow({ ports: createMockCloserPorts() }).run(lead);

const summary = buildRunTrace(run); // RunTraceSummary (JSON-safe object)
const json = traceToJsonString(run); // pretty-printed JSON for a demo/report
```

`traceToJson(run)` is an alias of `buildRunTrace(run)`; `traceToJsonString(run, space?)`
serializes it (2-space pretty-print by default).

## Data model

### `RunTraceSummary`

| Field                      | Type                                              | Meaning                                               |
| -------------------------- | ------------------------------------------------- | ----------------------------------------------------- |
| `runId`                    | `Uuid`                                            | The prospect id of the run.                           |
| `subject`                  | `RedactedSubject`                                 | PII-safe projection of the prospect (whitelist).      |
| `status` / `outcome`       | `'completed' \| 'blocked' \| 'awaiting_approval'` | Terminal disposition (from `WorkflowRun.status`).     |
| `finalState`               | `SalesCloserState`                                | The last state reached.                               |
| `blockedReason?`           | `string`                                          | Redacted reason a blocked run halted.                 |
| `startedAt` / `finishedAt` | `IsoTimestamp \| null`                            | First / last transition timestamp.                    |
| `lineCount`                | `number`                                          | Number of timeline lines.                             |
| `proofReceiptIds`          | `string[]`                                        | Every event-backed proof handle referenced, in order. |
| `proofLaneStatus`          | `'active' \| 'absent'`                            | Whether the proof lane was available to map.          |
| `proofReceiptHandleStatus` | `'pending'`                                       | See [Proof receipts](#proof-receipts).                |
| `redactionCount`           | `number`                                          | Redactions applied (suppressed fields + masked text). |
| `lines`                    | `RunTraceLine[]`                                  | The timeline.                                         |

### `RunTraceLine`

| Field            | Type                                                                          | Derived from                                                                           |
| ---------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `seq`            | `number`                                                                      | 0-based position.                                                                      |
| `state`          | `SalesCloserState`                                                            | `WorkflowTransition.to`.                                                               |
| `event`          | `TransitionVia`                                                               | `WorkflowTransition.via` (`init`/`compliance`/`approval`/`appointment`/`crm`/`proof`). |
| `timestamp`      | `IsoTimestamp`                                                                | `WorkflowTransition.at`.                                                               |
| `policyDecision` | `'allow' \| 'block' \| 'not_applicable'`                                      | The compliance transition (`blocked_compliance` → `block`, else `allow`).              |
| `approvalState`  | `'approved' \| 'rejected' \| 'pending' \| 'not_required' \| 'not_applicable'` | The approval transition.                                                               |
| `writeback`      | `'ok' \| 'failed' \| 'skipped' \| null`                                       | The CRM transition (`null` on non-CRM lines).                                          |
| `proofReceiptId` | `string \| null`                                                              | `GtmProofEvent.id` of the proof produced at this phase.                                |
| `detail?`        | `string`                                                                      | Redacted `WorkflowTransition.detail`.                                                  |

> The trace `policyDecision` is intentionally a string-union (`TracePolicyDecision`),
> distinct from the agent policy engine's `PolicyDecision` interface
> (`policies/policyGate.ts`); they are different concepts.

## The three paths

The mock ports (`createMockCloserPorts(overrides)`) drive every branch offline. The
examples below are the real, deterministic output (fixed clock + ids) for the fixture
lead `Northshore Auto Group`.

### Happy path → `completed`

Compliance `allow` → approval `approved` → appointment → CRM writeback `ok` → proof
report → `completed`. The appointment and CRM lines carry the two proof handles.

```json
{
  "runId": "00000000-0000-0000-0000-000000000000",
  "subject": {
    "id": "00000000-0000-0000-0000-000000000000",
    "companyName": "Northshore Auto Group",
    "region": "Vancouver, BC, CA",
    "businessType": "auto_dealership",
    "source": "public_registry",
    "sourceRisk": "low",
    "consentStatus": "implied_possible"
  },
  "status": "completed",
  "finalState": "completed",
  "outcome": "completed",
  "startedAt": "2026-06-21T00:00:00.000Z",
  "finishedAt": "2026-06-21T00:00:00.000Z",
  "lineCount": 6,
  "proofReceiptIds": [
    "00000000-0000-0000-0000-000000000001",
    "00000000-0000-0000-0000-000000000002"
  ],
  "proofLaneStatus": "active",
  "proofReceiptHandleStatus": "pending",
  "redactionCount": 0,
  "lines": [
    {
      "seq": 0,
      "state": "compliance_check_required",
      "event": "init",
      "timestamp": "2026-06-21T00:00:00.000Z",
      "policyDecision": "not_applicable",
      "approvalState": "not_applicable",
      "writeback": null,
      "proofReceiptId": null
    },
    {
      "seq": 1,
      "state": "human_approval_required",
      "event": "compliance",
      "timestamp": "2026-06-21T00:00:00.000Z",
      "policyDecision": "allow",
      "approvalState": "not_applicable",
      "writeback": null,
      "proofReceiptId": null
    },
    {
      "seq": 2,
      "state": "appointment_requested",
      "event": "approval",
      "timestamp": "2026-06-21T00:00:00.000Z",
      "policyDecision": "not_applicable",
      "approvalState": "approved",
      "writeback": null,
      "proofReceiptId": null,
      "detail": "standard human approval gate"
    },
    {
      "seq": 3,
      "state": "crm_writeback_requested",
      "event": "appointment",
      "timestamp": "2026-06-21T00:00:00.000Z",
      "policyDecision": "not_applicable",
      "approvalState": "not_applicable",
      "writeback": null,
      "proofReceiptId": "00000000-0000-0000-0000-000000000001"
    },
    {
      "seq": 4,
      "state": "proof_report_requested",
      "event": "crm",
      "timestamp": "2026-06-21T00:00:00.000Z",
      "policyDecision": "not_applicable",
      "approvalState": "not_applicable",
      "writeback": "ok",
      "proofReceiptId": "00000000-0000-0000-0000-000000000002"
    },
    {
      "seq": 5,
      "state": "completed",
      "event": "proof",
      "timestamp": "2026-06-21T00:00:00.000Z",
      "policyDecision": "not_applicable",
      "approvalState": "not_applicable",
      "writeback": null,
      "proofReceiptId": null
    }
  ]
}
```

### Blocked path → `blocked_compliance`

A policy block at the compliance boundary halts the run before any proof is produced.
The compliance line shows `policyDecision: "block"`; `proofReceiptIds` is empty.

```json
{
  "status": "blocked",
  "finalState": "blocked_compliance",
  "outcome": "blocked",
  "lineCount": 2,
  "proofReceiptIds": [],
  "blockedReason": "legal review",
  "lines": [
    {
      "seq": 0,
      "state": "compliance_check_required",
      "event": "init",
      "policyDecision": "not_applicable",
      "approvalState": "not_applicable",
      "writeback": null,
      "proofReceiptId": null
    },
    {
      "seq": 1,
      "state": "blocked_compliance",
      "event": "compliance",
      "policyDecision": "block",
      "approvalState": "not_applicable",
      "writeback": null,
      "proofReceiptId": null,
      "detail": "legal review"
    }
  ]
}
```

### Rejected path → `blocked_approval`

Compliance passes, then a human rejects at the approval gate. The approval line shows
`approvalState: "rejected"`; nothing downstream runs, so there are no proofs.

```json
{
  "status": "blocked",
  "finalState": "blocked_approval",
  "outcome": "blocked",
  "lineCount": 3,
  "proofReceiptIds": [],
  "blockedReason": "not a fit",
  "lines": [
    {
      "seq": 0,
      "state": "compliance_check_required",
      "event": "init",
      "policyDecision": "not_applicable",
      "approvalState": "not_applicable",
      "writeback": null,
      "proofReceiptId": null
    },
    {
      "seq": 1,
      "state": "human_approval_required",
      "event": "compliance",
      "policyDecision": "allow",
      "approvalState": "not_applicable",
      "writeback": null,
      "proofReceiptId": null
    },
    {
      "seq": 2,
      "state": "blocked_approval",
      "event": "approval",
      "policyDecision": "not_applicable",
      "approvalState": "rejected",
      "writeback": null,
      "proofReceiptId": null,
      "detail": "not a fit"
    }
  ]
}
```

> "Blocked" vs "rejected" both surface as `outcome: "blocked"` in the canonical spine, but
> the trace distinguishes them by line: a **blocked** run carries a `policyDecision: "block"`
> compliance line; a **rejected** run carries an `approvalState: "rejected"` approval line.

## PII redaction

The trace is built to never surface raw PII, by two complementary mechanisms:

1. **Whitelist subject.** `RedactedSubject` exposes only business-safe fields: `id`,
   `companyName`, `region` (city/province/country), `businessType`, `source`,
   `sourceRisk`, `consentStatus`. The normalized `GtmProspect` already drops raw
   email/phone (they are hashed/masked upstream), but it still carries `contactName`,
   masked email/phone, `contactDomain`, and free-text `notes`. None of those reach the
   trace. Building by allow-list (not deny-list) means a newly added sensitive field on
   `GtmProspect` cannot silently leak.
2. **Text masking.** Every `detail` and `blockedReason` string is run through
   `redactText`, which masks any email or phone-like substring (7+ digits) to
   `[redacted]`.

`redactionCount` reports how many redactions were applied (suppressed non-null sensitive
fields + masked text hits) so a caller can assert that redaction ran. The test suite
asserts that a `traceToJsonString(run)` for a lead carrying a real email/phone/notes
contains no `@` and none of the raw phone fragments.

## Proof receipts

The Sales Closer **proof lane exists today** as `ProofPort.record(GtmProofEvent)`
(`ports.ts`), and the workflow collects `GtmProofEvent`s during the run. So
`proofLaneStatus` is `"active"`, and each relevant trace line maps to a proof via its
phase:

| Phase (`event`) | Proof kind                  | `proofReceiptId` source         |
| --------------- | --------------------------- | ------------------------------- |
| `appointment`   | `gtm.discovery.booked.v1`   | the matching `GtmProofEvent.id` |
| `crm`           | `gtm.proposal.generated.v1` | the matching `GtmProofEvent.id` |

**Important precision:** the id on a trace line is the **proof event's own id**
(`GtmProofEvent.id`) — an _event-backed proof handle_. There is **no separate,
boundary-minted proof receipt yet**: `ProofPort.record` returns only
`ProofRecordResult { status, reason }`, with no receipt handle. The field is named
`proofReceiptId` for forward-compatibility, but until a formal receipt handle lands it is
the event-backed proof handle, not a distinct receipt.

This is recorded explicitly:

- `PROOF_RECEIPT_HANDLE_STATUS = 'pending'` (exported constant), surfaced on every summary
  as `proofReceiptHandleStatus`.
- `proofReceiptIdForTransition(via, proofs)` is the **single seam**. When the proof
  boundary begins minting a formal receipt handle, substitute it there (and flip the
  status constant). No other code needs to change.

## Out of scope

No DB, no external/file logging, no vendor monitoring, and no real proof-lane
implementation. The trace is an in-memory, mock-safe, read-only projection of a
`WorkflowRun`.
