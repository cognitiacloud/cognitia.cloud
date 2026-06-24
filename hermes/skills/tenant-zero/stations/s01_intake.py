#!/usr/bin/env python3
"""Station 1 — Intake profile.

Loads the synthetic Budget Wheels business profile and normalises it into
the intake artifact that every downstream station keys on: eligible
channels, quiet hours, consent posture, and the frozen clock/seed that
make the run deterministic.
"""

from __future__ import annotations

from typing import Any

import spine_common as sc


def run(tenant: str, profile: dict[str, Any]) -> dict[str, Any]:
    if profile.get("tenant") != tenant:
        raise sc.ProofRuleViolation(
            f"intake tenant mismatch: requested {tenant!r}, "
            f"fixture is {profile.get('tenant')!r}"
        )

    out = {
        "tenant": tenant,
        "run_id": profile["run_id"],
        "clock": profile["clock"],
        "seed": profile["seed"],
        "business": profile["business"],
        "icp": profile["icp"],
        "offer": profile["offer"],
        "eligible_channels": sorted(profile["eligible_channels"]),
        "quiet_hours": profile["quiet_hours"],
        "consent_posture": profile["consent_posture"],
    }
    sc.require_schema(out, sc.INTAKE_SCHEMA, "intake")
    return out
