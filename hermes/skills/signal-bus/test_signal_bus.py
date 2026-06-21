#!/usr/bin/env python3
"""Tests for the Hermes signal bus / action ledger (W6).

Runs fully offline: no network, no DB, no cloud keys. Exercises event
ordering, idempotency, PII safety, the tamper-evident hash chain, file
persistence/replay, and contract validation.
"""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import signal_bus  # noqa: E402
from signal_bus import ActionLedger  # noqa: E402


class OrderingTests(unittest.TestCase):
    def test_seq_contiguous_and_monotonic(self) -> None:
        led = ActionLedger()
        for i in range(5):
            led.emit("lead.created", {"subject_ref": f"lead_{i}"}, actor="W1")
        seqs = [e["seq"] for e in led.read()]
        self.assertEqual(seqs, [0, 1, 2, 3, 4])

    def test_read_insertion_order_and_filters(self) -> None:
        led = ActionLedger()
        led.emit("lead.created", {"subject_ref": "a"}, actor="W1")
        led.emit("compliance.checked", {"subject_ref": "a", "result": "pass"}, actor="W1")
        led.emit("lead.created", {"subject_ref": "b"}, actor="W1")

        self.assertEqual([e["type"] for e in led.read()],
                         ["lead.created", "compliance.checked", "lead.created"])
        self.assertEqual(len(led.read(type="lead.created")), 2)
        # since_seq is inclusive of seq >= since_seq
        self.assertEqual([e["seq"] for e in led.read(since_seq=2)], [2])

    def test_prev_hash_links_chain(self) -> None:
        led = ActionLedger()
        r0 = led.emit("lead.created", {"subject_ref": "a"})
        r1 = led.emit("lead.created", {"subject_ref": "b"})
        self.assertEqual(r0["prev_hash"], signal_bus.GENESIS)
        self.assertEqual(r1["prev_hash"], r0["content_hash"])


