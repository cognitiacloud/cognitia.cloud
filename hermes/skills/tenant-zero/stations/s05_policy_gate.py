#!/usr/bin/env python3
"""Station 5 — Policy gate (the hard-rule chokepoint).

A deterministic rules engine. Every lead is evaluated against five rules;
any failure blocks the lead. Blocked leads cannot reach the approval queue,
the closer, or the CRM — and a run-level guard (``assert_allowed``) lets
downstream stations fail closed if a blocked id ever slips through.

Rules:
  * consent          — explicit consent flag required
  * suppression      — contact_hash must not be on the suppression list
  * channel          — preferred channel must be tenant-eligible
  * quiet_hours      — frozen run clock must be outside the quiet window
  * pii_masking      — the lead record must contain no unmasked PII
"""

from __future__ import annotations

from typing import Any

import spine_common as sc

RULES_APPLIED = ["consent", "suppression", "channel", "quiet_hours", "pii_masking"]


def _clock_hhmm(clock: str) -> str:
    """Extract HH:MM from an ISO-8601 clock string (no wall-clock read)."""
    time_part = clock.split("T", 1)[1] if "T" in clock else clock
    return time_part[:5]


def _in_quiet_hours(clock: str, quiet: dict[str, Any]) -> bool:
    now = _clock_hhmm(clock)
    start, end = quiet["start"], quiet["end"]
    if start <= end:
        return start <= now < end
    # Window wraps midnight (e.g. 21:00 -> 08:00).
    return now >= start or now < end


def _evaluate(
    lead: dict[str, Any],
    intake: dict[str, Any],
    suppressed: set[str],
) -> dict[str, Any]:
    checks: dict[str, bool] = {}
    reasons: list[str] = []

    checks["consent"] = bool(lead.get("consent_flag"))
    if not checks["consent"]:
        reasons.append("missing explicit consent")

    checks["suppression"] = lead.get("contact_hash") not in suppressed
    if not checks["suppression"]:
        reasons.append("on suppression / do-not-contact list")

    checks["channel"] = lead.get("preferred_channel") in intake["eligible_channels"]
    if not checks["channel"]:
        reasons.append(
            f"channel {lead.get('preferred_channel')!r} not in eligible channels"
        )

    checks["quiet_hours"] = not _in_quiet_hours(intake["clock"], intake["quiet_hours"])
    if not checks["quiet_hours"]:
        reasons.append("run clock falls within quiet hours")

    # Defence in depth: even though station 4 masks, re-scan the lead here.
    pii_hits = sc.find_unmasked_pii(lead)
    checks["pii_masking"] = not pii_hits
    if pii_hits:
        kinds = ", ".join(sorted({h["kind"] for h in pii_hits}))
        reasons.append(f"unmasked PII present ({kinds})")

    decision = "allow" if all(checks.values()) else "block"
    return {
        "lead_id": lead["id"],
        "decision": decision,
        "reasons": reasons,
        "checks": checks,
    }


def run(
    intake: dict[str, Any],
    leads: dict[str, Any],
    suppression: dict[str, Any],
) -> dict[str, Any]:
    suppressed = set(suppression.get("suppressed_contact_hashes", []))
    decisions = [_evaluate(l, intake, suppressed) for l in leads["leads"]]
    allowed = [d for d in decisions if d["decision"] == "allow"]
    blocked = [d for d in decisions if d["decision"] == "block"]

    out = {
        "tenant": intake["tenant"],
        "evaluated": len(decisions),
        "allowed": len(allowed),
        "blocked": len(blocked),
        "decisions": decisions,
        "rules_applied": RULES_APPLIED,
    }
    sc.require_schema(out, sc.POLICY_SCHEMA, "policy_gate")
    return out


def allowed_ids(policy: dict[str, Any]) -> set[str]:
    return {d["lead_id"] for d in policy["decisions"] if d["decision"] == "allow"}


def assert_allowed(policy: dict[str, Any], lead_id: str, where: str) -> None:
    """Downstream guard: refuse to act on a lead the gate did not allow."""
    if lead_id not in allowed_ids(policy):
        raise sc.ProofRuleViolation(
            f"{where}: lead {lead_id} is not policy-allowed; refusing to proceed"
        )
