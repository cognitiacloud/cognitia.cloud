#!/usr/bin/env python3
"""hctl — Cognitia goal loop harness control.

A minimal, file-based harness for running Cognitia goal loops. It manages
goals, worker assignments, runs, checkpoints, artifacts, evidence, risks,
founder decisions, stop conditions, and a final report — all as plain
markdown + JSON + append-only JSONL on disk.

Design constraints (intentional):
- Standard library only. No third-party deps, no network, no secrets.
- Read-only on the rest of the repo; only ever writes under ``goals/``.
- Not an executor: it does not run tools, schedule, or call any API. It is
  the bookkeeping spine that a human (or another agent) writes to.

Layout produced per goal (under ``goals/<slug>/``)::

    goal.md              # human-authored goal definition
    state.json           # structured snapshot (single source of truth)
    runs.jsonl           # append-only run/iteration log
    decisions.jsonl      # append-only founder decision log
    checkpoint.md        # rolling checkpoint notes
    final-report.md      # final synthesis (rendered by `report`)
    artifacts/
      index.jsonl        # append-only artifact index
      <files...>         # produced artifacts

Usage::

    hctl.py init <slug> [--title T] [--owner O]
    hctl.py run <slug> --worker W --summary S [--phase P] [--status ok]
    hctl.py decision <slug> --by founder --decision D [--rationale R] [--reversible]
    hctl.py risk <slug> --add D --severity high [--likelihood med] [--mitigation M]
    hctl.py artifact <slug> --path P --type T --by W [--run RID] [--desc D]
    hctl.py checkpoint <slug> [--note N]
    hctl.py status <slug>
    hctl.py report <slug>
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path

SCHEMA_VERSION = "0.1.0"

HARNESS_DIR = Path(__file__).resolve().parent
REPO_ROOT = HARNESS_DIR.parent
GOALS_DIR = REPO_ROOT / "goals"
TEMPLATES_DIR = HARNESS_DIR / "templates"


# --------------------------------------------------------------------------- #
# small helpers
# --------------------------------------------------------------------------- #
def now_iso() -> str:
    """UTC timestamp, second precision, e.g. 2026-06-20T14:03:11Z."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def gen_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def goal_dir(slug: str) -> Path:
    return GOALS_DIR / slug


def die(msg: str) -> "NoReturn":  # type: ignore[name-defined]
    print(f"hctl: error: {msg}", file=sys.stderr)
    sys.exit(1)


def require_goal(slug: str) -> Path:
    d = goal_dir(slug)
    if not (d / "state.json").exists():
        die(f"no goal '{slug}' found at {d} (run `hctl.py init {slug}` first)")
    return d


def load_state(slug: str) -> dict:
    return json.loads((goal_dir(slug) / "state.json").read_text())


def save_state(slug: str, state: dict) -> None:
    """Atomic write: temp file in the same dir, then os.replace."""
    state["updated_at"] = now_iso()
    path = goal_dir(slug) / "state.json"
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as fh:
            json.dump(state, fh, indent=2)
            fh.write("\n")
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def append_jsonl(path: Path, record: dict) -> None:
    with path.open("a") as fh:
        fh.write(json.dumps(record, sort_keys=False) + "\n")


def read_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    out = []
    for i, line in enumerate(path.read_text().splitlines(), 1):
        line = line.strip()
        if not line:
            continue
        try:
            out.append(json.loads(line))
        except json.JSONDecodeError as exc:
            die(f"{path}:{i}: invalid JSON line: {exc}")
    return out


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def recompute_counters(slug: str, state: dict) -> dict:
    """Derive counters from the logs so they can never silently drift."""
    d = goal_dir(slug)
    runs = read_jsonl(d / "runs.jsonl")
    decisions = read_jsonl(d / "decisions.jsonl")
    artifacts = read_jsonl(d / "artifacts" / "index.jsonl")
    open_risks = sum(1 for r in state.get("risks", []) if r.get("status") == "open")
    state["counters"] = {
        "runs": len(runs),
        "artifacts": len(artifacts),
        "decisions": len(decisions),
        "open_risks": open_risks,
    }
    return state


