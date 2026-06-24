#!/usr/bin/env python3
"""Generate the synthetic fixtures for the Budget Wheels proof spine.

Everything here is invented test data for the tenant ``budget_wheels_demo``.
There is no real business, no real website, no real competitor and no real
person. Lead identities are synthetic; the spine masks them at the registry
boundary so no value resembling PII is ever written to a run artifact.

Run directly to (re)write the JSON fixtures next to this file:

    python3 fixtures/generate_fixtures.py
"""

from __future__ import annotations

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from spine_common import sha256_hex, write_json  # noqa: E402

# Frozen run parameters — no wall-clock, no randomness. These make the
# golden run byte-stable and therefore replayable.
RUN_ID = "budget_wheels_demo-golden-0001"
CLOCK = "2026-06-24T14:30:00-05:00"
SEED = 424242


def contact_hash(raw_email: str) -> str:
    """One-way hash of a raw contact, used for suppression matching without
    persisting the contact itself."""
    return sha256_hex(raw_email.strip().lower())


PROFILE = {
    "tenant": "budget_wheels_demo",
    "run_id": RUN_ID,
    "clock": CLOCK,
    "seed": SEED,
    "business": {
        "name": "Budget Wheels",
        "industry": "used_car_dealership",
        "location": "Springfield, IL (synthetic)",
        "site_url": "https://budget-wheels.example",
        "founded": 2014,
    },
    "icp": {
        "segment": "first-time buyers and credit-rebuilders",
        "budget_band_usd": [4000, 18000],
        "intent_signals": ["financing_inquiry", "trade_in_quote", "test_drive_request"],
    },
    "offer": {
        "headline": "Drive today with $0 down on certified pre-owned",
        "proof_points": ["150-point inspection", "3-month warranty", "in-house financing"],
    },
    "eligible_channels": ["email", "sms", "phone"],
    "quiet_hours": {"start": "21:00", "end": "08:00", "tz": "America/Chicago"},
    "consent_posture": "explicit_opt_in_required",
}

SITE_SNAPSHOT = {
    "site_url": "https://budget-wheels.example",
    "captured_clock": CLOCK,
    "pages": [
        {"path": "/", "title": "Budget Wheels | Used Cars", "meta_description": True},
        {"path": "/inventory", "title": "Inventory", "meta_description": True},
        {"path": "/financing", "title": "Financing", "meta_description": False},
        {"path": "/contact", "title": "Contact Us", "meta_description": False},
    ],
    "has_https": True,
    "mobile_friendly": True,
    "page_speed_ms": 4200,
    "cta_count": 1,
    "review_widget": False,
    "review_count": 38,
    "schema_org_present": False,
    "broken_links": 3,
    "financing_calculator": False,
    "online_booking": False,
}

COMPETITORS = {
    "market": "Springfield used-car (synthetic)",
    "self": {
        "name": "Budget Wheels",
        "inventory_size": 120,
        "avg_price_usd": 11500,
        "review_score": 4.1,
        "online_booking": False,
        "financing_offers": True,
    },
    "competitors": [
        {
            "name": "ValueDrive Motors",
            "inventory_size": 240,
            "avg_price_usd": 12900,
            "review_score": 4.4,
            "online_booking": True,
            "financing_offers": True,
        },
        {
            "name": "CornerLot Autos",
            "inventory_size": 90,
            "avg_price_usd": 9800,
            "review_score": 3.8,
            "online_booking": False,
            "financing_offers": False,
        },
        {
            "name": "Prairie Pre-Owned",
            "inventory_size": 160,
            "avg_price_usd": 13400,
            "review_score": 4.6,
            "online_booking": True,
            "financing_offers": True,
        },
    ],
}

# Synthetic leads. raw_* values live ONLY in this fixture (a pipeline input)
# and are masked by station 4 before anything is emitted to a run artifact.
LEADS_SEED = {
    "tenant": "budget_wheels_demo",
    "leads": [
        {
            "id": "L-001", "raw_name": "Jordan Avery", "raw_email": "jordan.avery@mailtest.example",
            "raw_phone": "217-555-0101", "source": "web_form", "consent": True,
            "preferred_channel": "email",
        },
        {
            "id": "L-002", "raw_name": "Priya Nandan", "raw_email": "priya.nandan@mailtest.example",
            "raw_phone": "217-555-0102", "source": "marketplace", "consent": True,
            "preferred_channel": "sms",
        },
        {
            "id": "L-003", "raw_name": "Marcus Bell", "raw_email": "marcus.bell@mailtest.example",
            "raw_phone": "217-555-0103", "source": "referral", "consent": True,
            "preferred_channel": "phone",
        },
        {
            "id": "L-004", "raw_name": "Dana Cole", "raw_email": "dana.cole@mailtest.example",
            "raw_phone": "217-555-0104", "source": "web_form", "consent": True,
            "preferred_channel": "email",
        },
        {
            # BLOCKED: no consent
            "id": "L-005", "raw_name": "Sam Rivera", "raw_email": "sam.rivera@mailtest.example",
            "raw_phone": "217-555-0105", "source": "scraped_list", "consent": False,
            "preferred_channel": "email",
        },
        {
            # BLOCKED: on suppression list (see SUPPRESSION below)
            "id": "L-006", "raw_name": "Lee Watanabe", "raw_email": "lee.watanabe@mailtest.example",
            "raw_phone": "217-555-0106", "source": "web_form", "consent": True,
            "preferred_channel": "sms",
        },
        {
            # BLOCKED: requests an ineligible channel
            "id": "L-007", "raw_name": "Robin Fox", "raw_email": "robin.fox@mailtest.example",
            "raw_phone": "217-555-0107", "source": "referral", "consent": True,
            "preferred_channel": "fax",
        },
    ],
}

SUPPRESSION = {
    "description": "Synthetic do-not-contact list (hashed contacts only).",
    "suppressed_contact_hashes": [
        contact_hash("lee.watanabe@mailtest.example"),
    ],
}


def main() -> None:
    write_json(HERE / "budget_wheels_profile.json", PROFILE)
    write_json(HERE / "site_snapshot.json", SITE_SNAPSHOT)
    write_json(HERE / "competitors.json", COMPETITORS)
    write_json(HERE / "leads_seed.json", LEADS_SEED)
    write_json(HERE / "suppression_list.json", SUPPRESSION)
    print(f"wrote 5 fixtures to {HERE}")


if __name__ == "__main__":
    main()
