# Client Zero Mock Spine — Proof Receipt & Report

> **Status:** Mock-safe spine (W1) + a pure proof-receipt/report projection. No
> live outreach, no network, no DB, no UI. Everything here runs fully offline.

## What this is

The **Client Zero mock spine** is the offline Sales Closer state machine in
`packages/agents/src/closer/` (`salesCloserWorkflow.ts` + `ports.ts` +
`mockPorts.ts`). It walks one lead through:

```
lead intake → compliance check → human approval → mock appointment →
mock CRM writeback → proof report → completed
```

with explicit terminal blocks (`blocked_compliance`, `blocked_approval`,
`blocked_appointment`, `blocked_crm`, `blocked_proof`) and an
`awaiting_approval` pause. `SalesCloserWorkflow.run` returns a `WorkflowRun`:
the normalized (PII-safe) `prospect`, the ordered `transitions`, the collected
`GtmProofEvent`s (`proofs`), the final `status`/`state`, and any `blockedReason`.

This document covers the **proof receipt/report layer** added in
`proofReceipt.ts` — a formal, run-level record built **from** a `WorkflowRun`.

## What the proof receipt is (and is not)

- It **is** a single, machine-readable, run-level **receipt** summarizing one
  workflow run, plus a human-readable **report** rendered from that receipt.
- It is a **pure projection** of an existing `WorkflowRun` — `buildProofReceipt`
  does no IO and never drives the workflow. There is **no second engine / no
  parallel runtime**.
- The canonical **per-action** proof events remain the workflow's existing
  `GtmProofEvent`s (`run.proofs`). The receipt **references and hashes** them as
  redacted evidence; it does not replace, persist, or re-emit them.
- There is **no persisted proof backend, no live proof service, and no
  proof-per-transition runtime** here. The receipt is built in memory on demand.

## API (`packages/agents/src/closer/proofReceipt.ts`)

- `buildProofReceipt(run: WorkflowRun, opts?): ProofReceipt` — pure,
  deterministic. `opts.runId` (defaults to a deterministic id derived from the
  run) and `opts.generatedAt` (injectable clock) are the only inputs.
- `renderProofReport(receipt: ProofReceipt): string` — plain-text report.
- `verifyProofReceipt(receipt: ProofReceipt): boolean` — recomputes the
  tamper-evidence and returns whether the receipt is intact.

### `ProofReceipt` shape

| Field                                                                       | Meaning                                                               |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `version`                                                                   | `closer.proof-receipt.v1`                                             |
| `runId`, `leadId`                                                           | run identifier and the lead/prospect id                               |
| `status`, `finalState`, `blockedReason`                                     | workflow outcome (mirrors `WorkflowRun`)                              |
| `complianceState` / `approvalState` / `appointmentState` / `writebackState` | derived per-phase outcomes (incl. `not_reached`)                      |
| `subject`                                                                   | business-only, PII-safe lead identity (company/region/source/consent) |
| `startedAt` / `completedAt` / `generatedAt`                                 | ISO-string timestamps (never `Date` objects)                          |
| `transitions[]`                                                             | one entry **per major transition** (`from`/`to`/`via`/`at`/`label`)   |
| `evidence[]`                                                                | redacted view of each `GtmProofEvent`                                 |
| `receiptHash`                                                               | whole-receipt integrity digest                                        |

A receipt entry is emitted for every major transition: lead intake, compliance
(pass/blocked), approval (approved/rejected/pending), mock appointment, mock CRM
writeback, proof report, and completed.

## Redaction / PII stance

- Only PII-safe fields enter the receipt. The `subject` carries business
  identity only — **no** contact name, email, phone, masks, or hashes.
- Evidence copies the already-PII-free `summaryPublic` verbatim. A proof event's
  `detailsPrivate` is **never** copied; only a `detailsHash` (sha256 of its
  canonical form) appears.
- `normalizeGtmProspect` has already hashed/dropped any raw contact PII upstream,
  so raw email/phone never reach this layer in the first place. Tests assert no
  `@`, no raw email/phone, and no `detailsPrivate` in the serialized receipt or
  the rendered report.

## Tamper-evidence

Safe local hashing with `node:crypto` `createHash('sha256')` — the same
primitive the core uses for PII hashing. Two layers, both over a **canonical**
JSON form (sorted keys, `undefined` dropped) so equal content always hashes
equally:

1. **Transition hash-chain** — each entry's `entryHash` is computed over the
   entry content **excluding `entryHash`**, folding in the previous entry's hash
   (seeded by `version|runId|leadId`).
2. **Whole-receipt digest** — `receiptHash` is computed over the entire receipt
   **excluding `receiptHash`**.

`verifyProofReceipt` recomputes both from the same canonical form. This is an
**integrity digest**, not a signed MAC: it detects modification of an emitted
receipt; it carries no secret and is not a signature.

## Doctrine / boundaries

- No live network, CRM, SMS, calls, WhatsApp, LinkedIn, ads, or scraping.
- No edits to the spine (`salesCloserWorkflow.ts`, `ports.ts`, `mockPorts.ts`);
  the receipt is a read-only derivation, so existing tests are untouched.
- `proofReceipt.ts` imports only `node:crypto`, `@cognitia/core` types, and the
  local workflow types — no `@cognitia/db`, no `@cognitia/integrations`, no
  `fetch`/vendor SDKs (asserted by a test).

## Tests

`packages/agents/src/closer/proofReceipt.test.ts` proves receipts on the
**approved/completed**, **rejected**, and **blocked** (compliance + CRM) paths;
that **no raw PII** appears in the receipt or report; that **no live egress**
imports exist; tamper-evidence (mutating any field fails `verifyProofReceipt`);
and determinism.
