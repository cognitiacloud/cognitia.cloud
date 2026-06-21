# Hermes W2 — Compliance Gate

Runtime compliance / approval gate for the Cognitia **Client Zero** pipeline.

The **W1 Sales Closer** workflow must route every outbound action — message
send, appointment booking, CRM writeback — through this gate **before** it
executes. The gate returns a decision; the **W4 operator console** renders any
held action so a human can approve or reject it.

It is **fail-closed**: anything unrecognized, missing, or erroring stops the
action. Finance, trade-in, APR/payment, and approval claims **hard-stop to human
approval** and can never auto-proceed.

## Decisions

| Decision | Meaning | `safe_to_send` |
|---|---|---|
| `ALLOW` | Safe to proceed automatically. | `true` |
| `REQUIRE_APPROVAL` | Hard-stop. A human must approve via W4 before proceeding. | `false` |
| `BLOCK` | Hard-stop. Cannot proceed, and cannot be approved away. | `false` |

`safe_to_send` is `true` **only** for `ALLOW`. W1 must never act on any other value.

## Hard rules enforced

- **No live channels.** Only sandbox/simulated channels proceed. A live channel
  (`sms`, `email`, `voice`, `whatsapp`, …) → `BLOCK / LIVE_CHANNEL`. An
  unrecognized channel → `BLOCK / UNKNOWN_CHANNEL`.
- **No legal conclusions.** Content asserting legal conclusions → `BLOCK /
  LEGAL_CONCLUSION`. The gate itself emits no legal advice.
- **No raw PII.** All outputs and logs are redacted; PII authored into outbound
  content additionally requires approval (`RAW_PII`).
- **Finance / trade-in / APR / payment / approval claims** → `REQUIRE_APPROVAL`.
- **Appointment booking / CRM writeback** → `REQUIRE_APPROVAL` (per policy).

Detectors are regex-based **advisory hard-stops**, not a bypass-proof guarantee.
Their failure mode is "a human reviews it." The gate fails closed on any error.

## Blocked-reason taxonomy (`ReasonCode`)

Hard **BLOCK**: `CONSENT_MISSING`, `LIVE_CHANNEL`, `UNKNOWN_CHANNEL`,
`LEGAL_CONCLUSION`, `MISSING_FIELD`, `INTERNAL_ERROR`.

**REQUIRE_APPROVAL**: `FINANCE_CLAIM`, `TRADE_IN_CLAIM`, `APR_PAYMENT_CLAIM`,
`APPROVAL_CLAIM`, `APPOINTMENT_WRITE_NEEDS_APPROVAL`,
`CRM_WRITEBACK_NEEDS_APPROVAL`, `POLICY_OVERRIDE`, `RAW_PII`.

Verdict precedence is `BLOCK > REQUIRE_APPROVAL > ALLOW`. A request can trip
several codes at once; **all** reasons are retained on the decision even when a
hard block dominates, so the operator sees the full picture.

## Install

Stdlib-only — nothing to install to use the library, CLI, or tests. Install
`mcp` only to run the optional MCP server (see `requirements.txt`).

## CLI

```bash
# Evaluate a proposed W1 action ('-' reads JSON from stdin).
python3 w2_compliance_gate.py evaluate --json '{
  "request_id": "r1", "channel": "sandbox_sms", "intent": "send_message",
  "content": "great APR on your trade-in", "consent": {"sms": true}
}'
# -> decision: REQUIRE_APPROVAL, reasons: TRADE_IN_CLAIM, APR_PAYMENT_CLAIM

# Apply a W4 operator decision to a held action.
python3 w2_compliance_gate.py resolve --json '{
  "hold_token": "<token from the held decision>",
  "operator_id": "op-1", "action": "approve", "note": "reviewed"
}'
```

The CLI always exits `0` on a policy outcome (the decision is in the payload);
non-zero exit is reserved for malformed input.

## MCP

```bash
python3 w2_compliance_gate.py --mcp
```