def evaluate_stop_conditions(state: dict) -> list[dict]:
    """Compute the live status of each stop condition.

    Recomputed types: ``max_runs`` (runs >= value), ``deadline`` (now >= value).
    Stored-flag types: ``success_criteria_met``, ``manual`` — toggled by a human
    via the ``triggered`` field (typically alongside a founder decision).
    """
    runs = state.get("counters", {}).get("runs", 0)
    now = now_iso()
    results = []
    for sc in state.get("stop_conditions", []):
        kind = sc.get("type")
        triggered = bool(sc.get("triggered", False))
        if kind == "max_runs":
            try:
                triggered = runs >= int(sc.get("value"))
            except (TypeError, ValueError):
                triggered = False
        elif kind == "deadline":
            triggered = bool(sc.get("value")) and now >= str(sc.get("value"))
        results.append({**sc, "triggered": triggered})
    return results


# --------------------------------------------------------------------------- #
# commands
# --------------------------------------------------------------------------- #
def cmd_init(args) -> None:
    slug = args.slug
    dest = goal_dir(slug)
    if dest.exists():
        die(f"goal '{slug}' already exists at {dest}")
    if not TEMPLATES_DIR.exists():
        die(f"templates dir missing at {TEMPLATES_DIR}")

    created = now_iso()
    title = args.title or slug.replace("-", " ").title()
    owner = args.owner or "founder"
    tokens = {
        "{{SLUG}}": slug,
        "{{TITLE}}": title,
        "{{OWNER}}": owner,
        "{{CREATED_AT}}": created,
        "{{SCHEMA_VERSION}}": SCHEMA_VERSION,
    }

    # copy the template tree, expanding tokens in text files
    for src in sorted(TEMPLATES_DIR.rglob("*")):
        rel = src.relative_to(TEMPLATES_DIR)
        target = dest / rel
        if src.is_dir():
            target.mkdir(parents=True, exist_ok=True)
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        if src.suffix in {".md", ".json", ".jsonl"} or src.name == ".gitkeep":
            text = src.read_text()
            for k, v in tokens.items():
                text = text.replace(k, v)
            target.write_text(text)
        else:
            target.write_bytes(src.read_bytes())

    print(f"initialized goal '{slug}' at {dest.relative_to(REPO_ROOT)}")
    print(f"  title: {title}")
    print(f"  owner: {owner}")
    print("next: edit goal.md, then `hctl.py run %s --worker <id> --summary ...`" % slug)


def cmd_run(args) -> None:
    require_goal(args.slug)
    state = load_state(args.slug)
    record = {
        "run_id": gen_id("run"),
        "ts": now_iso(),
        "worker": args.worker,
        "phase": args.phase or state.get("current_phase", ""),
        "summary": args.summary,
        "status": args.status,
        "outputs": [],
        "evidence": [],
    }
    append_jsonl(goal_dir(args.slug) / "runs.jsonl", record)
    recompute_counters(args.slug, state)
    save_state(args.slug, state)
    print(f"logged {record['run_id']} ({args.worker}, {args.status}) — runs now {state['counters']['runs']}")


def cmd_decision(args) -> None:
    require_goal(args.slug)
    state = load_state(args.slug)
    record = {
        "decision_id": gen_id("dec"),
        "ts": now_iso(),
        "by": args.by,
        "decision": args.decision,
        "rationale": args.rationale or "",
        "affects": [a.strip() for a in (args.affects or "").split(",") if a.strip()],
        "reversible": bool(args.reversible),
    }
    append_jsonl(goal_dir(args.slug) / "decisions.jsonl", record)
    recompute_counters(args.slug, state)
    save_state(args.slug, state)
    print(f"recorded {record['decision_id']} by {args.by} — decisions now {state['counters']['decisions']}")


def cmd_risk(args) -> None:
    require_goal(args.slug)
    state = load_state(args.slug)
    risk = {
        "id": gen_id("risk"),
        "description": args.add,
        "severity": args.severity,
        "likelihood": args.likelihood,
        "status": "open",
        "mitigation": args.mitigation or "",
        "owner": args.owner or state.get("goal", {}).get("owner", "founder"),
        "opened_at": now_iso(),
    }
    state.setdefault("risks", []).append(risk)
    recompute_counters(args.slug, state)
    save_state(args.slug, state)
    print(f"added {risk['id']} (severity={args.severity}) — open risks now {state['counters']['open_risks']}")


