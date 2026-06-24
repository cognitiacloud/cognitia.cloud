#!/usr/bin/env python3
"""Station 4 — Lead/source registry mock.

Registers synthetic leads. This is the PII boundary of the spine: raw
identities from the fixture are masked here and a one-way ``contact_hash``
is computed for suppression matching. The emitted artifact is scanned for
unmasked PII before it is returned — if anything leaks, the run fails
closed (ProofRuleViolation).
"""

from __future__ import annotations

from typing import Any

import spine_common as sc


def run(intake: dict[str, Any], leads_seed: dict[str, Any]) -> dict[str, Any]:
    leads: list[dict[str, Any]] = []
    sources: dict[str, int] = {}
    for raw in leads_seed["leads"]:
        source = raw["source"]
        sources[source] = sources.get(source, 0) + 1
        leads.append(
            {
                "id": raw["id"],
                "masked_name": sc.mask(raw["raw_name"], "name"),
                "masked_email": sc.mask(raw["raw_email"], "email"),
                "masked_phone": sc.mask(raw["raw_phone"], "phone"),
                "contact_hash": sc.sha256_hex(raw["raw_email"].strip().lower()),
                "source": source,
                "consent_flag": bool(raw["consent"]),
                "preferred_channel": raw["preferred_channel"],
            }
        )

    out = {
        "tenant": intake["tenant"],
        "lead_count": len(leads),
        "leads": leads,
        "sources": dict(sorted(sources.items())),
        "provider": sc.select_provider(),
    }
    # Hard-rule guard: no raw PII may ever leave this station.
    sc.assert_no_unmasked_pii(out, "lead_registry output")
    sc.require_schema(out, sc.LEADS_SCHEMA, "lead_registry")
    return out