Exposes two tools: `w2_evaluate(request)` and `w2_resolve(operator_decision)`.
Registration lives in `.mcp.json`.

## Run the tests

```bash
python3 -m unittest test_w2_compliance_gate -v
```

No network, keys, or external services required.

---

## Integration contract — W1 (Sales Closer)

**Entrypoint:** `evaluate(request) -> ComplianceDecision` (alias `guard_send`,
named for the call site).

**Request** (`ComplianceRequest`, tolerant `from_dict`):

| Field | Type | Notes |
|---|---|---|
| `request_id` | str | **Required.** Unique per action; idempotency key. |
| `workflow` | str | Originating workflow id (default `"W1"`). |
| `channel` | str | e.g. `sandbox_sms`. Live tokens are blocked. |
| `intent` | str | `send_message` / `book_appointment` / `crm_writeback` / … |
| `content` | str | Outbound text. Scanned + redacted. |
| `lead` | dict | Lead record; PII fields masked in all outputs. |
| `consent` | dict | e.g. `{"sms": true}`, keyed by channel family. |
| `metadata` | dict | Free-form; string values are also scanned. |
| `policy` | dict | Per-request policy overrides (see below). |

**Required fields are intent-aware:** `send_message` needs `channel` + `content`;
`book_appointment` / `crm_writeback` need `intent`. Missing required fields →
`MISSING_FIELD` (BLOCK), never an exception.

**W1 obligations:**
1. Call `evaluate()` with a unique `request_id` **before every** outbound action.
2. Proceed **only** if `decision.safe_to_send is True`.
3. On `REQUIRE_APPROVAL`: do not act. Hand `decision.hold_token` and
   `to_operator_packet(decision)` to W4, and wait.
4. On `BLOCK`: do not act, do not retry the same content; surface redacted reasons.
5. Only ever read `redacted_content` / `redacted_lead` back out for logging.

**Policy toggles** (`request.policy`, all default `true`):
`require_approval_for_appointment`, `require_approval_for_crm_writeback`,
`pii_in_content_requires_approval`, `consent_required_in_sandbox`.

## Integration contract — W4 (Operator Console)

**Build the packet to render:** `to_operator_packet(decision) -> OperatorPacket`
— a fully-redacted view (`hold_token`, `request_id`, `decision`, `reasons`,
`approvals_required`, `redacted_content`, `redacted_lead`, `created_at`).

**Resolve a hold:** `apply_operator_decision(op) -> ComplianceDecision`, where
`op` is `OperatorDecision{hold_token, operator_id, action: "approve"|"reject", note}`.

- **approve** → re-validates the blocking layer against the stored snapshot, then
  returns a new `ALLOW` decision (`safe_to_send=True`) with an audit trail.
- **reject** → `BLOCK` + `POLICY_OVERRIDE`, with the operator note.

**Safety invariants:**
- Approval can only release `REQUIRE_APPROVAL` holds. If the request also carries
  any hard-blocking code (live channel, missing consent, legal conclusion),
  approve is **refused** and the verdict stays `BLOCK`. Operators can never
  bypass a hard block.
- Approval re-validates at release time, so a hold cannot be approved into a
  state that has since become unsafe.
- **Idempotent:** replaying the same operator's decision returns the stored
  resolved decision; a conflicting operator on a resolved hold is refused; an
  unknown token fails closed to `BLOCK`.

The hold store is in-memory for v0.1, isolated behind `_store_hold` / `_load_hold`
so it can be swapped for a durable backend without touching the decision logic.

## Decision payload (W1/W4 wire schema)

`ComplianceDecision.to_dict()` keys: `request_id`, `decision`, `reasons`,
`findings`, `approvals_required`, `redacted_content`, `redacted_lead`,
`safe_to_send`, `hold_token`, `audit`, `schema_version`. Enums serialize as
their string values.

## Safety constraints

`read_only` · `no_live_channels` · `no_legal_conclusions` · `no_raw_pii` ·
`fail_closed` · `redact_logs`. No network, no external uploads, no file deletion.
