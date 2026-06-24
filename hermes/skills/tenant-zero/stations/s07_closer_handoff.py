#!/usr/bin/env python3
"""Station 7 — Sales Closer handoff.

Packages each lead that is BOTH policy-allowed AND operator-approved into a
closer brief. This station emits a brief *artifact* only — there is no
transport, no send, no outreach path anywhere in the skill, so "no live
outreach" holds by construction. Every brief is double-checked against the
policy gate before it is built.
"""

from __future__ import annotations

from typing import Any

import spine_common as sc
from stations import s05_policy_gate as policy_gate
from stations import s06_approval_queue as approval_queue


def run(
    intake: dict[str, Any],
    leads: dict[str, Any],
    audit: dict[str, Any],
    competitors: dict[str, Any],
    policy: dict[str, Any],
    approvals: dict[str, Any],
) -> dict[str, Any]:
    lead_by_id = {l["id"]: l for l in leads["leads"]}
    eligible = policy_gate.allowed_ids(policy) & approval_queue.approved_ids(approvals)
    top_competitor = competitors["ranked"][0] if competitors["ranked"] else None

    briefs: list[dict[str, Any]] = []
    for lead_id in sorted(eligible):
        # Defence in depth: never build a brief for a non-allowed lead.
        policy_gate.assert_allowed(policy, lead_id, "closer_handoff")
        lead = lead_by_id[lead_id]
        briefs.append(
            {
                "lead_id": lead_id,
                "masked_name": lead["masked_name"],
                "source": lead["source"],
                "preferred_channel": lead["preferred_channel"],
                "offer": intake["offer"]["headline"],
                "talking_points": [
                    f"Lead arrived via {lead['source']} with explicit consent.",
                    f"Site gap to mention: {audit['findings'][0] if audit['findings'] else 'n/a'}.",
                    f"Competitive angle vs {top_competitor}: emphasise in-house financing."
                    if top_competitor else "Lead with in-house financing.",
                ],
                "proof_points": intake["offer"]["proof_points"],
                "next_step": "operator-led outreach (out of scope for demo)",
            }
        )

    out = {
        "tenant": intake["tenant"],
        "brief_count": len(briefs),
        "briefs": briefs,
    }
    sc.assert_no_unmasked_pii(out, "closer_handoff output")
    sc.require_schema(out, sc.CLOSER_BRIEF_SCHEMA, "closer_handoff")
    return out