def cmd_artifact(args) -> None:
    require_goal(args.slug)
    state = load_state(args.slug)
    apath = Path(args.path)
    if not apath.exists():
        die(f"artifact path not found: {apath}")
    try:
        rel = apath.resolve().relative_to(REPO_ROOT)
    except ValueError:
        rel = apath  # outside repo; store as given
    record = {
        "artifact_id": gen_id("art"),
        "ts": now_iso(),
        "path": str(rel),
        "type": args.type,
        "produced_by": args.by,
        "run_id": args.run or "",
        "sha256": sha256_file(apath),
        "description": args.desc or "",
    }
    append_jsonl(goal_dir(args.slug) / "artifacts" / "index.jsonl", record)
    recompute_counters(args.slug, state)
    save_state(args.slug, state)
    print(f"indexed {record['artifact_id']} -> {record['path']} (sha256 {record['sha256'][:12]}…)")


def cmd_checkpoint(args) -> None:
    require_goal(args.slug)
    state = load_state(args.slug)
    recompute_counters(args.slug, state)
    conds = evaluate_stop_conditions(state)
    met = [c for c in conds if c["triggered"]]

    ts = now_iso()
    state["last_checkpoint_at"] = ts
    # advance the next pending scheduled checkpoint to "done"
    for cp in state.get("checkpoint_schedule", []):
        if cp.get("status") == "pending":
            cp["status"] = "done"
            state["next_checkpoint_at"] = cp.get("next_due_at") or state.get("next_checkpoint_at")
            break
    state["stop_conditions"] = conds
    save_state(args.slug, state)

    c = state["counters"]
    block = [
        f"\n## Checkpoint — {ts}",
        f"- phase: {state.get('current_phase', '')}",
        f"- runs: {c['runs']} | artifacts: {c['artifacts']} | decisions: {c['decisions']} | open risks: {c['open_risks']}",
        f"- stop conditions met: {', '.join(m['id'] for m in met) if met else 'none'}",
        f"- note: {args.note or '(none)'}",
        "",
    ]
    with (goal_dir(args.slug) / "checkpoint.md").open("a") as fh:
        fh.write("\n".join(block))

    print(f"checkpoint written at {ts}")
    print(f"  runs={c['runs']} artifacts={c['artifacts']} decisions={c['decisions']} open_risks={c['open_risks']}")
    if met:
        print(f"  STOP CONDITIONS MET: {', '.join(m['id'] + ' (' + m['type'] + ')' for m in met)}")
        print("  -> consider `hctl.py report %s` and closing the loop." % args.slug)


def cmd_status(args) -> None:
    require_goal(args.slug)
    state = load_state(args.slug)
    stored = state.get("counters", {})
    recompute_counters(args.slug, state)
    live = state["counters"]
    conds = evaluate_stop_conditions(state)
    met = [c for c in conds if c["triggered"]]
    g = state.get("goal", {})

    print(f"goal: {g.get('title')} ({g.get('slug')})  [{state.get('status')}]")
    print(f"  phase: {state.get('current_phase')}  owner: {g.get('owner')}")
    print(f"  workers: {', '.join(w['id'] + ':' + w.get('status', '?') for w in state.get('workers', [])) or 'none'}")
    print(f"  counters: runs={live['runs']} artifacts={live['artifacts']} "
          f"decisions={live['decisions']} open_risks={live['open_risks']}")
    if stored and stored != live:
        print(f"  WARNING: stored counters {stored} differ from logs {live} "
              f"(state.json was hand-edited; run any write command to resync).")
    print(f"  last checkpoint: {state.get('last_checkpoint_at') or 'never'}  "
          f"next: {state.get('next_checkpoint_at') or 'unscheduled'}")
    print("  stop conditions:")
    for c in conds:
        print(f"    [{'X' if c['triggered'] else ' '}] {c['id']} {c['type']}={c.get('value', '')}")
    if met:
        print(f"  -> {len(met)} stop condition(s) MET.")


