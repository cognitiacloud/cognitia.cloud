# Cognitia Goal-Loop Harness — MVP (Worker E)

A small, **isolated, file-based** goal-loop prototype. It reads goals from a
JSON file, runs each step through a guardrail boundary check, executes allowed
steps via **MOCK** executors, appends every action to an append-only JSON-lines
ledger, and emits a checkpoint report.

> SANDBOX/MOCK only. Pure Python stdlib. No network. No message sending.
> Deterministic. This is a prototype, not production.

## Files

- `harness-spec.md` — full design spec (goal format, loop, guardrails, cadence).
- `harness_mvp.py` — single-file, stdlib-only implementation.
- `goals.example.json` — sample goals, including 2 steps that SHOULD be blocked.
- `test_harness.py` — `unittest` suite.
- `run_output/` — generated artifacts (ledger + checkpoint) from a sample run.

## Run the harness

```bash
cd cognitia/workers/E-harness-builder
python3 harness_mvp.py --goals goals.example.json --out ./run_output
```

Produces:
- `run_output/action_ledger.jsonl` — append-only action log (one JSON/line).
- `run_output/checkpoint.json` — machine-readable checkpoint.
- `run_output/checkpoint.md` — human-readable checkpoint report.

Example stdout (deterministic):

```json
{
  "goals_complete": 1,
  "goals_total": 3,
  "steps_ok": 5,
  "steps_blocked": 2,
  "steps_errored": 0,
  "out_dir": "./run_output"
}
```

The two blocked steps are recorded in the ledger as `status=BLOCKED`,
`classification=UNSAFE` — one blocked by action name (`send_email`), one by
intent text (`token_launch`). This proves the boundary enforcement works.

## Run the tests

```bash
cd cognitia/workers/E-harness-builder
python3 -m unittest test_harness -v
# or: python3 test_harness.py
```

12 tests cover: ledger append/ordering, append-only resume, guardrail blocking
(by action and by intent), conservation/idempotency of a step, unknown-action
error handling, and checkpoint generation + determinism.

## What it does

- Loads goals -> expands declared steps -> guardrail-checks each step ->
  executes allowed steps via mock executors -> appends to ledger -> evaluates
  goal status -> writes a 6h-cadence-compatible checkpoint.
- Enforces the loop's hard-stop boundaries at a single chokepoint that every
  step must pass before any executor runs.

## What it explicitly does NOT do

- No network calls of any kind.
- No sending of email / SMS / WhatsApp / any message.
- No real vendor adapters (mocks only).
- No PII (sample data uses `*.example.invalid`, fake-only values).
- No token launch, liquidity, ROI/return promises, or lead outreach.
- No LLM planner, no scheduler/daemon, no concurrency, no DB.

See `harness-spec.md` for the full contract and future extension points.
