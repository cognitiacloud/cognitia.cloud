"""Lane-neutral proof-loop runner for the agent-economy sandbox (offline).

This module is deliberately **lane-neutral**: it knows nothing about any specific
client lane (Client Zero / dealership, Client One / Tenant Zero / MoverOS, etc.).
It only drives the shared economy primitive:

    action -> proof event -> verification -> escrow release -> reputation delta

Lane-specific demos (`client_zero_demo.py`, `tenant_zero_moveros_demo.py`) supply
their own labels, refs, and claim text and call `run_scenario` here. Keeping the
mechanics here — and the lane identity in the caller — is what lets the two lanes
reuse the same primitives without mixing their artifacts.

SANDBOX ONLY: no network, no DB, no chain. Credits are non-redeemable internal
accounting units. All refs are synthetic; no real prospect data, no live outreach.
"""

from __future__ import annotations

from sandbox.agent_economy.economy_sandbox import (
    AgentPassport,
    EconomyEngine,
    assert_no_public_token_surface,
)


def print_header(title: str) -> None:
    print("=" * 68)
    print(title)
    print("=" * 68)


def run_scenario(
    *,
    tenant_ref: str,
    tenant_label: str,
    agent: AgentPassport,
    verifier_ref: str,
    work_claim: str,
    amount: int,
) -> EconomyEngine:
    """Run the full proof loop for one tenant + agent and print the trace.

    Lane-neutral: the caller owns all naming (tenant_label, refs, work_claim).
    """
    eng = EconomyEngine()
    assert_no_public_token_surface()  # boundary holds before anything happens

    eng.register_agent(agent)
    eng.fund_tenant(tenant_ref, 100)

    print(f"\nTenant:   {tenant_label} ({tenant_ref})")
    print(f"Agent:    {agent.display_name} ({agent.agent_ref})")
    print(f"Work:     {work_claim}")
    print(f"Escrow:   {amount} internal credits (non-redeemable)\n")

    # 1. Propose + 2. Accept (escrow funded)
    order = eng.propose(tenant_ref, agent.agent_ref, amount)
    eng.accept(order.order_id)
    print(f"[1-2] {order.order_id} accepted; "
          f"escrow holds {eng.ledger.balance(eng.ESCROW)} credits")

    # 3. Deliver (unverified claim recorded as a proof event)
    claim_proof = eng.deliver(order.order_id, evidence_ref="internal://artifact/123")
    print(f"[3]   delivered; proof {claim_proof.proof_id} "
          f"tag={claim_proof.evidence_tag.value}")

    # 4. Verify (verified_fact proof -> escrow release -> reputation +1)
    eng.verify(order.order_id, verifier_ref, ok=True)
    verified = eng.proofs.all()[-1]
    print(f"[4]   verified; proof {verified.proof_id} "
          f"tag={verified.evidence_tag.value} "
          f"(supersedes {verified.supersedes})")

    print("\n--- result ---")
    print(f"agent credits:     {eng.ledger.balance(agent.agent_ref)}")
    print(f"tenant credits:    {eng.ledger.balance(tenant_ref)}")
    print(f"escrow credits:    {eng.ledger.balance(eng.ESCROW)}")
    print(f"agent reputation:  {eng.reputation.score(agent.agent_ref)}")
    print(f"ledger balanced:   {eng.ledger.is_balanced()}")

    print("\n--- proof events ---")
    for p in eng.proofs.all():
        print(f"  {p.proof_id}  {p.evidence_tag.value:17}  {p.claim}")

    print("\n--- action ledger ---")
    for a in eng.actions.all():
        print(f"  #{a.seq}  {a.event_type:38}  actor={a.actor_ref}")

    return eng


SANDBOX_NOTE = (
    "SANDBOX NOTE: credits are non-redeemable internal accounting units. "
    "No token, no liquidity, no chain, no network, no real prospect data, "
    "no live outreach. Simulation only."
)
