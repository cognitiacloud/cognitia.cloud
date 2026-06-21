# Hermes CRM / Appointment Mock Skill (W3)

Mock-only appointment booking and CRM writeback adapters for the
Cognitia / Demandara **"Client Zero"** pipeline. This is pipeline role
**W3**: it consumes requests from the **W1** workflow and emits a
proof-reportable event ledger for the **W5** proof harness.

This skill is **mock only**. It never touches a real CRM, calendar, email,
SMS, phone line, or any vendor API, and it makes **no network calls**. It
reads **no real credentials**. The only side effect is a write to a local
JSON mock store under the skill's own state directory.

See [`CONTRACT.md`](./CONTRACT.md) for the W1 request envelope and the W5
proof contract.

## Install

```bash
# No third-party runtime deps for the mock path — stdlib only.
# Optional, only for the MCP stdio server:
pip install -r requirements.txt   # installs `mcp`
```

## Configure

State (the mock store) is resolved in this order:

1. `--state-dir DIR` CLI flag / `state_dir=` constructor argument
2. `HERMES_CRM_STATE_DIR` environment variable
3. default `state/` next to the module (git-ignored)

Pass `:memory:` as the state dir to disable all file writes (used by tests).
The store is a single `store.json` file written atomically; it reloads on
startup so idempotency holds across restarts.

## Tools

### `book_appointment(request, output_json_path=None)`
Mock-books an appointment from a W1 request envelope (`request_type:
"appointment"`). Books only when compliance passes **and** approval is
granted; otherwise returns a `blocked` record. Returns an
`APPOINTMENT_RECORD` (`record_id`, `status` ∈ `booked|blocked|failed`,
`scheduled_slot`, `block_reason`, ...). No real calendar/SMS/call.

### `crm_writeback(request, output_json_path=None)`
Mock CRM writeback for a `contact` or `deal` (`request_type:
"crm_writeback"`). Same gate. Returns a `CRM_RECORD` (`status` ∈
`written|blocked|failed`, ...). No real CRM is contacted.

### `get_record(idempotency_key)`
Read-only lookup of a stored record by idempotency key. Returns the record
with `found: true`, or `{found: false}`.

### `get_proof_ledger(since_seq=0, output_json_path=None)`
Returns the append-only, schema'd proof event ledger consumed by W5:
`{skill, skill_version, since_seq, event_count, events: [...]}`.

## CLI usage

```bash
# Book (mock). Re-running the same request is idempotent (deduplicated).
python3 crm_appointment_skill.py book \
    --request-file fixtures/appt_ok.json --state-dir /tmp/w3

# A request still pending approval is blocked, not booked.
python3 crm_appointment_skill.py book \
    --request-file fixtures/appt_pending_approval.json --state-dir /tmp/w3

# CRM writeback (contact or deal).
python3 crm_appointment_skill.py writeback \
    --request-file fixtures/crm_contact_ok.json --state-dir /tmp/w3

# Look up a record by idempotency key.
python3 crm_appointment_skill.py get \
    --idempotency-key w1-appt-2026-07-01-lead-001 --state-dir /tmp/w3

# Read the proof ledger (the W5 feed). --since-seq for incremental polling.
python3 crm_appointment_skill.py proof --state-dir /tmp/w3

# Diagnostics: resolved state dir + record/event counts.
python3 crm_appointment_skill.py state --state-dir /tmp/w3
```

`--request-json '<json>'` can be used instead of `--request-file`.
Regenerate the synthetic fixtures with `python3 fixtures/generate_fixtures.py`.

## MCP server usage

The same script exposes an MCP stdio server with the four tools
(`book`, `writeback`, `get`, `proof`). Register it via `.mcp.json` (see the
file in this folder) or your Hermes loader. Requires the `mcp` SDK.

```bash
python3 crm_appointment_skill.py --mcp
```

## Tests

```bash
python3 test_crm_appointment_skill.py
```

Runs fully offline (no network, no keys). Covers the success path, duplicate
(idempotent) writes, blocked-before-approval writes, failure handling, the
compliance+approval gate truth table, proof-ledger integrity, persistence,
and a CLI smoke run.

## Safety constraints

- **Mock only.** No real CRM, calendar, email, SMS, phone calls, or vendor
  API. **No network access of any kind.**
- **No real credentials** are read or required.
- All effects are confined to the local JSON mock store in the skill's state
  directory; nothing leaves the machine.
- **Idempotent.** A repeated `idempotency_key` never creates a duplicate
  appointment or CRM record.
- **Gated.** A writeback happens only after compliance passes and approval is
  granted; otherwise it is refused and recorded as `blocked`.
- **Redacted.** Logs and the `reason` field in the proof ledger are scrubbed
  of emails, tokens/keys, and financial digits. A credential detected in a
  request forces a compliance failure.

## Install into Hermes

Drop the entire `crm-appointment-skill/` folder into `~/.hermes/skills/`:

```bash
cp -r crm-appointment-skill ~/.hermes/skills/crm-appointment-skill
```

If your Hermes loader expects a different schema for `.mcp.json` or
`skill.yaml`, adjust only those two metadata files; the Python module is
loader-agnostic.
