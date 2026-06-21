# Hermes Signal Bus / Action Ledger (W6)

A minimal, **append-only event spine** for the Cognitia/Demandara pipeline. It
lets workflow stages emit durable, ordered, tamper-evident signals — the
backbone for Client Zero and future Alta-parity phases.

This skill is **append-only and offline by design**. It never updates or
deletes records, never touches the network or a database, and never persists
raw PII. Events form a sha256 hash chain so the whole log is
**proof-reportable** with zero external dependencies.

## Guarantees

| Property | How |
| --- | --- |
| Append-only | Records are only ever appended; the file is opened in `"a"` mode and `fsync`'d. No update/delete API exists. |
| Ordered | Every record carries a contiguous, monotonic `seq` (0-based). |
| Idempotent | Re-emitting the same `idempotency_key` returns the original record with no second append. |
| Tamper-evident | Each record links to the previous via `prev_hash` + `content_hash` (sha256 of the canonical record). |
| No raw PII | Payloads are recursively scanned and redacted before persisting; affected records set `pii_redacted: true`. |
| Proof-reportable | `verify()` walks the chain; `proof_report()` summarizes counts, head hash, and integrity. |

## Event types

| Type | Required payload keys | Typical producer |
| --- | --- | --- |
| `lead.created` | `subject_ref` | W1 (lead intake) |
| `compliance.checked` | `subject_ref`, `result` | compliance stage |
| `approval.requested` | `request_ref` | approval stage |
| `approval.granted` | `request_ref` | approval stage |
| `approval.rejected` | `request_ref` | approval stage |
| `appointment.mock_created` | `subject_ref` | mock scheduler |
| `crm.mock_written` | `subject_ref` | mock CRM writer |
| `proof.generated` | `head_hash` | W8 (reporting) |

`subject_ref` / `request_ref` MUST be opaque/hashed identifiers — never raw
emails, phone numbers, or names. Redaction is a safety net, not a license to
pass PII.

## Record shape

```json
{
  "seq": 0,
  "event_id": "uuid4",
  "idempotency_key": "k1 | null",
  "type": "lead.created",
  "ts": "2026-06-21T00:00:00+00:00",
  "actor": "W1",
  "subject_ref": "lead_abc",
  "payload": { "subject_ref": "lead_abc", "source": "webform" },
  "pii_redacted": false,
  "prev_hash": "GENESIS",
  "content_hash": "sha256-hex",
  "schema_version": 1
}
```

## Storage

- File-backed: pass a `.jsonl` path (one record per line) — append-only,
  durable across runs, replayed and verified on open.
- In-memory: omit the path for an ephemeral ledger (used by tests).

The CLI resolves the path from `--path` or the `SIGNAL_BUS_LEDGER_PATH`
environment variable.

## CLI usage

```bash
# Emit (PII in the payload is redacted before it is written)
python3 signal_bus.py emit --type lead.created --actor W1 \
    --payload '{"subject_ref":"lead_abc","source":"webform"}' \
    --path /tmp/led.jsonl

# Idempotent emit — running this twice appends only once
python3 signal_bus.py emit --type approval.requested \
    --payload '{"request_ref":"req1"}' --idempotency-key k1 --path /tmp/led.jsonl

# Read (ordered; filter by type / since_seq)
python3 signal_bus.py read --path /tmp/led.jsonl
python3 signal_bus.py read --type lead.created --since-seq 2 --path /tmp/led.jsonl

# Verify the hash chain
python3 signal_bus.py verify --path /tmp/led.jsonl

# Proof report
python3 signal_bus.py report --path /tmp/led.jsonl
```

## Python usage

```python
from signal_bus import ActionLedger

led = ActionLedger("/tmp/led.jsonl")          # or ActionLedger() for in-memory
led.emit("lead.created", {"subject_ref": "lead_abc"}, actor="W1")
events = led.read(since_seq=0)                 # consumers stream from a cursor
assert led.verify()["valid"]
report = led.proof_report()
```

## MCP server usage

The same script exposes an MCP stdio server with four tools: `ledger_emit`,
`ledger_read`, `ledger_verify`, `ledger_proof_report`. Register it via
`.mcp.json` (in this folder). The MCP server requires the `mcp` Python SDK
(`pip install mcp`); the core ledger itself needs only the standard library.

```bash
python3 signal_bus.py --mcp
```

## Integration contract (W1 / W5 / W8, and Katie/Alex/Luna roadmap)

The bus is a role-agnostic producer/consumer API. There is no code coupling —
producers and consumers share only the JSONL/record contract above.

**Producers** call `emit(type, payload, *, actor, subject_ref, idempotency_key)`:

- **W1** (lead intake) → `lead.created`.
- Compliance / approval stages → `compliance.checked`, `approval.requested`,
  `approval.granted`, `approval.rejected`.
- Mock integration writers → `appointment.mock_created`, `crm.mock_written`
  (mock-only; this skill performs no live external writes).
- Producers MUST pass an already-hashed `subject_ref` / `request_ref` and avoid
  raw PII; they SHOULD set an `idempotency_key` for at-least-once-safe retries.

**Consumers** (e.g. **W5**, **W8**, and the Katie/Alex/Luna roadmap) call:

- `read(since_seq=cursor)` to stream new events in order (advance the cursor to
  `last_seq + 1`).
- `verify()` / `proof_report()` to produce proof artifacts; **W8** typically
  emits a `proof.generated` event referencing the current `head_hash`.

Contract guarantees consumers can rely on: append-only, stable `seq` ordering,
idempotent emits, PII-redacted payloads, and a tamper-evident `head_hash`.

> Role assumption: W1 = producer-side intake; W5/W8 = downstream
> consumers/reporting. If real roles differ, only the `actor` labels change —
> the API is identical for any producer or consumer.

## Tests

```bash
python3 test_signal_bus.py -v
```

Covers ordering, idempotency, PII safety (including a no-raw-PII-on-disk
assertion), the hash chain + tamper detection, persistence/replay, and
contract validation. Runs fully offline — no network, DB, or cloud keys.