def cmd_report(args) -> None:
    require_goal(args.slug)
    d = require_goal(args.slug)
    state = load_state(args.slug)
    recompute_counters(args.slug, state)
    g = state.get("goal", {})
    runs = read_jsonl(d / "runs.jsonl")
    decisions = read_jsonl(d / "decisions.jsonl")
    artifacts = read_jsonl(d / "artifacts" / "index.jsonl")
    open_risks = [r for r in state.get("risks", []) if r.get("status") == "open"]

    lines = [
        f"# Final Report — {g.get('title', args.slug)}",
        "",
        f"- Goal slug: `{g.get('slug', args.slug)}`",
        f"- Owner: {g.get('owner', 'founder')}",
        f"- Status: {state.get('status')}",
        f"- Generated: {now_iso()}",
        "",
        "## Objective",
        g.get("objective", "_(see goal.md)_"),
        "",
        "## Success criteria",
    ]
    for sc in g.get("success_criteria", []) or ["_(none recorded)_"]:
        lines.append(f"- {sc}")
    lines += [
        "",
        "## Outcome summary",
        "_Synthesize the result here: what was achieved vs. the success criteria._",
        "",
        f"## Activity ({len(runs)} runs)",
    ]
    for r in runs[-10:]:
        lines.append(f"- `{r.get('ts')}` [{r.get('worker')}/{r.get('status')}] {r.get('summary')}")
    lines += ["", f"## Founder decisions ({len(decisions)})"]
    for dec in decisions:
        rev = "reversible" if dec.get("reversible") else "one-way"
        lines.append(f"- `{dec.get('ts')}` ({dec.get('by')}, {rev}) {dec.get('decision')}")
    lines += ["", f"## Artifacts ({len(artifacts)})"]
    for a in artifacts:
        lines.append(f"- `{a.get('path')}` ({a.get('type')}) — {a.get('description', '')} "
                     f"[sha256 {str(a.get('sha256', ''))[:12]}…]")
    lines += ["", f"## Open risks ({len(open_risks)})"]
    for r in open_risks:
        lines.append(f"- **{r.get('severity')}/{r.get('likelihood')}** {r.get('description')} "
                     f"— mitigation: {r.get('mitigation') or 'TBD'}")
    lines += [
        "",
        "## Recommendation",
        "_Next action for the founder: ship / iterate / abort, and why._",
        "",
    ]
    out = d / "final-report.md"
    out.write_text("\n".join(lines) + "\n")
    save_state(args.slug, state)
    print(f"wrote {out.relative_to(REPO_ROOT)} "
          f"({len(runs)} runs, {len(decisions)} decisions, {len(artifacts)} artifacts, {len(open_risks)} open risks)")


# --------------------------------------------------------------------------- #
# arg parsing
# --------------------------------------------------------------------------- #
def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="hctl.py", description="Cognitia goal loop harness control")
    sub = p.add_subparsers(dest="command", required=True)

    s = sub.add_parser("init", help="scaffold a new goal loop")
    s.add_argument("slug")
    s.add_argument("--title")
    s.add_argument("--owner")
    s.set_defaults(func=cmd_init)

    s = sub.add_parser("run", help="append a run/iteration record")
    s.add_argument("slug")
    s.add_argument("--worker", required=True)
    s.add_argument("--summary", required=True)
    s.add_argument("--phase")
    s.add_argument("--status", default="ok")
    s.set_defaults(func=cmd_run)

    s = sub.add_parser("decision", help="append a founder decision")
    s.add_argument("slug")
    s.add_argument("--by", default="founder")
    s.add_argument("--decision", required=True)
    s.add_argument("--rationale")
    s.add_argument("--affects", help="comma-separated areas affected")
    s.add_argument("--reversible", action="store_true")
    s.set_defaults(func=cmd_decision)

    s = sub.add_parser("risk", help="add a risk to the register")
    s.add_argument("slug")
    s.add_argument("--add", required=True, help="risk description")
    s.add_argument("--severity", default="med", choices=["low", "med", "high", "critical"])
    s.add_argument("--likelihood", default="med", choices=["low", "med", "high"])
    s.add_argument("--mitigation")
    s.add_argument("--owner")
    s.set_defaults(func=cmd_risk)

    s = sub.add_parser("artifact", help="index a produced artifact")
    s.add_argument("slug")
    s.add_argument("--path", required=True)
    s.add_argument("--type", required=True)
    s.add_argument("--by", required=True)
    s.add_argument("--run")
    s.add_argument("--desc")
    s.set_defaults(func=cmd_artifact)

    s = sub.add_parser("checkpoint", help="record a checkpoint and evaluate stop conditions")
    s.add_argument("slug")
    s.add_argument("--note")
    s.set_defaults(func=cmd_checkpoint)

    s = sub.add_parser("status", help="print a snapshot and stop-condition evaluation")
    s.add_argument("slug")
    s.set_defaults(func=cmd_status)

    s = sub.add_parser("report", help="render final-report.md from state + logs")
    s.add_argument("slug")
    s.set_defaults(func=cmd_report)

    return p


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    args.func(args)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
