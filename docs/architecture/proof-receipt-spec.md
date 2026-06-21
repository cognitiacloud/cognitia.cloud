# Proof Receipt Specification

Every go-to-market (GTM) action performed by a Cognitia agent **must emit a
proof receipt**: a small, tamper-evident, privacy-safe record describing what
the action was, what policy decided about it, whether it was approved, and what
evidence backs it. Receipts are the audit and trust backbone of the GTM agent
layer — they let an operator (or an auditor) reconstruct _exactly_ what an agent
did on behalf of a tenant, **without ever exposing raw personal data**.

A receipt answers four questions for a single action:

- **What happened?** (`action_type`, `source_event_id`, `output_digest`)
- **Was it allowed?** (`policy_decision`, `blocked_reasons`)
- **Who approved it?** (`approval_state`)
- **What proves it?** (`evidence_tags`, `redacted_input_digest`,
  `proof_report_ref`)

## Design principles

- **No raw PII.** Receipts never contain names, emails, phone numbers, message
  bodies, lead details, or any other personal data. Personal data is replaced by
  **digests** (one-way hashes of redacted payloads) and **evidence tags**
  (non-identifying labels). This mirrors the wider Cognitia privacy posture,
  where content is redacted before anything leaves a safety gate.
- **One receipt per action.** Each GTM action emits exactly one receipt. A
  business outcome (e.g. a booked lead) is a _chain_ of receipts linked by
  `source_event_id` and `proof_report_ref`.
- **Append-only / tamper-evident.** Receipts are immutable once written. State
  changes (e.g. an approval moving from `pending` to `approved`) are expressed as
  **new** receipts that reference the prior one, never as edits.
- **Deterministic digests.** Digests are computed over a canonicalized, redacted
  payload so the same redacted input always yields the same digest, enabling
  verification and de-duplication.
- **Mock-first, no live integrations.** The scheduling and CRM stages described
  below are **mocks**. This spec defines the receipt _shape_ for those stages; it
  does not describe or require any live third-party connection.

## Receipt schema

All thirteen fields below are **required** on every receipt. Fields that are not
applicable to a given action carry an explicit empty value (`[]`, `none`, or
`not_required`) rather than being omitted.

