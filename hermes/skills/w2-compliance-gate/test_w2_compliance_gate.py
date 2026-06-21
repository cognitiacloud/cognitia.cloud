#!/usr/bin/env python3
"""Unit tests for the Hermes W2 compliance gate.

Pure stdlib; runs with no network, keys, or external services. Fixtures are
inline dicts. Proves both blocked and approved paths required by the W2
acceptance criteria.
"""

from __future__ import annotations

import json
import subprocess
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import w2_compliance_gate as gate  # noqa: E402
from w2_compliance_gate import (  # noqa: E402
    Decision,
    OperatorDecision,
    ReasonCode,
)


# --------------------------- Fixtures ---------------------------------------

def safe_lead_request(**overrides) -> dict:
    """A clean, fully-consented sandbox send that should ALLOW."""
    req = {
        "request_id": "req-safe-1",
        "channel": "sandbox_sms",
        "intent": "send_message",
        "content": "Hi Jordan, thanks for stopping by today. When works for a visit?",
        "lead": {"name": "Jordan Lee", "phone": "555-123-4567"},
        "consent": {"sms": True},
    }
    req.update(overrides)
    return req


def _reasons(decision) -> set[str]:
    return {r.value for r in decision.reasons}


class DetectorTests(unittest.TestCase):
    def test_finance_language_detected(self) -> None:
        d = gate.evaluate(safe_lead_request(content="We can finance this with a great loan."))
        self.assertIn(ReasonCode.FINANCE_CLAIM, d.reasons)

    def test_trade_in_detected(self) -> None:
        d = gate.evaluate(safe_lead_request(content="What is your trade-in worth? Free appraisal!"))
        self.assertIn(ReasonCode.TRADE_IN_CLAIM, d.reasons)

    def test_apr_payment_detected(self) -> None:
        d = gate.evaluate(safe_lead_request(content="Just 2.9% APR, only $299/mo monthly payment."))
        self.assertIn(ReasonCode.APR_PAYMENT_CLAIM, d.reasons)

    def test_approval_claim_detected(self) -> None:
        d = gate.evaluate(safe_lead_request(content="Good news, you're approved for financing!"))
        self.assertIn(ReasonCode.APPROVAL_CLAIM, d.reasons)

    def test_legal_conclusion_detected(self) -> None:
        d = gate.evaluate(safe_lead_request(content="This deposit is legally binding once paid."))
        self.assertIn(ReasonCode.LEGAL_CONCLUSION, d.reasons)

    def test_clean_content_has_no_claim_reasons(self) -> None:
        d = gate.evaluate(safe_lead_request())
        for code in (ReasonCode.FINANCE_CLAIM, ReasonCode.TRADE_IN_CLAIM,
                     ReasonCode.APR_PAYMENT_CLAIM, ReasonCode.APPROVAL_CLAIM,
                     ReasonCode.LEGAL_CONCLUSION):
            self.assertNotIn(code, d.reasons)

    def test_pii_redacted_from_outputs(self) -> None:
        d = gate.evaluate(safe_lead_request(
            content="Reach me at jane.doe@example.com or 555-987-6543, SSN 123-45-6789."
        ))
        blob = json.dumps(d.to_dict())
        self.assertNotIn("jane.doe@example.com", blob)
        self.assertNotIn("555-987-6543", blob)
        self.assertNotIn("123-45-6789", blob)
        # Lead PII fields masked too.
        self.assertNotIn("Jordan Lee", blob)
        self.assertNotIn("555-123-4567", blob)


class ChannelTests(unittest.TestCase):
    def test_sandbox_channel_allowed(self) -> None:
        self.assertIsNone(gate.classify_channel("sandbox_sms"))
        self.assertIsNone(gate.classify_channel("simulator"))

    def test_live_channel_blocks(self) -> None:
        for ch in ("sms", "email", "voice", "whatsapp"):
            d = gate.evaluate(safe_lead_request(channel=ch))
            self.assertEqual(d.decision, Decision.BLOCK, msg=ch)
            self.assertIn(ReasonCode.LIVE_CHANNEL, d.reasons)

    def test_unknown_channel_blocks(self) -> None:
        d = gate.evaluate(safe_lead_request(channel="pigeon"))
        self.assertEqual(d.decision, Decision.BLOCK)
        self.assertIn(ReasonCode.UNKNOWN_CHANNEL, d.reasons)


