#!/usr/bin/env python3
"""Station 3 — Competitor intelligence mock.

Deterministic positioning analysis over a fixture competitor set. Computes
per-competitor deltas vs Budget Wheels and a stable ranking. No live data.
"""

from __future__ import annotations

from typing import Any

import spine_common as sc


def _delta(self_v: float, comp_v: float) -> float:
    return round(comp_v - self_v, 2)


def run(intake: dict[str, Any], comp_fixture: dict[str, Any]) -> dict[str, Any]:
    me = comp_fixture["self"]
    deltas: list[dict[str, Any]] = []
    for c in comp_fixture["competitors"]:
        deltas.append(
            {
                "competitor": c["name"],
                "price_delta_usd": _delta(me["avg_price_usd"], c["avg_price_usd"]),
                "review_delta": _delta(me["review_score"], c["review_score"]),
                "inventory_delta": c["inventory_size"] - me["inventory_size"],
                "online_booking_edge": c["online_booking"] and not me["online_booking"],
                "financing_parity": c["financing_offers"] == me["financing_offers"],
            }
        )

    # Rank competitors by a stable threat score (higher review + booking edge
    # + bigger inventory = more threatening). Deterministic tie-break on name.
    def threat(d: dict[str, Any]) -> tuple[float, int, int, str]:
        return (
            d["review_delta"],
            1 if d["online_booking_edge"] else 0,
            d["inventory_delta"],
            d["competitor"],
        )

    ranked = [d["competitor"] for d in sorted(deltas, key=threat, reverse=True)]

    out = {
        "tenant": intake["tenant"],
        "competitors": [c["name"] for c in comp_fixture["competitors"]],
        "positioning_deltas": deltas,
        "ranked": ranked,
        "provider": sc.select_provider(),
    }
    sc.require_schema(out, sc.COMPETITORS_SCHEMA, "competitors")
    return out
