# Integration Contract — Client Zero Proof Harness

This harness is **fixture-driven today** and **worker-ready tomorrow**. It defines
the seam where the workflow, compliance, and CRM workers plug in. The schemas in
[`packages/core/src/schemas.ts`](../packages/core/src/schemas.ts) are the **single
source of truth**; this document explains what each worker must emit and the
invariants the harness enforces.

> Status: as of this PR, no workflow / compliance / CRM worker outputs exist in
> the repo. The harness consumes fixtures shaped exactly like the live worker
> outputs will be, so swapping fixtures for real outputs is a drop-in change at
> the `runScenario()` boundary.

## The seam

```ts
import { runScenario } from "proof/src/harness.ts";
const artifact = runScenario(leadIntake, { now, salt });
```

`runScenario(input)` validates `input` against `assertLeadIntake` and runs the
pipeline. To go live, assemble a `LeadIntake` from real worker outputs instead of
reading a fixture file — nothing else changes.

## What each worker must provide

All timestamps are ISO 8601 strings. **No raw PII may cross this boundary in any
field other than `lead.{fullName,email,phone}`** (which the harness redacts to a
salted `leadRef` at intake and never copies onward).

### Lead-in / workflow worker → `LeadIntake`

Owns `scenarioId`, `client`, `source`, `submittedAt`, `requestedAppointment`, and
composes the three gate inputs below.

### Consent worker → `ConsentRecord`

`marketingConsent`, `dataProcessingConsent`, `consentText`, `consentTimestamp`,
`channel`, optional `ipHashRef` (**pre-hashed** — never a raw IP).
**Gate rule:** passes iff `marketingConsent && dataProcessingConsent`.

### Compliance worker → `ComplianceSignals`

`jurisdiction`, `onDoNotContactList`, `ageVerified`, `quietHoursOk`,
`tcpaWrittenConsent`.
**Gate rule:** passes iff not on DNC, age verified, quiet-hours OK, and — for
`US*`/`CA*` calling jurisdictions — `tcpaWrittenConsent` is true.

### Human approver → `ApprovalDecision`

`decision` (`approved` | `rejected` | `pending`), `approverRef` (role id or
pre-hashed reference — **never a raw person name**), `decidedAt`, `notes`.
**Gate rule:** passes iff `decision === "approved"`.

### CRM / scheduling workers (downstream of the gates)

These are produced **by the harness** today as deterministic mocks. When the real
workers land they must return the same shapes:

- `BookingResult`: `{ booked, appointmentRef, slotStart, slotEnd, timezone, provider }`
- `CrmWritebackResult`: `{ written, recordRef, system, fields }` where `fields`
  contains **redacted references only** (e.g. `leadRef`, `appointmentRef`,
  `consentEventHash`) — never raw contact details.

To integrate them, replace `mockBooking` / `mockWriteback` in
[`proof/src/harness.ts`](./src/harness.ts) with calls that return these shapes.
The harness still runs its PII scan and chain verification over the result, so a
non-compliant payload fails closed.

## Invariants the harness guarantees

1. **Ordered hash chain.** Stages run in a fixed order and each event hashes its
   content plus the previous event's hash. `auditChainRoot` is the final hash;
   `verifyChain()` detects any tampering.
2. **Block short-circuits.** The first failing gate sets `outcome="blocked"` and
   `blockedAtStage`; booking and writeback are recorded `skipped`, never executed.
   `isSuccessProof()` is therefore false for any blocked lead.
3. **PII fail-closed.** After assembly, the whole artifact is scanned for
   PII-shaped values (email, phone, secrets, cards, SSN, IP, filesystem paths). A
   single hit makes the harness **throw** — a leaking artifact can never be
   emitted.
4. **No outcome claims.** Every artifact carries the no-guarantee disclaimer and an
   `outcome` restricted to `completed | blocked`.

## Event index

The artifact's `eventIndex` maps each gate to the hash of its event in the chain,
so a verifier can confirm the proof references consent, compliance, approval, and
writeback without re-deriving the pipeline:

```
eventIndex = { consent, compliance, approval, booking, writeback }
```

Each value is the `eventHash` of the corresponding stage event, or `null` if that
stage did not execute (e.g. booking/writeback on a blocked lead).

## Versioning

`ProofArtifact.proofSchemaVersion` (currently `1.0.0`) is bumped on any
breaking change to the artifact shape. Consumers should assert the major version.
