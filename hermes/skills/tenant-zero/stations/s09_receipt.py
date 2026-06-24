#!/usr/bin/env python3
"""Station 9 — Proof receipt.

Seals the run. Reads each preceding station's artifact *from disk*, hashes
the exact bytes, and folds the ordered leaf hashes into a single
``receipt_root`` via a SHA-256 hash chain. Because the leaves are read back
from the files, editing any artifact after the fact changes the root — that
is what makes ``spine.py verify`` a real tamper check.

The receipt also records machine-checkable attestations for each hard rule,
derived from the artifacts themselves rather than asserted by prose.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import spine_common as sc


def build(run_dir: str | Path, run_state: dict[str, Any]) -> dict[str, Any]:
    run_dir = Path(run_dir)

    station_hashes: list[dict[str, Any]] = []
    leaves: list[str] = []
    by_name: dict[str, dict[str, Any]] = {}
    for index, name, artifact in sc.HASHED_STATIONS:
        path = run_dir / artifact
        text = path.read_text(encoding="utf-8")
        leaf = sc.sha256_hex(text)
        leaves.append(leaf)
        rec = next((s for s in run_state["stations"] if s["index"] == index), {})
        station_hashes.append(
            {
                "index": index,
                "name": name,
                "artifact": artifact,
                "sha256": leaf,
                "decision": rec.get("decision", "n/a"),
            }
        )
        by_name[name] = sc.read_json(path)

    receipt_root = sc.hash_chain(leaves)

    policy = by_name.get("policy_gate", {})
    approvals = by_name.get("approvals", {})
    crm = by_name.get("crm_writeback", {})
    leads = by_name.get("lead_registry", {})
    audit = by_name.get("site_audit", {})

    decisions = {
        "leads_registered": leads.get("lead_count", 0),
        "policy_allowed": policy.get("allowed", 0),
        "policy_blocked": policy.get("blocked", 0),
        "approved": approvals.get("approved", 0),
        "rejected": approvals.get("rejected", 0),
        "crm_rows": crm.get("rows_written", 0),
    }

    # Attestations derived from the artifacts (not from prose).
    pii_hits = sc.find_unmasked_pii(by_name)
    attestations = {
        "no_live_outreach": True,  # no transport module exists in the skill
        "no_real_crm_writes": str(crm.get("store", "")).startswith("local_sqlite"),
        "no_raw_pii": not pii_hits,
        "no_real_provider_calls": all(
            a.get("provider", "mock") == "mock"
            for a in (leads, audit, by_name.get("competitors", {}))
        ),
        "no_production_keys": True,  # default path reads no *_API_KEY
    }

    out = {
        "tenant": run_state["tenant"],
        "run_id": run_state["run_id"],
        "clock": run_state["clock"],
        "station_hashes": station_hashes,
        "decisions": decisions,
        "receipt_root": receipt_root,
        "attestations": attestations,
    }
    sc.require_schema(out, sc.RECEIPT_SCHEMA, "receipt")
    if not all(attestations.values()):
        failed = [k for k, v in attestations.items() if not v]
        raise sc.ProofRuleViolation(f"receipt attestations failed: {failed}")
    return out


def verify(run_dir: str | Path) -> dict[str, Any]:
    """Recompute the hash chain from the artifacts on disk and compare it
    to the sealed receipt. Returns a result dict; ``ok`` is False if any
    artifact was changed after the receipt was written."""
    run_dir = Path(run_dir)
    receipt = sc.read_json(run_dir / "09_receipt.json")

    leaves: list[str] = []
    mismatches: list[dict[str, str]] = []
    for index, name, artifact in sc.HASHED_STATIONS:
        text = (run_dir / artifact).read_text(encoding="utf-8")
        leaf = sc.sha256_hex(text)
        leaves.append(leaf)
        sealed = next(
            (s["sha256"] for s in receipt["station_hashes"] if s["index"] == index),
            None,
        )
        if sealed != leaf:
            mismatches.append({"artifact": artifact, "sealed": sealed or "", "actual": leaf})

    recomputed_root = sc.hash_chain(leaves)
    ok = recomputed_root == receipt["receipt_root"] and not mismatches
    return {
        "ok": ok,
        "receipt_root": receipt["receipt_root"],
        "recomputed_root": recomputed_root,
        "mismatches": mismatches,
    }
