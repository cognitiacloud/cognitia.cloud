# Cognitia Goal Loop Harness

A minimal, **file-based** harness for running Cognitia "goal loops": a goal,
one or more workers, iterative runs, periodic checkpoints, produced artifacts,
accumulating evidence and risks, founder decisions, explicit stop conditions,
and a final synthesis report.

Everything is plain **markdown + JSON + append-only JSONL** on disk, driven by a
single standard-library Python CLI (`hctl.py`). There is no database, no
network, no vendor SDK, and no secrets.

## What this is (and is not)

- **It is** the bookkeeping spine of a goal loop: a durable, auditable,
  git-friendly record of what the goal is, who is working it, what happened,
  what was produced, what could go wrong, what the founder decided, and when to
  stop.
- **It is not** an executor or orchestrator. It does not run tools, call APIs,
  schedule jobs, or talk to models. A human — or a separate agent — does the
  work and writes the results here. This keeps the harness safe to run anywhere
  (it only ever writes under `goals/`).

> Design note: keep the scaffolding thin. As the agents and models that drive
> loops get more capable, prefer deleting structure here over adding it.

## Layout

```
harness/
  hctl.py                 # the CLI ("harness control")
  README.md               # this spec
  schema/                 # JSON Schemas (draft-07) for validation
    state.schema.json
    run.schema.json
    decision.schema.json
    artifact.schema.json
  templates/              # blank goal-loop skeleton, copied by `init`
  research/               # clean-room research notes

goals/
  <slug>/                 # one folder per goal loop
    goal.md               # human-authored goal definition
    state.json            # structured snapshot — single source of truth
    runs.jsonl            # append-only run/iteration log
    decisions.jsonl       # append-only founder decision log
    checkpoint.md         # rolling checkpoint notes
    final-report.md       # final synthesis
    artifacts/
      index.jsonl         # append-only artifact index (path + sha256)
      <files...>          # the produced artifacts
```

## The seven required features → where they live

| Feature                     | Lives in                                                        |
| --------------------------- | --------------------------------------------------------------- |
| 1. Goal definition          | `goal.md` + `goal` block of `state.json`                        |
| 2. Worker assignment        | `workers[]` in `state.json`                                     |
| 3. Checkpoint schedule      | `checkpoint_schedule[]` in `state.json`; log in `checkpoint.md` |
| 4. Artifact index           | `artifacts/index.jsonl` (id, path, type, producer, sha256)      |
| 5. Risk register            | `risks[]` in `state.json`                                       |
| 6. Founder decision log     | `decisions.jsonl` (append-only)                                 |
| 7. Final synthesis template | `final-report.md` (rendered by `report`)                        |
| (+) Stop conditions         | `stop_conditions[]` in `state.json`, evaluated by the CLI       |

**Why this split:** human intent → markdown; current structured state →
`state.json`; immutable history → JSONL append-only logs. The logs are the
audit trail; `state.json` is a snapshot you can always rebuild counters for.

## CLI reference

Run from anywhere; paths are resolved relative to this file.

```bash
# 1. create a goal loop from the templates
python3 harness/hctl.py init gtm-research --title "GTM research" --owner founder

# 2. log each run / iteration (a worker did something)
python3 harness/hctl.py run gtm-research --worker worker-e \
    --summary "Sized 3 ICP segments" --phase research --status ok

# 3. record a founder decision (append-only, auditable)
python3 harness/hctl.py decision gtm-research --by founder \
    --decision "Focus on prosumer segment" --rationale "Best CAC/LTV" --reversible

# 4. register a risk
python3 harness/hctl.py risk gtm-research --add "TAM estimate may be inflated" \
    --severity high --likelihood med --mitigation "Cross-check with 2nd source"

# 5. index a produced artifact (hashes the file)
python3 harness/hctl.py artifact gtm-research \
    --path goals/gtm-research/artifacts/market-sizing.md \
    --type doc --by worker-e --desc "TAM/SAM/SOM model"

# 6. take a checkpoint (appends to checkpoint.md, evaluates stop conditions)
python3 harness/hctl.py checkpoint gtm-research --note "On track"

# 7. see where things stand
python3 harness/hctl.py status gtm-research

# 8. render the final report from state + logs
python3 harness/hctl.py report gtm-research
```

### Commands

- `init <slug> [--title] [--owner]` — copy `templates/` to `goals/<slug>/`,
  expanding `{{SLUG}}`, `{{TITLE}}`, `{{OWNER}}`, `{{CREATED_AT}}`.
- `run <slug> --worker --summary [--phase] [--status]` — append a run record;
  resync counters.
- `decision <slug> --by --decision [--rationale] [--affects] [--reversible]` —
  append a founder decision.
- `risk <slug> --add --severity [--likelihood] [--mitigation] [--owner]` — push
  a risk into the register.
- `artifact <slug> --path --type --by [--run] [--desc]` — sha256 the file and
  append to the artifact index.
- `checkpoint <slug> [--note]` — append a dated checkpoint section, advance the
  schedule, evaluate stop conditions.
- `status <slug>` — print a snapshot; recompute counters from the logs and warn
  on drift; show which stop conditions are met.
- `report <slug>` — render `final-report.md` from `state.json` + the logs.

## Stop conditions

Declared in `state.json` under `stop_conditions[]`. Each has a `type`:

- `max_runs` — triggers when `counters.runs >= value`.
- `deadline` — triggers when now ≥ `value` (ISO-8601 UTC).
- `success_criteria_met` / `manual` — human-toggled via the `triggered` field
  (typically set alongside a founder decision).

`status` and `checkpoint` recompute `max_runs` and `deadline` live, so the
record never goes stale.

## Validation

The schemas in `schema/` are standard draft-07 JSON Schema. The CLI itself does
only lightweight required-field handling (the standard library has no schema
validator), so validate in CI or locally with any JSON Schema tool, e.g.:

```bash
# example with check-jsonschema (pipx install check-jsonschema)
check-jsonschema --schemafile harness/schema/state.schema.json goals/*/state.json
```

Quick sanity checks with the standard library only:

```bash
python3 -m json.tool goals/gtm-research/state.json >/dev/null && echo "state ok"
python3 - <<'PY'
import json, pathlib
for line in pathlib.Path("goals/gtm-research/runs.jsonl").read_text().splitlines():
    if line.strip():
        json.loads(line)
print("runs.jsonl ok")
PY
```

## Conventions & constraints

- **Single writer per goal** in the MVP. JSONL appends are line-atomic for
  small records, but two workers writing the same goal concurrently can still
  interleave — coordinate, or shard by goal.
- **The CLI is the only writer.** Hand-editing `state.json` is allowed but
  `status` will warn if its counters no longer match the logs; any write
  command resyncs them.
- **Append-only logs are immutable history.** Correct mistakes with a new
  record, don't rewrite old lines.
- **Timestamps** are UTC, second precision, `...Z`.
- **No secrets, no network, no app/DB access.** If a future version needs any of
  those, it belongs in a separate, reviewed component — not here.

See `research/claude-harness-public-patterns.md` for the public prior art that
informed (clean-room) this design.