| Field                   | Type                  | Description                                                                                                  | PII-safe note                                                  |
| ----------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `receipt_id`            | string (prefixed id)  | Unique id for this receipt, e.g. `rcpt_01HK…`.                                                               | —                                                              |
| `tenant_id`             | string (prefixed id)  | The tenant the action was performed for, e.g. `tnt_acme`.                                                    | Opaque id, not a tenant name.                                  |
| `agent_id`              | string (prefixed id)  | The agent that performed the action, e.g. `agt_intake_01`.                                                   | —                                                              |
| `action_type`           | enum                  | The GTM stage (see [Action lifecycle](#action-lifecycle)).                                                   | —                                                              |
| `source_event_id`       | string (prefixed id)  | The event that triggered this action, e.g. `evt_…`. Links receipts into a chain.                             | Opaque id only.                                                |
| `policy_decision`       | enum                  | Policy engine outcome: `allow`, `deny`, or `allow_with_conditions`.                                          | —                                                              |
| `approval_state`        | enum                  | Human approval status: `not_required`, `pending`, `approved`, `rejected`.                                    | —                                                              |
| `evidence_tags`         | string[]              | Non-identifying labels that justify the decision, e.g. `consent_on_file`, `opt_in_verified`, `pii_redacted`. | Tags are controlled vocabulary, never free-form PII.           |
| `redacted_input_digest` | string (digest)       | Digest of the **redacted** action input.                                                                     | Digest of redacted payload; raw input never stored.            |
| `output_digest`         | string (digest)       | Digest of the produced output (draft, mock record, etc.).                                                    | Digest only; raw output never stored.                          |
| `blocked_reasons`       | string[]              | Reasons the action was blocked or conditioned. Empty `[]` when fully allowed.                                | Controlled vocabulary, e.g. `missing_consent`, `pii_in_draft`. |
| `timestamp`             | string (ISO-8601 UTC) | When the action completed, e.g. `2026-06-21T14:03:22Z`.                                                      | —                                                              |
| `proof_report_ref`      | string (prefixed id)  | Pointer to the aggregated proof report this receipt belongs to, e.g. `prpt_…`.                               | Opaque id only.                                                |

### Reference receipt shape

```json
{
  "receipt_id": "rcpt_01HKXZ8N9C",
  "tenant_id": "tnt_acme",
  "agent_id": "agt_intake_01",
  "action_type": "lead_intake",
  "source_event_id": "evt_inbound_7c21",
  "policy_decision": "allow",
  "approval_state": "not_required",
  "evidence_tags": ["pii_redacted", "source_verified"],
  "redacted_input_digest": "sha256:9f2c…a1",
  "output_digest": "sha256:4be0…77",
  "blocked_reasons": [],
  "timestamp": "2026-06-21T14:03:22Z",
  "proof_report_ref": "prpt_lead_7c21"
}
```

## Field conventions

- **Identifiers.** All ids are opaque, prefixed strings. Prefixes:
  `rcpt_` (receipt), `tnt_` (tenant), `agt_` (agent), `evt_` (source event),
  `prpt_` (proof report). Ids are non-guessable and never encode PII.
- **Timestamps.** Always ISO-8601 in UTC with a trailing `Z`
  (`YYYY-MM-DDThh:mm:ssZ`).
- **Digests.** Format is `sha256:<hex>`. A digest is computed over the
  **canonicalized, redacted** payload — redaction happens _before_ hashing, so a
  digest can never be reversed into PII. The same redacted payload always
  produces the same digest.
- **Enums.**
  - `action_type`: `lead_intake`, `compliance_check`, `approval`,
    `message_draft`, `appointment_mock`, `crm_mock_writeback`,
    `proof_report_generation`.
  - `policy_decision`: `allow`, `deny`, `allow_with_conditions`.
  - `approval_state`: `not_required`, `pending`, `approved`, `rejected`.
- **List fields.** `evidence_tags` and `blocked_reasons` are drawn from a
  controlled vocabulary and are always present (use `[]` when empty).

## Action lifecycle

A single GTM outcome flows through the stages below. Each stage emits its own
receipt; receipts are chained via `source_event_id` (pointing back at what
triggered the action) and share a common `proof_report_ref`.

### 1. Lead intake

- **`action_type`:** `lead_intake`
- **Trigger:** An inbound lead event (form submission, inbound message, list
  import).
- **What it does:** Captures and redacts the incoming lead, then records a
  receipt referencing only the redacted-input digest. Raw lead fields (name,
  email, phone) are redacted before the digest is computed.
- **Key fields:** `redacted_input_digest`, `evidence_tags`
  (`pii_redacted`, `source_verified`), `policy_decision`.

```json
{
  "action_type": "lead_intake",
  "policy_decision": "allow",
  "approval_state": "not_required",
  "evidence_tags": ["pii_redacted", "source_verified"],
  "blocked_reasons": []
}
```

### 2. Compliance check

- **`action_type`:** `compliance_check`
- **Trigger:** A completed `lead_intake` receipt.
- **What it does:** Evaluates the lead against policy (consent on file, opt-in
  status, suppression/Do-Not-Contact lists, jurisdiction rules). Emits the policy
  decision and any blocking reasons.
- **Key fields:** `policy_decision`, `blocked_reasons`
  (e.g. `missing_consent`, `on_suppression_list`), `evidence_tags`
  (`consent_on_file`, `opt_in_verified`).

```json
{
  "action_type": "compliance_check",
  "policy_decision": "deny",
  "approval_state": "not_required",
  "evidence_tags": ["consent_checked"],
  "blocked_reasons": ["missing_consent"]
}
```

### 3. Approval

- **`action_type`:** `approval`
- **Trigger:** A `compliance_check` that returned `allow_with_conditions`, or any
  action a tenant has configured to require human sign-off.
- **What it does:** Records the human approval decision. Because receipts are
  append-only, a `pending` approval and a later `approved`/`rejected` are
  **separate** receipts, each referencing the prior via `source_event_id`.
- **Key fields:** `approval_state`, `evidence_tags`
  (`approver_role:manager`), `policy_decision`.

```json
{
  "action_type": "approval",
  "policy_decision": "allow_with_conditions",
  "approval_state": "approved",
  "evidence_tags": ["approver_role:manager"],
  "blocked_reasons": []
}
```

### 4. Message draft

- **`action_type`:** `message_draft`
- **Trigger:** An `approved` approval receipt (or an `allow` compliance check
  when approval is not required).
- **What it does:** Produces a draft outbound message. The draft is scanned for
  PII before the `output_digest` is taken; if PII is detected the action is
  blocked. **No message is sent** — drafting only.
- **Key fields:** `output_digest`, `blocked_reasons` (e.g. `pii_in_draft`),
  `evidence_tags` (`draft_scanned`, `pii_redacted`).

```json
{
  "action_type": "message_draft",
  "policy_decision": "allow",
  "approval_state": "approved",
  "evidence_tags": ["draft_scanned", "pii_redacted"],
  "output_digest": "sha256:4be0…77",
  "blocked_reasons": []
}
```

### 5. Appointment (mock)

- **`action_type`:** `appointment_mock`
- **Trigger:** A completed `message_draft`.
- **What it does:** Simulates booking an appointment. **This is a mock** — no
  live calendar or scheduling integration is called. The receipt records the
  digest of the mock appointment payload (redacted of attendee PII).
- **Key fields:** `output_digest`, `evidence_tags` (`mock_only`,
  `slot_proposed`), `policy_decision`.

```json
{
  "action_type": "appointment_mock",
  "policy_decision": "allow",
  "approval_state": "not_required",
  "evidence_tags": ["mock_only", "slot_proposed"],
  "output_digest": "sha256:1a9d…0e",
  "blocked_reasons": []
}
```

### 6. CRM writeback (mock)

- **`action_type`:** `crm_mock_writeback`
- **Trigger:** A completed `appointment_mock` (or `message_draft`).
- **What it does:** Simulates writing the outcome back to a CRM. **This is a
  mock** — no live CRM integration is called. The receipt records the digest of
  the redacted mock record that _would_ be written.
- **Key fields:** `output_digest`, `evidence_tags` (`mock_only`,
  `pii_redacted`), `policy_decision`.

```json
{
  "action_type": "crm_mock_writeback",
  "policy_decision": "allow",
  "approval_state": "not_required",
  "evidence_tags": ["mock_only", "pii_redacted"],
  "output_digest": "sha256:7c44…b2",
  "blocked_reasons": []
}
```

### 7. Proof report generation

- **`action_type`:** `proof_report_generation`
- **Trigger:** Completion of a GTM chain (or an on-demand audit request).
- **What it does:** Aggregates every receipt sharing the same `proof_report_ref`
  into a single, ordered, verifiable proof report. The report lets an auditor
  replay the full chain — intake → compliance → approval → draft → appointment →
  CRM — using only digests and tags. This action itself emits a receipt, closing
  the chain.
- **Key fields:** `proof_report_ref` (the report being produced),
  `output_digest` (digest of the assembled report), `evidence_tags`
  (`chain_complete`, `digests_verified`).

```json
{
  "action_type": "proof_report_generation",
  "policy_decision": "allow",
  "approval_state": "not_required",
  "evidence_tags": ["chain_complete", "digests_verified"],
  "output_digest": "sha256:e0f1…9c",
  "proof_report_ref": "prpt_lead_7c21",
  "blocked_reasons": []
}
```

## Privacy & redaction rules

- **Raw PII never enters a receipt.** Names, emails, phone numbers, addresses,
  message bodies, lead notes, and financial data are out of scope for receipt
  storage.
- **Redact before digesting.** Inputs and outputs are redacted _first_; digests
  are computed over the redacted payload. A digest therefore cannot be reversed
  into personal data.
- **Tags are a controlled vocabulary.** `evidence_tags` and `blocked_reasons`
  use predefined, non-identifying labels. Free-form text that could carry PII is
  not permitted in these fields.
- **Ids are opaque.** All identifiers are non-guessable and encode no personal
  information.

## Mock / no-integration notice

The `appointment_mock` and `crm_mock_writeback` stages are **mocks**. This
specification defines the receipt _shape_ and lifecycle for those stages only.
It does **not** describe, require, or authorize any live calendar, scheduling, or
CRM integration. Connecting any external system is out of scope and would
require explicit approval.

## Safety constraints

- Receipts are **append-only** and immutable; corrections are new receipts, never
  edits.
- **No raw PII** is ever stored in a receipt — digests and controlled tags only.
- **No live integrations** are invoked by any stage in this spec; appointment and
  CRM stages are mocks.
- No destructive or irreversible action is taken as a side effect of emitting a
  receipt; receipts are a record, not an actuator.
- This document is a specification only. It introduces **no implementation code**
  beyond the illustrative receipt shapes above.