class EvaluateVerdictTests(unittest.TestCase):
    def setUp(self) -> None:
        gate.reset_hold_store()

    def test_consent_missing_blocks(self) -> None:
        d = gate.evaluate(safe_lead_request(consent={}))
        self.assertEqual(d.decision, Decision.BLOCK)
        self.assertIn(ReasonCode.CONSENT_MISSING, d.reasons)
        self.assertFalse(d.safe_to_send)

    def test_finance_requires_approval(self) -> None:
        d = gate.evaluate(safe_lead_request(content="We can finance the rest with low credit."))
        self.assertEqual(d.decision, Decision.REQUIRE_APPROVAL)
        self.assertIsNotNone(d.hold_token)
        self.assertTrue(any(a.blocking for a in d.approvals_required))
        self.assertFalse(d.safe_to_send)

    def test_trade_in_requires_approval(self) -> None:
        d = gate.evaluate(safe_lead_request(content="Bring your trade-in for an appraisal."))
        self.assertEqual(d.decision, Decision.REQUIRE_APPROVAL)
        self.assertIn(ReasonCode.TRADE_IN_CLAIM, d.reasons)

    def test_safe_fixture_lead_allows(self) -> None:
        d = gate.evaluate(safe_lead_request())
        self.assertEqual(d.decision, Decision.ALLOW)
        self.assertTrue(d.safe_to_send)
        self.assertIsNone(d.hold_token)

    def test_block_dominates_but_retains_approval_reasons(self) -> None:
        # Live channel (BLOCK) + finance (APPROVAL) -> BLOCK, both reasons kept.
        d = gate.evaluate(safe_lead_request(channel="sms", content="We can finance it."))
        self.assertEqual(d.decision, Decision.BLOCK)
        self.assertIn(ReasonCode.LIVE_CHANNEL, d.reasons)
        self.assertIn(ReasonCode.FINANCE_CLAIM, d.reasons)

    def test_appointment_intent_requires_approval(self) -> None:
        d = gate.evaluate({
            "request_id": "req-appt-1",
            "channel": "sandbox_sms",
            "intent": "book_appointment",
            "lead": {"name": "Sam"},
        })
        self.assertEqual(d.decision, Decision.REQUIRE_APPROVAL)
        self.assertIn(ReasonCode.APPOINTMENT_WRITE_NEEDS_APPROVAL, d.reasons)

    def test_crm_writeback_requires_approval(self) -> None:
        d = gate.evaluate({
            "request_id": "req-crm-1",
            "channel": "sandbox",
            "intent": "crm_writeback",
            "lead": {"name": "Sam"},
        })
        self.assertEqual(d.decision, Decision.REQUIRE_APPROVAL)
        self.assertIn(ReasonCode.CRM_WRITEBACK_NEEDS_APPROVAL, d.reasons)

    def test_appointment_policy_can_disable_approval(self) -> None:
        d = gate.evaluate({
            "request_id": "req-appt-2",
            "channel": "sandbox_sms",
            "intent": "book_appointment",
            "policy": {"require_approval_for_appointment": False},
        })
        self.assertEqual(d.decision, Decision.ALLOW)

    def test_missing_request_id_blocks(self) -> None:
        d = gate.evaluate(safe_lead_request(request_id=""))
        self.assertEqual(d.decision, Decision.BLOCK)
        self.assertIn(ReasonCode.MISSING_FIELD, d.reasons)


