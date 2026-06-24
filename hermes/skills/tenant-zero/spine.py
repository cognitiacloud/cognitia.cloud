#!/usr/bin/env python3
"""Tenant Zero proof spine — orchestrator entrypoint.

A deterministic, replayable, offline pipeline that takes synthetic Budget
Wheels leads from intake through a policy gate and human approval to a mock
closer brief and a local mock CRM, sealing the whole run with a SHA-256
proof receipt.

Mirrors the vision-skill entrypoint shape: CLI subcommands + an ``--mcp``
stdio server. Ships no transport, no real CRM SDK, no real provider, and
reads no API key on the default path — the hard rules hold by construction.

CLI:
    python3 spine.py run     --tenant budget_wheels_demo [--out run/]
    python3 spine.py approve --run <run_id> --item AQ-L-001 --decision approve --reason "ok"
    python3 spine.py console --run <run_id>
    python3 spine.py verify  --run <run_id>
    python3 spine.py replay  --run <run_id>
    python3 spine.py provider
    python3 spine.py --mcp
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import Any

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import console  # noqa: E402
import spine_common as sc  # noqa: E402
from stations import (  # noqa: E402
    s01_intake,
    s02_site_audit,
    s03_competitors,
    s04_lead_registry,
    s05_policy_gate,
    s06_approval_queue,
    s07_closer_handoff,
    s08_crm_writeback,
    s09_receipt,
)

DEFAULT_OUT = HERE / "run"


# --------------------------------------------------------------------------
# Fixture loading
# --------------------------------------------------------------------------
def _load_fixtures() -> dict[str, Any]:
    fx = sc.fixtures_dir()
    if not (fx / "budget_wheels_profile.json").exists():
        from fixtures import generate_fixtures

        generate_fixtures.main()
    return {
        "profile": sc.read_json(fx / "budget_wheels_profile.json"),
        "site": sc.read_json(fx / "site_snapshot.json"),
        "competitors": sc.read_json(fx / "competitors.json"),
        "leads_seed": sc.read_json(fx / "leads_seed.json"),
        "suppression": sc.read_json(fx / "suppression_list.json"),
    }


def _emit(
    run_state: dict[str, Any],
    run_dir: Path,
    index: int,
    name: str,
    artifact: str,
    obj: dict[str, Any],
    input_sha: str | None,
    decision: str,
    summary: str,
) -> str:
    text = sc.write_json(run_dir / artifact, obj)
    sc.record_station(run_state, index, name, artifact, input_sha, text, decision, summary)
    return text


# --------------------------------------------------------------------------
# run — full golden pipeline
# --------------------------------------------------------------------------
def run_pipeline(tenant: str, out_base: str | Path = DEFAULT_OUT) -> dict[str, Any]:
    fx = _load_fixtures()
    profile = fx["profile"]
    run_id = profile["run_id"]
    run_dir = Path(out_base) / run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    run_state = sc.new_run_state(tenant, run_id, profile["clock"], profile["seed"])

    intake = s01_intake.run(tenant, profile)
    t = _emit(run_state, run_dir, 0, "intake", "00_intake.json", intake, None,
              "loaded", f"tenant={tenant}")

    audit = s02_site_audit.run(intake, fx["site"])
    t = _emit(run_state, run_dir, 1, "site_audit", "01_site_audit.json", audit,
              sc.sha256_hex(t), f"score={audit['overall_score']}",
              f"{len(audit['findings'])} findings")

    competitors = s03_competitors.run(intake, fx["competitors"])
    t = _emit(run_state, run_dir, 2, "competitors", "02_competitors.json", competitors,
              sc.sha256_hex(t), f"top={competitors['ranked'][0]}",
              f"{len(competitors['competitors'])} competitors")

    leads = s04_lead_registry.run(intake, fx["leads_seed"])
    t = _emit(run_state, run_dir, 3, "lead_registry", "03_leads.json", leads,
              sc.sha256_hex(t), f"{leads['lead_count']} leads", "masked at boundary")

    policy = s05_policy_gate.run(intake, leads, fx["suppression"])
    t = _emit(run_state, run_dir, 4, "policy_gate", "04_policy.json", policy,
              sc.sha256_hex(t), f"{policy['allowed']} allow / {policy['blocked']} block",
              "hard-rule chokepoint")

    queue = s06_approval_queue.build_queue(intake, policy)
    t = _emit(run_state, run_dir, 5, "approval_queue", "05_approval_queue.json", queue,
              sc.sha256_hex(t), f"{queue['pending']} pending", "awaiting operator")

    approvals = s06_approval_queue.auto_approvals(queue)
    t = _emit(run_state, run_dir, 6, "approvals", "06_approvals.json", approvals,
              sc.sha256_hex(t), f"{approvals['approved']} approved", "golden auto-approval")

    _seal_tail(run_dir, run_state, intake, leads, audit, competitors, policy, approvals)
    return s09_receipt.verify(run_dir)


def _seal_tail(
    run_dir: Path,
    run_state: dict[str, Any],
    intake: dict[str, Any],
    leads: dict[str, Any],
    audit: dict[str, Any],
    competitors: dict[str, Any],
    policy: dict[str, Any],
    approvals: dict[str, Any],
) -> None:
    """Compute stations 7-9 from in-memory artifacts, write run_state, and
    render the console. Shared by ``run`` and ``approve``."""
    closer = s07_closer_handoff.run(intake, leads, audit, competitors, policy, approvals)
    t = _emit(run_state, run_dir, 7, "closer_handoff", "07_closer_brief.json", closer,
              None, f"{closer['brief_count']} briefs", "no outreach, brief only")

    crm = s08_crm_writeback.run(intake, closer, run_dir / "crm.sqlite")
    _emit(run_state, run_dir, 8, "crm_writeback", "08_crm_writeback.json", crm,
          sc.sha256_hex(t), f"{crm['rows_written']} rows", "local sqlite only")

    sc.write_json(run_dir / "run_state.json", run_state)

    receipt = s09_receipt.build(run_dir, run_state)
    sc.write_json(run_dir / "09_receipt.json", receipt)
    sc.record_station(run_state, 9, "receipt", "09_receipt.json", None,
                      sc.canonical_str(receipt), receipt["receipt_root"][:12], "sealed")
    sc.write_json(run_dir / "run_state.json", run_state)

    console.render(run_dir)


# --------------------------------------------------------------------------
# approve — operator decision, then re-seal the tail
# --------------------------------------------------------------------------
def approve(run_id: str, item: str, decision: str, reason: str,
            operator: str = "operator", out_base: str | Path = DEFAULT_OUT) -> dict[str, Any]:
    run_dir = Path(out_base) / run_id
    fx = _load_fixtures()
    intake = sc.read_json(run_dir / "00_intake.json")
    audit = sc.read_json(run_dir / "01_site_audit.json")
    competitors = sc.read_json(run_dir / "02_competitors.json")
    leads = sc.read_json(run_dir / "03_leads.json")
    policy = sc.read_json(run_dir / "04_policy.json")
    queue = sc.read_json(run_dir / "05_approval_queue.json")
    approvals = sc.read_json(run_dir / "06_approvals.json")

    approvals = s06_approval_queue.apply_decision(
        queue, approvals, item, decision, reason, operator
    )
    run_state = sc.read_json(run_dir / "run_state.json")
    # Drop tail station records (7,8,9); they are recomputed below.
    run_state["stations"] = [s for s in run_state["stations"] if s["index"] <= 6]
    # Rewrite the approvals artifact and refresh its run_state record.
    at = sc.write_json(run_dir / "06_approvals.json", approvals)
    for s in run_state["stations"]:
        if s["index"] == 6:
            s["output_sha256"] = sc.sha256_hex(at)
            s["decision"] = f"{approvals['approved']} approved"

    _seal_tail(run_dir, run_state, intake, leads, audit, competitors, policy, approvals)
    return s09_receipt.verify(run_dir)


# --------------------------------------------------------------------------
# replay — re-run and assert byte-identical artifacts
# --------------------------------------------------------------------------
def replay(run_id: str, out_base: str | Path = DEFAULT_OUT) -> dict[str, Any]:
    run_dir = Path(out_base) / run_id
    tenant = sc.read_json(run_dir / "00_intake.json")["tenant"]
    replay_dir = Path(out_base) / f"{run_id}.replay"
    import shutil

    if replay_dir.exists():
        shutil.rmtree(replay_dir)
    run_pipeline(tenant, replay_dir.parent / "__replay_base")
    # run_pipeline nests under run_id; locate it
    produced = replay_dir.parent / "__replay_base" / run_id

    artifacts = [a for _, _, a in sc.STATIONS]
    diffs: list[str] = []
    for a in artifacts:
        orig = (run_dir / a).read_bytes()
        new = (produced / a).read_bytes()
        if orig != new:
            diffs.append(a)

    orig_root = sc.read_json(run_dir / "09_receipt.json")["receipt_root"]
    new_root = sc.read_json(produced / "09_receipt.json")["receipt_root"]
    shutil.rmtree(replay_dir.parent / "__replay_base", ignore_errors=True)

    return {
        "ok": not diffs and orig_root == new_root,
        "byte_identical": not diffs,
        "diffs": diffs,
        "receipt_root": orig_root,
        "replay_root": new_root,
    }


# --------------------------------------------------------------------------
# MCP server (optional; requires the `mcp` SDK)
# --------------------------------------------------------------------------
def _run_mcp() -> None:
    from mcp.server.fastmcp import FastMCP

    server = FastMCP("tenant-zero")

    @server.tool()
    def run(tenant: str = "budget_wheels_demo") -> dict[str, Any]:
        """Run the full proof-spine golden pipeline for a tenant."""
        return run_pipeline(tenant)

    @server.tool()
    def approve_item(run_id: str, item: str, decision: str, reason: str) -> dict[str, Any]:
        """Record an operator approve/reject decision and re-seal the run."""
        return approve(run_id, item, decision, reason)

    @server.tool()
    def verify(run_id: str) -> dict[str, Any]:
        """Recompute the hash chain and verify the proof receipt."""
        return s09_receipt.verify(DEFAULT_OUT / run_id)

    @server.tool()
    def replay_run(run_id: str) -> dict[str, Any]:
        """Replay a run and assert byte-identical artifacts."""
        return replay(run_id)

    @server.tool()
    def console_view(run_id: str) -> str:
        """Return the CLI console view for a run."""
        return console.cli_view(DEFAULT_OUT / run_id)

    server.run()


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------
def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Tenant Zero proof spine")
    parser.add_argument("--mcp", action="store_true", help="run as an MCP stdio server")
    sub = parser.add_subparsers(dest="cmd")

    p_run = sub.add_parser("run", help="run the full golden pipeline")
    p_run.add_argument("--tenant", default="budget_wheels_demo")
    p_run.add_argument("--out", default=str(DEFAULT_OUT))

    p_app = sub.add_parser("approve", help="record an operator decision")
    p_app.add_argument("--run", required=True)
    p_app.add_argument("--item", required=True)
    p_app.add_argument("--decision", required=True, choices=["approve", "reject"])
    p_app.add_argument("--reason", required=True)
    p_app.add_argument("--operator", default="operator")

    for name in ("console", "verify", "replay"):
        sp = sub.add_parser(name)
        sp.add_argument("--run", required=True)
    sub.add_parser("provider", help="show the selected data provider")

    args = parser.parse_args(argv)

    if args.mcp:
        _run_mcp()
        return 0

    if args.cmd == "run":
        res = run_pipeline(args.tenant, args.out)
        print(sc.canonical_str(res), end="")
        return 0 if res["ok"] else 1
    if args.cmd == "approve":
        res = approve(args.run, args.item, args.decision, args.reason, args.operator)
        print(sc.canonical_str(res), end="")
        return 0 if res["ok"] else 1
    if args.cmd == "console":
        run_dir = DEFAULT_OUT / args.run
        console.render(run_dir)
        print(console.cli_view(run_dir))
        return 0
    if args.cmd == "verify":
        res = s09_receipt.verify(DEFAULT_OUT / args.run)
        print(sc.canonical_str(res), end="")
        return 0 if res["ok"] else 1
    if args.cmd == "replay":
        res = replay(args.run)
        print(sc.canonical_str(res), end="")
        return 0 if res["ok"] else 1
    if args.cmd == "provider":
        print(sc.select_provider())
        return 0

    parser.print_help()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
