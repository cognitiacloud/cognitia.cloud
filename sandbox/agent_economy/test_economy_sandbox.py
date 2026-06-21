"""Invariant tests for the agent-economy sandbox (stdlib unittest, offline).

Run:
    python -m unittest discover -s sandbox/agent_economy -p 'test_*.py' -v
"""

import unittest

from sandbox.agent_economy.economy_sandbox import (
    AgentPassport,
    CreditLedger,
    EconomyEngine,
    EvidenceTag,
    GuardrailViolation,
    ProofRegistry,
    Reputation,
    WorkOrderState,
    assert_no_public_token_surface,
)


def _agent(ref="agent:a"):
    return AgentPassport(
        agent_ref=ref,
        display_name="Test Agent",
        capabilities=("work",),
        atc_ref=f"atc:{ref}",
    )


class GuardrailTests(unittest.TestCase):
    def test_default_guardrails_pass(self):
        # Default sandbox config has no public-token surface.
        assert_no_public_token_surface()

    def test_public_token_flag_trips_guardrail(self):
        with self.assertRaises(GuardrailViolation):
            assert_no_public_token_surface({"public_token": True})

    def test_each_external_surface_trips(self):
        for flag in ("liquidity_pool", "exchange_listing",
                     "external_redeemable", "external_transfer",
                     "chain_deployment"):
            with self.subTest(flag=flag):
                with self.assertRaises(GuardrailViolation):
                    assert_no_public_token_surface({flag: True})


class LedgerTests(unittest.TestCase):
    def setUp(self):
        self.ledger = CreditLedger()
        self.ledger.open_account("system:mint", "system")
        self.ledger.open_account("tenant:x", "tenant")
        self.ledger.open_account("agent:a", "agent")

    def test_double_entry_conserves_credits(self):
        self.ledger.post("system:mint", "tenant:x", 50, "grant:x")
        self.ledger.post("tenant:x", "agent:a", 20, "pay:1")
        self.assertEqual(self.ledger.balance("tenant:x"), 30)
        self.assertEqual(self.ledger.balance("agent:a"), 20)
        self.assertTrue(self.ledger.is_balanced())

    def test_idempotency_key_dedupes(self):
        self.ledger.post("system:mint", "tenant:x", 50, "grant:x")
        e1 = self.ledger.post("tenant:x", "agent:a", 10, "pay:dup")
        e2 = self.ledger.post("tenant:x", "agent:a", 10, "pay:dup")
        self.assertIs(e1, e2)
        self.assertEqual(self.ledger.balance("agent:a"), 10)  # applied once

    def test_insufficient_credits_rejected(self):
        from sandbox.agent_economy.economy_sandbox import LedgerError
        with self.assertRaises(LedgerError):
            self.ledger.post("tenant:x", "agent:a", 999, "pay:over")

    def test_off_rail_account_trips_guardrail(self):
        self.ledger._accounts["tenant:x"].rail = "external"
        with self.assertRaises(GuardrailViolation):
            self.ledger.post("system:mint", "tenant:x", 5, "grant:bad")


class ReputationTests(unittest.TestCase):
    def setUp(self):
        self.registry = ProofRegistry()
        self.rep = Reputation(self.registry)

    def test_no_gain_without_verified_fact(self):
        for tag in (EvidenceTag.LIKELY_INFERENCE, EvidenceTag.UNKNOWN):
            with self.subTest(tag=tag):
                p = self.registry.record("s", "claim", tag, "ref")
                applied = self.rep.apply("agent:a", +1, p.proof_id, "r")
                self.assertFalse(applied)
        self.assertEqual(self.rep.score("agent:a"), 0)

    def test_gain_with_verified_fact(self):
        p = self.registry.record(
            "s", "claim", EvidenceTag.VERIFIED_FACT, "ref", verifier_ref="v"
        )
        self.assertTrue(self.rep.apply("agent:a", +1, p.proof_id, "r"))
        self.assertEqual(self.rep.score("agent:a"), 1)

    def test_negative_delta_allowed_without_verified_fact(self):
        # Penalties don't require a verified_fact proof.
        p = self.registry.record("s", "claim", EvidenceTag.UNKNOWN, "ref")
        self.assertTrue(self.rep.apply("agent:a", -1, p.proof_id, "penalty"))
        self.assertEqual(self.rep.score("agent:a"), -1)


