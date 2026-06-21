#!/usr/bin/env python3
"""Generate synthetic W1->W3 request fixtures.

Everything here is fabricated — no real client, contact, calendar slot, or
credential. These files feed the CLI smoke path and serve as worked examples
of the W1 request envelope documented in CONTRACT.md.

Run:
    python3 generate_fixtures.py
"""

from __future__ import annotations

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent

FIXTURES: dict[str, dict] = {
    # Happy path: compliance pass + approval granted -> booked.
    "appt_ok.json": {
        "idempotency_key": "w1-appt-2026-07-01-lead-001",
        "request_type": "appointment",
        "client_id": "demandara-client-zero",
        "contact": {"name": "Jordan Sample", "email": "jordan@example.com",
                    "phone": "555-201-3040"},
        "requested_slot": "2026-07-01T15:00:00+00:00",
        "duration_minutes": 30,
        "channel": "video",
        "notes": "Discovery call requested from the website form.",
        "compliance_status": "pass",
        "approval_status": "approved",
        "source_workflow": "W1",
        "submitted_at": "2026-06-21T12:00:00+00:00",
    },
    # Compliance passed but approval still pending -> blocked, no booking.
    "appt_pending_approval.json": {
        "idempotency_key": "w1-appt-2026-07-02-lead-002",
        "request_type": "appointment",
        "client_id": "demandara-client-zero",
        "contact": {"name": "Riley Example", "email": "riley@example.com",
                    "phone": "555-202-5060"},
        "requested_slot": "2026-07-02T17:30:00+00:00",
        "duration_minutes": 45,
        "channel": "phone",
        "notes": "Awaiting account-owner approval before booking.",
        "compliance_status": "pass",
        "approval_status": "pending",
        "source_workflow": "W1",
        "submitted_at": "2026-06-21T12:05:00+00:00",
    },
    # CRM contact writeback, happy path.
    "crm_contact_ok.json": {
        "idempotency_key": "w1-crm-contact-lead-001",
        "request_type": "crm_writeback",
        "client_id": "demandara-client-zero",
        "object_type": "contact",
        "contact": {"name": "Jordan Sample", "email": "jordan@example.com",
                    "phone": "555-201-3040", "company": "Sample Co"},
        "deal": None,
        "compliance_status": "pass",
        "approval_status": "approved",
        "source_workflow": "W1",
        "submitted_at": "2026-06-21T12:10:00+00:00",
    },
    # CRM deal writeback, happy path.
    "crm_deal_ok.json": {
        "idempotency_key": "w1-crm-deal-lead-001",
        "request_type": "crm_writeback",
        "client_id": "demandara-client-zero",
        "object_type": "deal",
        "contact": {"name": "Jordan Sample", "email": "jordan@example.com",
                    "phone": "555-201-3040", "company": "Sample Co"},
        "deal": {"title": "Client Zero pilot", "amount": 5000,
                 "stage": "proposal", "currency": "USD"},
        "compliance_status": "pass",
        "approval_status": "approved",
        "source_workflow": "W1",
        "submitted_at": "2026-06-21T12:15:00+00:00",
    },
}


def main() -> None:
    for name, payload in FIXTURES.items():
        (HERE / name).write_text(json.dumps(payload, indent=2) + "\n")
        print(f"wrote {name}")


if __name__ == "__main__":
    main()
