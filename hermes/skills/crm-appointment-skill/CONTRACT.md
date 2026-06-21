# W3 Integration Contract

This skill is **W3** in the Cognitia / Demandara "Client Zero" pipeline. It
consumes requests from **W1** (the upstream workflow) and produces a
proof-reportable event ledger for **W5** (the downstream proof harness).

```
   W1 workflow  ──request envelope──▶  W3 (this skill)  ──proof ledger──▶  W5 proof harness
   (submits bookings/                  mock adapters +                     (verifies side
    CRM writebacks)                     idempotency + gate                  effects were legal)
```

Everything W3 does is **mock-only**: no real CRM, calendar, email, SMS, phone
call, vendor API, or network access. The only side effect is a write to a
local JSON mock store.

---

## 1. W1 → W3 request envelope

W1 sends a single JSON object (the "request envelope") to `book_appointment`
or `crm_writeback`. W1 owns these guarantees:

- A **stable `idempotency_key`** per business event. Re-sending the same key
  (retries, at-least-once delivery) must be safe — see §3.
- The compliance and approval decision, expressed as `compliance_status` and
  `approval_status`. W3 does **not** grant approval; it only enforces it.
- `source_workflow` set to `"W1"`.

### 1a. Appointment request (`request_type: "appointment"`)

| field              | type   | required | notes |
|--------------------|--------|----------|-------|
| `idempotency_key`  | string | yes      | stable per business event |
| `request_type`     | string | yes      | must be `"appointment"` |
| `client_id`        | string | yes\*    | e.g. `"demandara-client-zero"` |
| `contact`          | object | yes\*    | `{name, email, phone}` (synthetic) |
| `requested_slot`   | string | yes      | ISO-8601 desired start time |
| `duration_minutes` | int    | no       | default `30` |
| `channel`          | string | no       | `video` \| `phone` \| `in_person` (default `video`; mock — nothing is dialed) |
| `notes`            | string | no       | scanned for leaked credentials |
| `compliance_status`| string | yes      | `pass` \| `fail` \| `pending` |
| `approval_status`  | string | yes      | `approved` \| `rejected` \| `pending` |
| `source_workflow`  | string | no       | `"W1"` |
| `submitted_at`     | string | no       | ISO-8601 |

\* Not hard-validated, but expected; omission yields `null` in the record.

### 1b. CRM writeback request (`request_type: "crm_writeback"`)

| field              | type   | required | notes |
|--------------------|--------|----------|-------|
| `idempotency_key`  | string | yes      | stable per business event |
| `request_type`     | string | yes      | must be `"crm_writeback"` |
| `client_id`        | string | yes\*    | |
| `object_type`      | string | yes      | `contact` \| `deal` |
| `contact`          | object | for contact | `{name, email, phone, company}` |
| `deal`             | object | for deal | `{title, amount, stage, currency}` |
| `compliance_status`| string | yes      | `pass` \| `fail` \| `pending` |
| `approval_status`  | string | yes      | `approved` \| `rejected` \| `pending` |
| `source_workflow`  | string | no       | `"W1"` |
| `submitted_at`     | string | no       | ISO-8601 |

See `fixtures/*.json` for complete, synthetic worked examples.

---

## 2. Compliance + approval gate

A write (booking / CRM record) is performed **only** when:

```
compliance_status == "pass"  AND  approval_status == "approved"
```

Additionally, if a request carries a real-looking credential/token (e.g. in
`notes`), compliance is forced to fail regardless of the declared status.

Any other combination is **refused and recorded as blocked** — an auditable
`status: "blocked"` record is stored (no booking side effect; `scheduled_slot`
is cleared for appointments) and a `*_blocked` event is emitted. Block reason
codes: `compliance_failed`, `compliance_pending`, `approval_not_granted`,
`approval_pending`.

Malformed requests (missing `idempotency_key`, wrong `request_type`, a `deal`
object without a `deal` payload, an invalid `channel`) yield `status:
"failed"` and a `request_failed` event (`outcome: "error"`).

---

## 3. Idempotency

`record_id` is a deterministic function of the request:
`"<prefix>_" + sha256(request_type + ":" + idempotency_key)[:12]`.

- First time a key is seen → the gate runs and a record is created.
- Any later submission of the **same key** returns the existing record with
  `"deduplicated": true` and emits a `*_deduplicated` event
  (`outcome: "duplicate_noop"`). **No second record is created**, regardless of
  whether the original was booked, written, or blocked.

This holds across process restarts (the store is reloaded from disk).

---

## 4. W3 → W5 proof contract

W5 consumes `get_proof_ledger(since_seq=N)`, which returns:

```json
{ "skill": "hermes-crm-appointment", "skill_version": "0.1.0",
  "since_seq": 0, "event_count": <int>, "events": [ <LedgerEvent>, ... ] }
```

Each `LedgerEvent` has exactly these fields:

| field             | type        | notes |
|-------------------|-------------|-------|
| `event_id`        | string      | `evt_<uuid4 hex>` (the only non-deterministic field) |
| `event_seq`       | int         | monotonic, **contiguous from 1**, append-only ordinal |
| `event_type`      | string      | see below |
| `idempotency_key` | string      | echoes the request key |
| `record_id`       | string\|null| `null` only for `request_failed` |
| `record_kind`     | string\|null| `appointment` \| `crm` |
| `status`          | string      | `booked` \| `written` \| `blocked` \| `failed` |
| `outcome`         | string      | `created` \| `duplicate_noop` \| `blocked` \| `error` |
| `reason`          | string\|null| redacted; populated for blocks/failures |
| `source_workflow` | string\|null| e.g. `"W1"` |
| `timestamp`       | string      | ISO-8601 UTC |
| `skill`           | string      | `hermes-crm-appointment` |
| `skill_version`   | string      | `0.1.0` |

`event_type` ∈ `appointment_booked`, `appointment_deduplicated`,
`appointment_blocked`, `crm_written`, `crm_deduplicated`, `crm_blocked`,
`request_failed`.

### Guarantees W5 may rely on

1. **Append-only / ordered.** `event_seq` is strictly increasing and contiguous;
   existing events are never mutated or removed. W5 can poll with `since_seq` to
   read only new events and detect gaps.
2. **Schema-complete.** Every event carries all fields above.
3. **Redacted.** `reason` is passed through the credential/PII redactor.
4. **Outcome-typed.** Every terminal `outcome` is one of the four values above.

### Acceptance assertions W5 can make

- **Approval gate held (acceptance #1):** no `appointment_booked` / `crm_written`
  event exists whose request was not `compliance=pass` + `approval=approved`;
  every refusal appears as `*_blocked` / `outcome=blocked`.
- **No duplicates (acceptance #2):** for any `idempotency_key`, at most one
  `outcome=created` event exists; repeats appear as `outcome=duplicate_noop`.
- **Proof-reportable (acceptance #3):** the ledger alone (no store internals) is
  sufficient to reconstruct what happened and why.
