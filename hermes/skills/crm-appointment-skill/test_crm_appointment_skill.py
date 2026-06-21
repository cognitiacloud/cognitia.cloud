#!/usr/bin/env python3
"""Unit + smoke tests for the Hermes CRM/appointment mock skill (W3).

Runs fully offline: no network, no credentials, no external systems. Every
test uses an isolated mock store (a per-test temp dir, exercising the
file-persistence + atomic-write path).
"""

from __future__ import annotations

import json
import shutil
import tempfile
import unittest
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import crm_appointment_skill as w3  # noqa: E402


# --------------------------- Fixture builders -------------------------------

def _appt_request(**overrides: object) -> dict:
    req = {
        "idempotency_key": "appt-001",
        "request_type": "appointment",
        "client_id": "demandara-client-zero",
        "contact": {"name": "Test Lead", "email": "lead@example.com", "phone": "555-123-4567"},
        "requested_slot": "2026-07-01T15:00:00+00:00",
        "duration_minutes": 30,
        "channel": "video",
        "notes": "intro call",
        "compliance_status": "pass",
        "approval_status": "approved",
        "source_workflow": "W1",
        "submitted_at": "2026-06-21T12:00:00+00:00",
    }
    req.update(overrides)
    return req


def _crm_request(**overrides: object) -> dict:
    req = {
        "idempotency_key": "crm-001",
        "request_type": "crm_writeback",
        "client_id": "demandara-client-zero",
        "object_type": "contact",
        "contact": {"name": "Test Lead", "email": "lead@example.com",
                    "phone": "555-123-4567", "company": "Acme"},
        "deal": None,
        "compliance_status": "pass",
        "approval_status": "approved",
        "source_workflow": "W1",
        "submitted_at": "2026-06-21T12:00:00+00:00",
    }
    req.update(overrides)
    return req


class _StoreTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.mkdtemp(prefix="hermes-crm-test-")
        self.store = w3.MockStore(self.tmp)

    def tearDown(self) -> None:
        shutil.rmtree(self.tmp, ignore_errors=True)


# --------------------------- Validation (5d) --------------------------------

class ValidationTests(_StoreTest):
    def test_missing_idempotency_key_fails(self) -> None:
        req = _appt_request()
        del req["idempotency_key"]
        out = w3.book_appointment(req, store=self.store)
        self.assertEqual(out["status"], "failed")
        self.assertEqual(out["block_reason"], "validation_error")
        self.assertEqual(self.store.counts()["appointments"], 0)
        events = self.store.ledger()
        self.assertEqual(events[-1]["event_type"], "request_failed")
        self.assertEqual(events[-1]["outcome"], "error")

    def test_unknown_request_type_fails(self) -> None:
        out = w3.book_appointment(_appt_request(request_type="frobnicate"), store=self.store)
        self.assertEqual(out["status"], "failed")

    def test_deal_without_payload_fails(self) -> None:
        out = w3.crm_writeback(
            _crm_request(idempotency_key="crm-deal-x", object_type="deal", deal=None),
            store=self.store,
        )
        self.assertEqual(out["status"], "failed")
        self.assertEqual(self.store.counts()["crm_records"], 0)

    def test_bad_channel_fails(self) -> None:
        out = w3.book_appointment(_appt_request(channel="telepathy"), store=self.store)
        self.assertEqual(out["status"], "failed")


# --------------------------- Gate -------------------------------------------

class GateTests(unittest.TestCase):
    def test_only_pass_and_approved_allowed(self) -> None:
        self.assertTrue(w3._evaluate_gate(_appt_request()).allowed)

    def test_each_blocked_combo(self) -> None:
        cases = {
            ("pending", "approved"): "compliance_pending",
            ("fail", "approved"): "compliance_failed",
            ("pass", "pending"): "approval_pending",
            ("pass", "rejected"): "approval_not_granted",
        }
        for (comp, appr), code in cases.items():
            gate = w3._evaluate_gate(_appt_request(compliance_status=comp, approval_status=appr))
            self.assertFalse(gate.allowed, msg=(comp, appr))
            self.assertEqual(gate.block_reason_code, code, msg=(comp, appr))

    def test_secret_in_notes_forces_compliance_failure(self) -> None:
        leaky = _appt_request(notes="key sk-TESTONLYabcdefghijklmnopqrst here")
        gate = w3._evaluate_gate(leaky)
        self.assertFalse(gate.allowed)
        self.assertEqual(gate.block_reason_code, "compliance_failed")


# --------------------------- Appointment success (5a) -----------------------