class OperatorFlowTests(unittest.TestCase):
    def setUp(self) -> None:
        gate.reset_hold_store()

    def test_approved_path_resolves_to_allow(self) -> None:
        held = gate.evaluate(safe_lead_request(content="We can finance the balance."))
        self.assertEqual(held.decision, Decision.REQUIRE_APPROVAL)
        resolved = gate.apply_operator_decision(OperatorDecision(
            hold_token=held.hold_token, operator_id="op-1", action="approve", note="ok"))
        self.assertEqual(resolved.decision, Decision.ALLOW)
        self.assertTrue(resolved.safe_to_send)
        self.assertTrue(resolved.audit)
        self.assertEqual(resolved.audit[0]["operator_id"], "op-1")

    def test_reject_path_blocks(self) -> None:
        held = gate.evaluate(safe_lead_request(content="We can finance the balance."))
        resolved = gate.apply_operator_decision(OperatorDecision(
            hold_token=held.hold_token, operator_id="op-1", action="reject", note="no"))
        self.assertEqual(resolved.decision, Decision.BLOCK)
        self.assertIn(ReasonCode.POLICY_OVERRIDE, resolved.reasons)
        self.assertFalse(resolved.safe_to_send)

    def test_idempotent_reapply(self) -> None:
        held = gate.evaluate(safe_lead_request(content="We can finance the balance."))
        op = OperatorDecision(hold_token=held.hold_token, operator_id="op-1", action="approve")
        first = gate.apply_operator_decision(op)
        second = gate.apply_operator_decision(op)
        self.assertEqual(first.decision, second.decision)
        self.assertEqual(second.decision, Decision.ALLOW)

    def test_unknown_token_fails_closed(self) -> None:
        resolved = gate.apply_operator_decision(OperatorDecision(
            hold_token="does-not-exist", operator_id="op-1", action="approve"))
        self.assertEqual(resolved.decision, Decision.BLOCK)

    def test_approve_cannot_release_hard_block(self) -> None:
        # Force a hold that also carries a hard block, then try to approve it.
        # Appointment intent on a live channel: appointment -> REQUIRE_APPROVAL
        # path stores a hold, but live channel is a hard block.
        held = gate.evaluate({
            "request_id": "req-mixed-1",
            "channel": "sandbox_sms",
            "intent": "book_appointment",
            "content": "We can finance it.",
            "consent": {"sms": True},
        })
        self.assertEqual(held.decision, Decision.REQUIRE_APPROVAL)
        # Re-point the stored snapshot's channel to a live one to simulate the
        # request becoming unsafe before release.
        entry = gate._load_hold(held.hold_token)
        entry["request"].channel = "sms"
        resolved = gate.apply_operator_decision(OperatorDecision(
            hold_token=held.hold_token, operator_id="op-1", action="approve"))
        self.assertEqual(resolved.decision, Decision.BLOCK)
        self.assertFalse(resolved.safe_to_send)
        self.assertIn(ReasonCode.LIVE_CHANNEL, resolved.reasons)


class SchemaShapeTests(unittest.TestCase):
    def test_decision_to_dict_keys(self) -> None:
        d = gate.evaluate(safe_lead_request())
        out = d.to_dict()
        for key in gate.DECISION_SCHEMA:
            self.assertIn(key, out)
        # Enums serialize as their string values.
        self.assertEqual(out["decision"], "ALLOW")
        self.assertIsInstance(out["reasons"], list)

    def test_operator_packet_is_redacted(self) -> None:
        held = gate.evaluate(safe_lead_request(
            content="finance offer; email jane.doe@example.com"))
        packet = gate.to_operator_packet(held)
        blob = json.dumps(packet.to_dict())
        self.assertNotIn("jane.doe@example.com", blob)
        self.assertIn(held.hold_token, blob)


class CliTests(unittest.TestCase):
    def _run(self, *args: str) -> dict:
        proc = subprocess.run(
            [sys.executable, str(HERE / "w2_compliance_gate.py"), *args],
            capture_output=True, text=True, check=True,
        )
        return json.loads(proc.stdout)

    def test_cli_evaluate_require_approval(self) -> None:
        payload = json.dumps({
            "request_id": "cli-1", "channel": "sandbox_sms", "intent": "send_message",
            "content": "great APR on your trade-in", "consent": {"sms": True},
        })
        out = self._run("evaluate", "--json", payload)
        self.assertEqual(out["decision"], "REQUIRE_APPROVAL")

    def test_cli_evaluate_block_exit_zero(self) -> None:
        payload = json.dumps({
            "request_id": "cli-2", "channel": "sms", "intent": "send_message",
            "content": "hello", "consent": {"sms": True},
        })
        out = self._run("evaluate", "--json", payload)
        self.assertEqual(out["decision"], "BLOCK")
        self.assertIn("LIVE_CHANNEL", out["reasons"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
