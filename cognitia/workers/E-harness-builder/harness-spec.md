# Cognitia File-Based Goal-Loop Harness — Spec

**Status:** SANDBOX/MOCK MVP (isolated prototype, no production integration).
**Owner:** Worker E — Harness Builder.
**Classification of this doc:** RECOMMENDED design; the reference implementation
(`harness_mvp.py`) is VERIFIED runnable (see README for output).

## 1. Purpose

A small, file-based control loop that reads **goals** from a file, expands each
goal into **steps**, runs every step through a **guardrail check** before
executing it via a **pluggable MOCK executor**, appends every action to an
**append-only ledger**, evaluates goal completion, and emits a **checkpoint
report** aligned with the loop's 6-hourly cadence.

It is the seed of an orchestrator that could later coordinate Workers A–D, but
in this MVP it does nothing with side effects: no network, no message sending,
no real vendor adapters. Mocks only.

## 2. Hard boundaries (inherited from `cognitia/loop/GUARDRAILS.md`)

- No network calls. No outreach (email/SMS/WhatsApp). No vendor adapter
  implementation. No PII. No token launch / liquidity / ROI promises.
- These map 1:1 to the `HARD_STOP_ACTIONS` set enforced by the guardrail step.
- Any step that hits a boundary is **refused before execution** and logged as
  `status=BLOCKED`, `classification=UNSAFE`. It is surfaced in the checkpoint's
  "Decisions needed from founder"–equivalent section (`guardrail_blocks`).

## 3. Directory contract

```
<out_dir>/
  action_ledger.jsonl   # append-only, one JSON object per line, monotonic seq
  checkpoint.json        # machine-readable checkpoint snapshot
  checkpoint.md          # human-readable checkpoint report
```

Inputs live outside `out_dir`:

```
goals.example.json       # the goals file (format below)
```

`out_dir` is created if missing. The ledger is **append-only**: re-running
against an existing `out_dir` continues the sequence rather than truncating.

## 4. Goal file format (JSON — stdlib only)

```json
{
  "version": 1,
  "goals": [
    {
      "id": "G1",
      "title": "human-readable goal",
      "steps": [
        {"id": "G1.S1", "action": "research", "args": {"topic": "..."}},
        {"id": "G1.S2", "action": "draft_artifact", "args": {"name": "..."}}
      ]
    }
  ]
}
```

- `action` must be a registered MOCK executor key, else the step is an
  execution `ERROR` (distinct from a guardrail `BLOCKED`).
- `args.intent` (optional free text) is also scanned by the guardrail for
  hard-stop phrasing, so intent-level violations are caught even when the
  declared action looks benign.

JSON is used (not YAML) to keep the MVP pure-stdlib and deterministic.

## 5. The loop

```
load_goals(file)
for goal in goals:
    for step in goal.steps:
        allowed, reason = guardrail_check(step)     # boundary gate
        if not allowed:
            ledger.append(BLOCKED/UNSAFE) ; continue
        executor = EXECUTORS[step.action]           # mock, pure function
        if executor is None:
            ledger.append(ERROR) ; continue
        result = executor(step.args)                # no network, deterministic
        ledger.append(OK/VERIFIED, result)
    evaluate(goal) -> COMPLETE | PARTIAL_BLOCKED | PARTIAL_ERROR
build_checkpoint(...) -> checkpoint.json + checkpoint.md
```

### Pluggable MOCK executors (registry)
- `research` — returns a synthetic, hash-stable findings summary.
- `draft_artifact` — returns synthetic artifact text + char count.
- `noop` — succeeds, changes nothing (used for idempotency/conservation tests).

New executors are added by registering a pure function in `EXECUTORS`. The
contract: deterministic, no side effects, returns a JSON-serializable dict.
A real adapter would only be added behind an explicit SANDBOX/MOCK flag and
founder sign-off (UNSAFE until then).

## 6. Guardrail hook

`guardrail_check(step) -> (allowed: bool, reason: str)`

- Blocks if `step.action ∈ HARD_STOP_ACTIONS`.
- Blocks if `step.args.intent` text references a hard-stop token.
- This is the single chokepoint every step passes through before any executor
  runs, so the boundary cannot be bypassed by adding a new executor.

## 7. Determinism

- Fixed logical clock (`COGNITIA_HARNESS_NOW`, default `2026-06-20T00:00:00Z`).
- Executors are pure functions of their args; results carry a stable
  `result_hash`. Re-runs produce structurally identical ledgers/checkpoints.

## 8. Mapping to the 6-hourly checkpoint cadence

Each harness run emits a `checkpoint.{json,md}` containing: goals
complete/total, steps OK/blocked/errored, the list of guardrail blocks
(= compliance/decisions surface), and per-goal status. To wire into the loop's
`cognitia/loop/checkpoints/checkpoint-NN-hourHH.md` cadence, schedule a harness
run every 6h and fold its `checkpoint.md` sections into the standard template
(artifacts created, strongest findings, kill/park list, security/compliance
risks, decisions needed). The `guardrail_blocks` list feeds directly into the
"Decisions needed from founder" section.

## 9. Explicit non-goals (this MVP)

- No LLM planner — "plan" = the goal's declared steps. (Future: pluggable
  planner that expands a goal into steps; still gated by the guardrail.)
- No real executors, no network, no scheduling daemon, no concurrency.
- No persistence beyond flat files.