class ProofRegistryTests(unittest.TestCase):
    def test_events_are_immutable(self):
        reg = ProofRegistry()
        p = reg.record("s", "claim", EvidenceTag.UNKNOWN, "ref")
        with self.assertRaises(Exception):
            p.claim = "tampered"  # frozen dataclass

    def test_supersession_appends_not_mutates(self):
        reg = ProofRegistry()
        p1 = reg.record("s", "claim", EvidenceTag.LIKELY_INFERENCE, "ref")
        p2 = reg.record(
            "s", "verified", EvidenceTag.VERIFIED_FACT, "ref2",
            verifier_ref="v", supersedes=p1.proof_id,
        )
        self.assertEqual(len(reg.all()), 2)
        self.assertEqual(p2.supersedes, p1.proof_id)


class WorkOrderLoopTests(unittest.TestCase):
    def setUp(self):
        self.eng = EconomyEngine()
        self.eng.register_agent(_agent("agent:a"))
        self.eng.fund_tenant("tenant:x", 100)

    def test_happy_path_releases_escrow_and_reputation(self):
        o = self.eng.propose("tenant:x", "agent:a", 30)
        self.eng.accept(o.order_id)
        self.assertEqual(self.eng.ledger.balance(self.eng.ESCROW), 30)
        self.eng.deliver(o.order_id, "ref")
        self.eng.verify(o.order_id, "verifier:v", ok=True)
        self.assertEqual(self.eng.order(o.order_id).state, WorkOrderState.VERIFIED)
        self.assertEqual(self.eng.ledger.balance("agent:a"), 30)
        self.assertEqual(self.eng.ledger.balance(self.eng.ESCROW), 0)
        self.assertEqual(self.eng.reputation.score("agent:a"), 1)
        self.assertTrue(self.eng.ledger.is_balanced())

    def test_rejected_refunds_escrow_no_reputation(self):
        o = self.eng.propose("tenant:x", "agent:a", 30)
        self.eng.accept(o.order_id)
        self.eng.deliver(o.order_id, "ref")
        self.eng.verify(o.order_id, "verifier:v", ok=False)
        self.assertEqual(self.eng.order(o.order_id).state, WorkOrderState.REJECTED)
        self.assertEqual(self.eng.ledger.balance("agent:a"), 0)
        self.assertEqual(self.eng.ledger.balance("tenant:x"), 100)  # refunded
        self.assertEqual(self.eng.reputation.score("agent:a"), 0)

    def test_escrow_release_requires_verified_fact_proof(self):
        # The verified branch records exactly one verified_fact proof and only
        # then releases escrow; the delivery proof alone never releases funds.
        o = self.eng.propose("tenant:x", "agent:a", 30)
        self.eng.accept(o.order_id)
        delivery = self.eng.deliver(o.order_id, "ref")
        self.assertNotEqual(delivery.evidence_tag, EvidenceTag.VERIFIED_FACT)
        self.assertEqual(self.eng.ledger.balance("agent:a"), 0)  # not released yet
        self.eng.verify(o.order_id, "verifier:v", ok=True)
        released = self.eng.proofs.all()[-1]
        self.assertEqual(released.evidence_tag, EvidenceTag.VERIFIED_FACT)
        self.assertEqual(self.eng.ledger.balance("agent:a"), 30)

    def test_action_ledger_is_append_only_and_versioned(self):
        o = self.eng.propose("tenant:x", "agent:a", 30)
        self.eng.accept(o.order_id)
        self.eng.deliver(o.order_id, "ref")
        self.eng.verify(o.order_id, "verifier:v", ok=True)
        types = [a.event_type for a in self.eng.actions.all()]
        self.assertIn("economy.work_order.verified.v1", types)
        for t in types:
            self.assertTrue(t.endswith(".v1"), f"event type not versioned: {t}")


if __name__ == "__main__":
    unittest.main()
