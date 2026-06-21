#!/usr/bin/env python3
"""Tests for the W5 Sales Closer proof report generator.

Run:
    python3 test_proof_report.py
"""

from __future__ import annotations

import json
import unittest
from pathlib import Path

import proof_report as pr

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "sales_closer_completed.json"


def _load() -> dict:
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


class GenerateProofReportTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.fixture = _load()
        cls.report = pr.generate_proof_report(cls.fixture, now="2026-06-20T15:08:42Z")
        cls.blob = json.dumps(cls.report)

    # --- No raw PII ---------------------------------------------------------
    def test_no_raw_pii_in_output(self) -> None:
        scan = pr._scan_text_for_pii(self.blob)
        self.assertTrue(pr._pii_is_clean(scan), msg=f"PII leaked: {scan}")

    def test_fixture_contact_strings_absent_from_proof(self) -> None:
        # The fixture deliberately contains fake PII; none may appear in proof.
        raw = self.fixture["raw_contact"]
        self.assertIn("@", raw["email"])  # sanity: fixture really holds an email
        self.assertNotIn(raw["email"], self.blob)
        self.assertNotIn(raw["phone"], self.blob)
        self.assertNotIn(raw["display_name"], self.blob)

    # --- Required structure / fields ---------------------------------------
    def test_top_level_schema_keys_present(self) -> None:
        for key in pr.PROOF_REPORT_SCHEMA:
            self.assertIn(key, self.report)

    def test_every_evidence_entry_has_required_fields(self) -> None:
        self.assertTrue(self.report["evidence"])
        for entry in self.report["evidence"]:
            for key in pr.EVIDENCE_SCHEMA:
                self.assertIn(key, entry, msg=f"missing {key} in {entry}")
            self.assertIn(entry["classification"], pr.CLASSIFICATIONS)
            self.assertIn(entry["stage"], pr.STAGES)
            self.assertTrue(entry["pii_safe"])

    def test_all_five_stages_covered(self) -> None:
        covered = {e["stage"] for e in self.report["evidence"]}
        self.assertEqual(covered, set(pr.STAGES))

    # --- Classification taxonomy -------------------------------------------
    def test_taxonomy_has_verified_inference_and_unknown(self) -> None:
        kinds = {e["classification"] for e in self.report["evidence"]}
        self.assertIn(pr.VERIFIED, kinds)
        self.assertIn(pr.LIKELY_INFERENCE, kinds)
        self.assertIn(pr.UNKNOWN, kinds)

    def test_summary_counts_match_evidence(self) -> None:
        s = self.report["summary"]
        ev = self.report["evidence"]
        self.assertEqual(s["total_evidence"], len(ev))
        self.assertEqual(
            s["verified_count"],
            sum(1 for e in ev if e["classification"] == pr.VERIFIED),
        )
        self.assertEqual(
            s["likely_inference_count"],
            sum(1 for e in ev if e["classification"] == pr.LIKELY_INFERENCE),
        )
        self.assertEqual(
            s["unknown_count"],
            sum(1 for e in ev if e["classification"] == pr.UNKNOWN),
        )

    def test_inference_entries_carry_confidence(self) -> None:
        for e in self.report["evidence"]:
            if e["classification"] == pr.LIKELY_INFERENCE:
                self.assertIsInstance(e["confidence"], float)
                self.assertTrue(0.0 <= e["confidence"] <= 1.0)

    # --- Human approval record ---------------------------------------------
    def test_human_approval_record_included(self) -> None:
        appr = self.report["human_approval"]
        for key in pr.APPROVAL_SCHEMA:
            self.assertIn(key, appr)
        self.assertEqual(appr["decision"], "approved")
        self.assertEqual(appr["approver_role"], "Compliance Reviewer")
        # Role/pseudonym only -- no personal name.
        self.assertTrue(appr["signature_checksum"])

    # --- Forbidden language -------------------------------------------------
    def test_no_token_or_blockchain_language(self) -> None:
        found = pr._scan_forbidden_terms(self.blob)
        self.assertEqual(found, [], msg=f"forbidden terms present: {found}")

    # --- Integrity / determinism -------------------------------------------
    def test_integrity_checksum_is_sha256_and_neutral(self) -> None:
        integ = self.report["integrity"]
        self.assertEqual(integ["algorithm"], "sha256")
        self.assertEqual(len(integ["content_checksum"]), 64)

    def test_deterministic_checksum(self) -> None:
        again = pr.generate_proof_report(_load(), now="2026-06-20T15:08:42Z")
        self.assertEqual(
            self.report["integrity"]["content_checksum"],
            again["integrity"]["content_checksum"],
        )

    def test_assurances_flag_mock_safe_no_real_data(self) -> None:
        a = self.report["assurances"]
        self.assertEqual(a["mode"], "mock_safe")
        self.assertFalse(a["contains_real_customer_data"])
        self.assertTrue(a["pii_scan_passed"])


class FailClosedTests(unittest.TestCase):
    def test_pii_leak_in_claim_raises(self) -> None:
        # Tamper: inject a real-looking email into a field the generator echoes.
        tampered = _load()
        tampered["steps"]["lead_intake"]["source_channel"] = "ping victim@leak.com"
        with self.assertRaises(pr.ProofGuardError):
            pr.generate_proof_report(tampered, now="2026-06-20T15:08:42Z")

    def test_forbidden_language_raises(self) -> None:
        tampered = _load()
        tampered["steps"]["crm_mock"]["stage_name"] = "blockchain_synced"
        with self.assertRaises(pr.ProofGuardError):
            pr.generate_proof_report(tampered, now="2026-06-20T15:08:42Z")

    def test_incomplete_workflow_rejected(self) -> None:
        bad = _load()
        bad["status"] = "running"
        with self.assertRaises(ValueError):
            pr.generate_proof_report(bad)

    def test_missing_stage_rejected(self) -> None:
        bad = _load()
        del bad["steps"]["crm_mock"]
        with self.assertRaises(ValueError):
            pr.generate_proof_report(bad)


class PiiScannerUnitTests(unittest.TestCase):
    def test_detects_email_and_phone(self) -> None:
        scan = pr._scan_text_for_pii("reach jane.doe@example.com or 555-123-4567")
        self.assertIn("jane.doe@example.com", scan["emails_detected"])
        self.assertTrue(scan["phone_numbers_detected"])
        self.assertFalse(pr._pii_is_clean(scan))

    def test_clean_text_is_clean(self) -> None:
        scan = pr._scan_text_for_pii("Lead SC-LEAD-0001 approved for mock booking")
        self.assertTrue(pr._pii_is_clean(scan))


if __name__ == "__main__":
    unittest.main(verbosity=2)