class AppointmentSuccessTests(_StoreTest):
    def test_happy_path_books(self) -> None:
        out = w3.book_appointment(_appt_request(), store=self.store)
        self.assertEqual(out["status"], "booked")
        self.assertTrue(out["record_id"].startswith("appt_"))
        self.assertEqual(out["scheduled_slot"], "2026-07-01T15:00:00+00:00")
        self.assertIsNone(out["block_reason"])
        for k in w3.APPOINTMENT_RECORD_SCHEMA:
            self.assertIn(k, out)
        self.assertEqual(self.store.counts()["appointments"], 1)
        ev = self.store.ledger()[-1]
        self.assertEqual(ev["event_type"], "appointment_booked")
        self.assertEqual(ev["outcome"], "created")


# --------------------------- CRM success ------------------------------------

class CrmSuccessTests(_StoreTest):
    def test_contact_writeback(self) -> None:
        out = w3.crm_writeback(_crm_request(), store=self.store)
        self.assertEqual(out["status"], "written")
        self.assertTrue(out["record_id"].startswith("crm_"))
        for k in w3.CRM_RECORD_SCHEMA:
            self.assertIn(k, out)
        self.assertEqual(self.store.ledger()[-1]["event_type"], "crm_written")

    def test_deal_writeback(self) -> None:
        out = w3.crm_writeback(
            _crm_request(
                idempotency_key="crm-deal-1", object_type="deal",
                deal={"title": "Pilot", "amount": 5000, "stage": "proposal", "currency": "USD"},
            ),
            store=self.store,
        )
        self.assertEqual(out["status"], "written")
        self.assertEqual(out["object_type"], "deal")
        self.assertEqual(out["deal"]["amount"], 5000)


# --------------------------- Idempotency (5b / acceptance #2) ---------------

class IdempotencyTests(_StoreTest):
    def test_duplicate_appointment_is_noop(self) -> None:
        first = w3.book_appointment(_appt_request(), store=self.store)
        second = w3.book_appointment(_appt_request(), store=self.store)
        self.assertEqual(first["record_id"], second["record_id"])
        self.assertTrue(second.get("deduplicated"))
        self.assertEqual(self.store.counts()["appointments"], 1)
        types = [e["event_type"] for e in self.store.ledger()]
        self.assertEqual(types.count("appointment_booked"), 1)
        self.assertEqual(types.count("appointment_deduplicated"), 1)
        self.assertEqual(self.store.ledger()[-1]["outcome"], "duplicate_noop")

    def test_duplicate_crm_is_noop(self) -> None:
        first = w3.crm_writeback(_crm_request(), store=self.store)
        second = w3.crm_writeback(_crm_request(), store=self.store)
        self.assertEqual(first["record_id"], second["record_id"])
        self.assertTrue(second.get("deduplicated"))
        self.assertEqual(self.store.counts()["crm_records"], 1)

    def test_different_keys_create_distinct_records(self) -> None:
        w3.book_appointment(_appt_request(idempotency_key="a1"), store=self.store)
        w3.book_appointment(_appt_request(idempotency_key="a2"), store=self.store)
        self.assertEqual(self.store.counts()["appointments"], 2)


# --------------------------- Blocked write (5c / acceptance #1) -------------

class BlockedWriteTests(_StoreTest):
    def test_pending_approval_is_blocked(self) -> None:
        out = w3.book_appointment(_appt_request(approval_status="pending"), store=self.store)
        self.assertEqual(out["status"], "blocked")
        self.assertEqual(out["block_reason"], "approval_pending")
        self.assertIsNone(out["scheduled_slot"])  # no booking side effect
        ev = self.store.ledger()[-1]
        self.assertEqual(ev["event_type"], "appointment_blocked")
        self.assertEqual(ev["outcome"], "blocked")

    def test_rejected_approval_blocked(self) -> None:
        out = w3.crm_writeback(_crm_request(approval_status="rejected"), store=self.store)
        self.assertEqual(out["status"], "blocked")
        self.assertEqual(out["block_reason"], "approval_not_granted")

    def test_blocked_then_resubmit_is_idempotent(self) -> None:
        first = w3.book_appointment(_appt_request(approval_status="pending"), store=self.store)
        second = w3.book_appointment(_appt_request(approval_status="pending"), store=self.store)
        self.assertEqual(first["record_id"], second["record_id"])
        self.assertTrue(second.get("deduplicated"))
        self.assertEqual(self.store.counts()["appointments"], 1)

    def test_no_booked_event_without_gate_pass(self) -> None:
        w3.book_appointment(_appt_request(compliance_status="fail"), store=self.store)
        types = [e["event_type"] for e in self.store.ledger()]
        self.assertNotIn("appointment_booked", types)
        self.assertIn("appointment_blocked", types)


