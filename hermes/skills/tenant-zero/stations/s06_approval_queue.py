#!/usr/bin/env python3
"""Station 6 — Human approval queue.

Turns policy-allowed leads into proposed actions that require explicit
operator sign-off. Nothing proceeds to the closer or CRM without a matching
approval decision. The golden run uses ``auto_approvals`` for determinism,
but the real operator gate is the ``spine.py approve`` CLI path, which
upserts decisions into the approvals artifact.
"""

from __future__ import annotations

from typing import Any

import spine_common as sc

OPERATOR_DEMO = "demo_operator"


def build_queue(intake: dict[str, Any], policy: dict[str, Any]) -> dict[str, Any]:
    items: list[dict[str, Any]] = []
    for d in policy["decisions"]:
        if d["decision"] != "allow":
            continue
        lead_id = d["lead_id"]
        proposed_action = {
            "lead_id": lead_id,
            "action": "prepare_closer_brief",
            "channel": "per_lead_preference",
        }
        items.append(
            {
                "item_id": f"AQ-{lead_id}",
                "lead_id": lead_id,
                "proposed_action": proposed_action,
                "status": "pending",
                "item_sha256": sc.sha256_obj(proposed_action),
            }
        )

    out = {
        "tenant": intake["tenant"],
        "pending": len(items),
        "items": items,
    }
    sc.require_schema(out, sc.APPROVAL_QUEUE_SCHEMA, "approval_queue")
    return out


def auto_approvals(queue: dict[str, Any]) -> dict[str, Any]:
    """Deterministic operator decisions for the golden run: approve all."""
    decisions = [
        {
            "item_id": it["item_id"],
            "lead_id": it["lead_id"],
            "decision": "approve",
            "reason": "golden-run auto-approval",
            "operator": OPERATOR_DEMO,
            "item_sha256": it["item_sha256"],
        }
        for it in queue["items"]
    ]
    return _finalise(queue["tenant"], decisions)


def apply_decision(
    queue: dict[str, Any],
    approvals: dict[str, Any] | None,
    item_id: str,
    decision: str,
    reason: str,
    operator: str,
) -> dict[str, Any]:
    """Upsert a single operator decision (used by the ``approve`` CLI)."""
    if decision not in ("approve", "reject"):
        raise sc.ProofRuleViolation(f"invalid decision {decision!r}")
    item = next((it for it in queue["items"] if it["item_id"] == item_id), None)
    if item is None:
        raise sc.ProofRuleViolation(f"no queued item {item_id!r}")

    existing = list(approvals["decisions"]) if approvals else []
    existing = [d for d in existing if d["item_id"] != item_id]
    existing.append(
        {
            "item_id": item_id,
            "lead_id": item["lead_id"],
            "decision": decision,
            "reason": reason,
            "operator": operator,
            "item_sha256": item["item_sha256"],
        }
    )
    existing.sort(key=lambda d: d["item_id"])
    return _finalise(queue["tenant"], existing)


def _finalise(tenant: str, decisions: list[dict[str, Any]]) -> dict[str, Any]:
    approved = [d for d in decisions if d["decision"] == "approve"]
    rejected = [d for d in decisions if d["decision"] == "reject"]
    out = {
        "tenant": tenant,
        "decided": len(decisions),
        "approved": len(approved),
        "rejected": len(rejected),
        "decisions": decisions,
    }
    sc.require_schema(out, sc.APPROVALS_SCHEMA, "approvals")
    return out


def approved_ids(approvals: dict[str, Any]) -> set[str]:
    return {d["lead_id"] for d in approvals["decisions"] if d["decision"] == "approve"}
