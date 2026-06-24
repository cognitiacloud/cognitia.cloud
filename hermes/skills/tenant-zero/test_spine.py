#!/usr/bin/env python3
"""Acceptance tests for the Tenant Zero proof spine.

Runs fully offline with no API keys. Proves the hard rules are enforced by
construction: the policy gate blocks violations, blocked/unapproved leads
never reach the CRM, no raw PII lands in any artifact, the CRM is idempotent,
the run replays byte-identically, and the receipt is tamper-evident.

    python3 test_spine.py
"""

from __future__ import annotations

import copy
import json
import os
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import console  # noqa: E402
import crm_store  # noqa: E402
import spine  # noqa: E402
import spine_common as sc  # noqa: E402
from fixtures import generate_fixtures  # noqa: E402
from stations import (  # noqa: E402
    s01_intake,
    s04_lead_registry,
    s05_policy_gate,
    s06_approval_queue,
)

TENANT = "budget_wheels_demo"
RUN_ID = "budget_wheels_demo-golden-0001"


def _ensure_fixtures() -> None:
    if not (sc.fixtures_dir() / "budget_wheels_profile.json").exists():
        generate_fixtures.main()


def _fx(name: str) -> dict:
    return sc.read_json(sc.fixtures_dir() / name)


# --------------------------------------------------------------------------
# Foundation
# --------------------------------------------------------------------------
class FoundationTests(unittest.TestCase):
    def test_mask_email_phone_name(self) -> None:
        self.assertNotIn("@example", sc.mask("jane.doe@example.com", "email").split("@")[0])
        self.assertTrue(sc.mask("217-555-0104", "phone").endswith("0104"))
        self.assertEqual(sc.mask("Jane Doe", "name").count("***"), 2)

    def test_masked_values_are_not_flagged_as_pii(self) -> None:
        masked = {
            "email": sc.mask("jane.doe@example.com", "email"),
            "phone": sc.mask("217-555-0104", "phone"),
            "name": sc.mask("Jane Doe", "name"),
        }
        self.assertEqual(sc.find_unmasked_pii(masked), [])

    def test_raw_values_are_flagged(self) -> None:
        hits = sc.find_unmasked_pii({"email": "jane.doe@example.com", "phone": "217-555-0104"})
        kinds = {h["kind"] for h in hits}
        self.assertIn("email", kinds)
        self.assertIn("phone", kinds)

    def test_hash_chain_is_order_sensitive(self) -> None:
        self.assertNotEqual(sc.hash_chain(["a", "b"]), sc.hash_chain(["b", "a"]))

    def test_canonical_str_is_stable(self) -> None:
        a = sc.canonical_str({"b": 1, "a": 2})
        b = sc.canonical_str({"a": 2, "b": 1})
        self.assertEqual(a, b)

    def test_provider_defaults_to_mock(self) -> None:
        os.environ.pop("TENANT_ZERO_PROVIDER", None)
        self.assertEqual(sc.select_provider(), "mock")


# --------------------------------------------------------------------------
# Station units
# --------------------------------------------------------------------------
class StationUnitTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        _ensure_fixtures()
        cls.intake = s01_intake.run(TENANT, _fx("budget_wheels_profile.json"))

    def test_registry_masks_and_validates_schema(self) -> None:
        leads = s04_lead_registry.run(self.intake, _fx("leads_seed.json"))
        for k in sc.LEADS_SCHEMA:
            self.assertIn(k, leads)
        self.assertEqual(sc.find_unmasked_pii(leads), [])
        for lead in leads["leads"]:
            self.assertIn("***", lead["masked_email"])

    def test_policy_blocks_each_violation_type(self) -> None:
        leads = s04_lead_registry.run(self.intake, _fx("leads_seed.json"))
        policy = s05_policy_gate.run(self.intake, leads, _fx("suppression_list.json"))
        by_id = {d["lead_id"]: d for d in policy["decisions"]}
        self.assertEqual(by_id["L-005"]["decision"], "block")  # no consent
        self.assertEqual(by_id["L-006"]["decision"], "block")  # suppressed
        self.assertEqual(by_id["L-007"]["decision"], "block")  # ineligible channel
        self.assertEqual(policy["allowed"], 4)
        self.assertEqual(policy["blocked"], 3)

    def test_policy_blocks_injected_unmasked_pii(self) -> None:
        leads = s04_lead_registry.run(self.intake, _fx("leads_seed.json"))
        tampered = copy.deepcopy(leads)
        # Simulate a masking miss: a raw email slips into a lead record.
        tampered["leads"][0]["masked_email"] = "leak.raw@realmail.example"
        policy = s05_policy_gate.run(self.intake, tampered, _fx("suppression_list.json"))
        d0 = next(d for d in policy["decisions"] if d["lead_id"] == "L-001")
        self.assertEqual(d0["decision"], "block")
        self.assertFalse(d0["checks"]["pii_masking"])

    def test_quiet_hours_blocks_when_clock_in_window(self) -> None:
        night_intake = copy.deepcopy(self.intake)
        night_intake["clock"] = "2026-06-24T23:30:00-05:00"
        leads = s04_lead_registry.run(self.intake, _fx("leads_seed.json"))
        policy = s05_policy_gate.run(night_intake, leads, _fx("suppression_list.json"))
        self.assertEqual(policy["allowed"], 0)

    def test_closer_guard_refuses_blocked_lead(self) -> None:
        leads = s04_lead_registry.run(self.intake, _fx("leads_seed.json"))
        policy = s05_policy_gate.run(self.intake, leads, _fx("suppression_list.json"))
        with self.assertRaises(sc.ProofRuleViolation):
            s05_policy_gate.assert_allowed(policy, "L-005", "test")


