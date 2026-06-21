# Client Zero — Appointment → CRM Writeback (MOCK-ONLY)

> **Mock-only statement.** This lane is mock mode only. It makes **no** live
> HubSpot / Supabase / vendor / API call, uses **no** real customer or prospect
> data, sends **no** outreach, and performs **no** network I/O. It only
> _proposes_ a CRM note and _prepares_ a proof. A human approval gate and the
> (later) live transport sit downstream of everything here.

## Why this exists

The PR #115 review of the Client Zero / Auto Growth OS spine
(`docs/reviews/pr-106-client-zero-review.md`) names the end-to-end happy path
that makes Client Zero "READY":

> lead in → consent / compliance gate → human approval → **appointment / CRM
> writeback** → proof report.

PR #86 routed _meeting-notes_ through the governed `crm.note.create` path. The
Client Zero CRM-lite spec (PR #106) defines an **"Appointment"** pipeline stage
(`New → Engaged → Qualified → Appointment → Visit → …`) and no-show recovery but
provisions nothing live. This module supplies the **appointment** writeback leg,
mock-only.

## What it does

`apps/api/src/appointmentWriteback.ts`:

1. **Appointment request model** — `appointmentRequest` (zod) in
   `packages/core/src/schemas/appointment.ts`: `tenant_id`, `appointment_id`,
   `contact_id`, `provider` (`calendly|google|manual`), `event_type`,
   `scheduled_start/end`, `status` (`requested|confirmed|no_show|cancelled`).
   Invitee name/email are accepted at the edge but **never** cross into the note
   body, action `payload_ref`, or any proof surface — only refs/ids do.

2. **Mock CRM note / writeback adapter** — maps an appointment onto the
   **existing governed `crm.note.create` action shape** via
   `appointmentToNoteProposal()` (it proposes; it does not write). The
   `MockCrmWritebackAdapter` implements the real `IntegrationAdapter` contract
   against an in-memory store, so the approve → execute → rollback lifecycle
   works end-to-end with zero external dependencies.

3. **Idempotency key behavior** — `appointmentNoteFingerprint(appointment_id)`
   feeds the shared `idempotencyKey({tenant_id, action_type, target_ref,
content_fingerprint})` helper. One appointment ⇒ exactly one CRM note;
   re-delivery and re-execution collapse to a no-op
   (`idempotent_replay: true`, no new write).

4. **Proof-Harness-consumable result** — `appointmentToProofInput()` returns a
   `proofCreate`-valid body the Proof Registry / Proof Harness consumes.

## Result shape (what the Proof Harness consumes)

`ingestAppointmentWriteback(req, ctx)` returns:

```jsonc
{
  "mock": true,
  "idempotency_key": "<sha256 hex>",
  "proposed_action": {
    "actionType": "crm.note.create",
    "riskLevel": "low",
    "targetRef": "contact:<uuid>",
    "evidenceRefs": ["appointment:<uuid>"],
    "payloadRef": "appointment-summary:<uuid>", // summary stays out-of-band
    "idempotencyKey": "<sha256 hex>",
  },
  "proof_input": {
    // a valid proofCreate body
    "kind": "booking",
    "subject_type": "appointment",
    "subject_id": "<uuid>",
    "evidence_tag": "verified_fact",
    "evidence_ref": "appointment:<uuid>:mock:<fingerprint>",
    "verifier_ref": "verifier:client-zero-mock",
    "summary_public": "Mock <provider> appointment writeback prepared (<event_type>) for a Client Zero contact.",
    "details_private": { "mock": true, "simulated": true, "...": "no PII" },
  },
}
```

The proof is tagged `verified_fact` (the mock run deterministically happened,
mirroring the `agentFabric` / `agentEconomy` simulators) and carries an explicit
`mock`/`simulated` flag in `details_private` so it is never mistaken for a live
CRM write. `recordAppointmentProof()` persists it via the real `createProof`
service; its public projection (`toPublicProof`) exposes only
`{id, kind, evidence_tag, summary_public, supersedes_proof_id, created_at}` and
leaks none of `details_private` / `evidence_ref` / `verifier_ref` / `subject_id`
/ `tenant_id`.

## The live seam (deliberately not built here)

A real run would attach exactly where the HubSpot path does: an operator-gated
transport delivers the approved action, and a real CRM client (injected into an
adapter modeled on `StubHubspotAdapter` / `HubspotClient`) performs the write —
idempotent on the same key. None of that ships in this lane.

## Tests

`apps/api/src/appointmentWriteback.test.ts` — fixture-based, fakes-only, no
network. Fixtures live in `apps/api/src/__fixtures__/appointments/` (synthetic
data only: deterministic UUIDs, `example.com` emails). Covers request-model
validation, governed-action mapping, deterministic idempotency, PII never
reaching the proposal/proof surface, the idempotent mock adapter
(write-once-then-replay + idempotent rollback + unapproved-action refusal), and
a persisted proof whose public projection stays clean.