class IdempotencyTests(unittest.TestCase):
    def test_same_key_no_double_append(self) -> None:
        led = ActionLedger()
        a = led.emit("lead.created", {"subject_ref": "a"}, idempotency_key="k1")
        b = led.emit("lead.created", {"subject_ref": "a"}, idempotency_key="k1")
        self.assertEqual(len(led), 1)
        self.assertEqual(a["event_id"], b["event_id"])
        self.assertEqual(a["content_hash"], b["content_hash"])

    def test_different_keys_two_appends(self) -> None:
        led = ActionLedger()
        led.emit("lead.created", {"subject_ref": "a"}, idempotency_key="k1")
        led.emit("lead.created", {"subject_ref": "b"}, idempotency_key="k2")
        self.assertEqual(len(led), 2)

    def test_idempotency_survives_reload(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            path = str(Path(d) / "led.jsonl")
            ActionLedger(path).emit("lead.created", {"subject_ref": "a"}, idempotency_key="k1")
            reopened = ActionLedger(path)
            reopened.emit("lead.created", {"subject_ref": "a"}, idempotency_key="k1")
            self.assertEqual(len(reopened), 1)


class PiiSafetyTests(unittest.TestCase):
    def test_redacts_and_flags(self) -> None:
        led = ActionLedger()
        rec = led.emit(
            "lead.created",
            {
                "subject_ref": "lead_x",
                "note": "reach me at jane.doe@example.com or 415-555-1212",
                "key": "sk-TESTONLYabcdefghijklmnopqrst",
                "card": "4242 4242 4242 4242",
            },
            actor="W1",
        )
        self.assertTrue(rec["pii_redacted"])
        blob = json.dumps(rec)
        self.assertNotIn("jane.doe@example.com", blob)
        self.assertNotIn("sk-TESTONLY", blob)
        self.assertNotIn("4242 4242 4242 4242", blob)
        self.assertIn("[EMAIL_REDACTED]", rec["payload"]["note"])

    def test_clean_payload_not_flagged(self) -> None:
        led = ActionLedger()
        rec = led.emit("lead.created", {"subject_ref": "lead_x", "source": "webform"})
        self.assertFalse(rec["pii_redacted"])

    def test_no_raw_pii_on_disk(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            path = str(Path(d) / "led.jsonl")
            led = ActionLedger(path)
            led.emit("lead.created", {"subject_ref": "lead_x", "email": "a@b.com"})
            raw = Path(path).read_bytes()
            self.assertNotIn(b"a@b.com", raw)
            self.assertIn(b"[EMAIL_REDACTED]", raw)


class HashChainProofTests(unittest.TestCase):
    def test_fresh_ledger_verifies(self) -> None:
        led = ActionLedger()
        for i in range(3):
            led.emit("lead.created", {"subject_ref": f"l{i}"})
        out = led.verify()
        self.assertTrue(out["valid"])
        self.assertEqual(out["length"], 3)
        self.assertIsNone(out["broken_at"])

    def test_tamper_detected_on_disk(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "led.jsonl"
            led = ActionLedger(str(path))
            led.emit("lead.created", {"subject_ref": "a"})
            led.emit("lead.created", {"subject_ref": "b"})

            lines = path.read_text().splitlines()
            rec = json.loads(lines[0])
            rec["payload"]["subject_ref"] = "TAMPERED"  # content_hash now wrong
            lines[0] = json.dumps(rec, sort_keys=True)
            path.write_text("\n".join(lines) + "\n")

            out = ActionLedger(str(path)).verify()
            self.assertFalse(out["valid"])
            self.assertEqual(out["broken_at"], 0)

    def test_proof_report_counts(self) -> None:
        led = ActionLedger()
        led.emit("lead.created", {"subject_ref": "a"})
        led.emit("lead.created", {"subject_ref": "b"})
        led.emit("compliance.checked", {"subject_ref": "a", "result": "pass"})
        rep = led.proof_report()
        self.assertTrue(rep["chain_valid"])
        self.assertEqual(rep["total_events"], 3)
        self.assertEqual(rep["counts_by_type"]["lead.created"], 2)
        self.assertEqual(rep["counts_by_type"]["compliance.checked"], 1)
        self.assertEqual(rep["head_hash"], led.head_hash)

    def test_proof_generated_event_round_trips(self) -> None:
        led = ActionLedger()
        led.emit("lead.created", {"subject_ref": "a"})
        proof = led.emit("proof.generated", {"head_hash": led.head_hash}, actor="W8")
        self.assertEqual(proof["type"], "proof.generated")
        self.assertTrue(led.verify()["valid"])


class PersistenceReplayTests(unittest.TestCase):
    def test_chain_continues_after_reopen(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            path = str(Path(d) / "led.jsonl")
            led = ActionLedger(path)
            led.emit("lead.created", {"subject_ref": "a"})
            head = led.head_hash

            reopened = ActionLedger(path)
            self.assertEqual(len(reopened), 1)
            rec = reopened.emit("lead.created", {"subject_ref": "b"})
            self.assertEqual(rec["seq"], 1)
            self.assertEqual(rec["prev_hash"], head)
            self.assertTrue(reopened.verify()["valid"])


class ContractValidationTests(unittest.TestCase):
    def test_unknown_type_raises(self) -> None:
        led = ActionLedger()
        with self.assertRaises(ValueError):
            led.emit("not.a.real.event", {"subject_ref": "a"})

    def test_missing_required_key_raises(self) -> None:
        led = ActionLedger()
        with self.assertRaises(ValueError):
            led.emit("compliance.checked", {"subject_ref": "a"})  # missing result
        with self.assertRaises(ValueError):
            led.emit("approval.requested", {})  # missing request_ref

    def test_subject_ref_kwarg_populates_payload(self) -> None:
        led = ActionLedger()
        rec = led.emit("appointment.mock_created", {}, subject_ref="lead_x")
        self.assertEqual(rec["payload"]["subject_ref"], "lead_x")
        self.assertEqual(rec["subject_ref"], "lead_x")


if __name__ == "__main__":
    unittest.main(verbosity=2)