# --------------------------------------------------------------------------
# End-to-end
# --------------------------------------------------------------------------
class EndToEndTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        # Prove the offline guarantee: no API keys present during the run.
        cls._saved = {k: os.environ.pop(k) for k in list(os.environ) if k.endswith("_API_KEY")}
        _ensure_fixtures()
        cls.out = HERE / "run"
        cls.res = spine.run_pipeline(TENANT, cls.out)
        cls.run_dir = cls.out / RUN_ID

    @classmethod
    def tearDownClass(cls) -> None:
        os.environ.update(cls._saved)

    def test_run_seals_and_verifies(self) -> None:
        self.assertTrue(self.res["ok"])
        v = spine.s09_receipt.verify(self.run_dir)
        self.assertTrue(v["ok"])

    def test_all_artifacts_present_and_schema_valid(self) -> None:
        schemas = {
            "00_intake.json": sc.INTAKE_SCHEMA,
            "01_site_audit.json": sc.SITE_AUDIT_SCHEMA,
            "02_competitors.json": sc.COMPETITORS_SCHEMA,
            "03_leads.json": sc.LEADS_SCHEMA,
            "04_policy.json": sc.POLICY_SCHEMA,
            "05_approval_queue.json": sc.APPROVAL_QUEUE_SCHEMA,
            "06_approvals.json": sc.APPROVALS_SCHEMA,
            "07_closer_brief.json": sc.CLOSER_BRIEF_SCHEMA,
            "08_crm_writeback.json": sc.CRM_WRITEBACK_SCHEMA,
            "09_receipt.json": sc.RECEIPT_SCHEMA,
        }
        for artifact, schema in schemas.items():
            obj = sc.read_json(self.run_dir / artifact)
            self.assertEqual(sc.schema_ok(obj, schema), [], msg=artifact)

    def test_no_raw_pii_in_any_emitted_artifact(self) -> None:
        for _, _, artifact in sc.STATIONS:
            obj = sc.read_json(self.run_dir / artifact)
            self.assertEqual(sc.find_unmasked_pii(obj), [], msg=artifact)

    def test_blocked_leads_absent_downstream(self) -> None:
        crm = sc.read_json(self.run_dir / "08_crm_writeback.json")
        closer = sc.read_json(self.run_dir / "07_closer_brief.json")
        crm_ids = {r["lead_id"] for r in crm["rows"]}
        brief_ids = {b["lead_id"] for b in closer["briefs"]}
        for blocked in ("L-005", "L-006", "L-007"):
            self.assertNotIn(blocked, crm_ids)
            self.assertNotIn(blocked, brief_ids)

    def test_attestations_all_pass(self) -> None:
        receipt = sc.read_json(self.run_dir / "09_receipt.json")
        self.assertTrue(all(receipt["attestations"].values()), msg=receipt["attestations"])

    def test_crm_writeback_is_idempotent(self) -> None:
        db = self.run_dir / "crm.sqlite"
        before = crm_store.count_rows(db)
        closer = sc.read_json(self.run_dir / "07_closer_brief.json")
        crm_store.upsert_briefs(db, closer["briefs"])
        crm_store.upsert_briefs(db, closer["briefs"])
        self.assertEqual(crm_store.count_rows(db), before)

    def test_replay_is_byte_identical(self) -> None:
        res = spine.replay(RUN_ID, self.out)
        self.assertTrue(res["ok"], msg=res)
        self.assertTrue(res["byte_identical"])
        self.assertEqual(res["receipt_root"], res["replay_root"])

    def test_tamper_breaks_verification(self) -> None:
        leaks = self.run_dir / "03_leads.json"
        original = leaks.read_text(encoding="utf-8")
        try:
            d = json.loads(original)
            d["lead_count"] = 999
            leaks.write_text(json.dumps(d, sort_keys=True, indent=2) + "\n", encoding="utf-8")
            v = spine.s09_receipt.verify(self.run_dir)
            self.assertFalse(v["ok"])
            self.assertTrue(v["mismatches"])
        finally:
            leaks.write_text(original, encoding="utf-8")

    def test_approve_reject_removes_lead_from_crm(self) -> None:
        # Run in an isolated output dir so the shared golden run is untouched.
        import shutil
        import tempfile

        tmp = Path(tempfile.mkdtemp(prefix="tz_reject_"))
        try:
            spine.run_pipeline(TENANT, tmp)
            spine.approve(RUN_ID, "AQ-L-002", "reject", "test reject", "tester", tmp)
            crm = sc.read_json(tmp / RUN_ID / "08_crm_writeback.json")
            self.assertNotIn("L-002", {r["lead_id"] for r in crm["rows"]})
            self.assertEqual(crm["rows_written"], 3)
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    def test_console_html_renders(self) -> None:
        path = console.render(self.run_dir)
        self.assertTrue(path.exists())
        self.assertIn("Proof receipt root", path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    _ensure_fixtures()
    unittest.main(verbosity=2)