# --------------------------- Proof ledger (acceptance #3) -------------------

class ProofLedgerTests(_StoreTest):
    def test_seq_contiguous_and_schema_complete(self) -> None:
        w3.book_appointment(_appt_request(idempotency_key="a1"), store=self.store)
        w3.crm_writeback(_crm_request(idempotency_key="c1"), store=self.store)
        w3.book_appointment(_appt_request(idempotency_key="a2", approval_status="pending"),
                            store=self.store)
        proof = w3.get_proof_ledger(store=self.store)
        seqs = [e["event_seq"] for e in proof["events"]]
        self.assertEqual(seqs, list(range(1, len(seqs) + 1)))  # contiguous from 1
        for e in proof["events"]:
            for k in w3.LEDGER_EVENT_SCHEMA:
                self.assertIn(k, e)
            self.assertIn(e["outcome"], {"created", "duplicate_noop", "blocked", "error"})

    def test_since_seq_filters(self) -> None:
        w3.book_appointment(_appt_request(idempotency_key="a1"), store=self.store)
        w3.book_appointment(_appt_request(idempotency_key="a2"), store=self.store)
        proof = w3.get_proof_ledger(since_seq=1, store=self.store)
        self.assertEqual(proof["event_count"], 1)
        self.assertEqual(proof["events"][0]["event_seq"], 2)

    def test_append_only(self) -> None:
        w3.book_appointment(_appt_request(idempotency_key="a1"), store=self.store)
        before = json.dumps(w3.get_proof_ledger(store=self.store)["events"])
        w3.book_appointment(_appt_request(idempotency_key="a2"), store=self.store)
        after = w3.get_proof_ledger(store=self.store)["events"]
        self.assertEqual(json.dumps(after[:1]), json.dumps(json.loads(before)[:1]))

    def test_reason_is_redacted(self) -> None:
        w3.book_appointment(
            _appt_request(notes="email me at secret@hidden.com sk-TESTONLYabcdefghijklmnop"),
            store=self.store,
        )
        ev = self.store.ledger()[-1]
        self.assertNotIn("secret@hidden.com", ev["reason"] or "")
        self.assertNotIn("sk-TESTONLY", ev["reason"] or "")


# --------------------------- Persistence ------------------------------------

class PersistenceTests(_StoreTest):
    def test_reload_preserves_records_and_idempotency(self) -> None:
        w3.book_appointment(_appt_request(idempotency_key="persist-1"), store=self.store)
        # New store object over the same dir.
        reopened = w3.MockStore(self.tmp)
        found = w3.get_record("persist-1", store=reopened)
        self.assertTrue(found["found"])
        self.assertEqual(found["status"], "booked")
        # Idempotency holds across the reload — no duplicate.
        again = w3.book_appointment(_appt_request(idempotency_key="persist-1"), store=reopened)
        self.assertTrue(again.get("deduplicated"))
        self.assertEqual(reopened.counts()["appointments"], 1)

    def test_get_record_miss(self) -> None:
        out = w3.get_record("nope", store=self.store)
        self.assertFalse(out["found"])


# --------------------------- Redaction --------------------------------------

class RedactionTests(unittest.TestCase):
    def test_redacts_email_and_key(self) -> None:
        red = w3._redact("a@b.com sk-TESTONLYabcdefghijklmnopqrst")
        self.assertNotIn("a@b.com", red)
        self.assertNotIn("sk-TESTONLY", red)


# --------------------------- CLI smoke --------------------------------------

class CliSmokeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.mkdtemp(prefix="hermes-crm-cli-")

    def tearDown(self) -> None:
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_book_then_proof(self) -> None:
        req_file = Path(self.tmp) / "req.json"
        req_file.write_text(json.dumps(_appt_request(idempotency_key="cli-1")))
        rc = w3._cli(["book", "--request-file", str(req_file), "--state-dir", self.tmp])
        self.assertEqual(rc, 0)
        # Second identical book → deduplicated (still rc 0).
        rc2 = w3._cli(["book", "--request-file", str(req_file), "--state-dir", self.tmp])
        self.assertEqual(rc2, 0)
        rc3 = w3._cli(["proof", "--state-dir", self.tmp])
        self.assertEqual(rc3, 0)
        # Verify store on disk reflects exactly one appointment.
        store = w3.MockStore(self.tmp)
        self.assertEqual(store.counts()["appointments"], 1)


if __name__ == "__main__":
    unittest.main(verbosity=2)
