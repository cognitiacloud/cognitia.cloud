"""Client Zero proof loop — runnable demo (SANDBOX ONLY, offline).

Client Zero is the dealership / Auto Growth OS proof workflow. This script walks
one Client Zero action end-to-end through the internal agent economy:

    action -> proof event -> verification -> escrow release -> reputation delta

It is the executable twin of docs/cognitia/agent-economy/04-client-zero-proof-loop.md.

A separate Tenant Zero / MoverOS pilot scenario is included only to show the same
loop generalizes; it does NOT redefine Client Zero.

Run:
    python -m sandbox.agent_economy.client_zero_demo
"""

from __future__ import annotations

from sandbox.agent_economy.economy_sandbox import (
    AgentPassport,
    EconomyEngine,
    assert_no_public_token_surface,
)


def _print_header(title: str) -> None:
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
    """Run the full proof loop for one tenant + agent and print the trace."""
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


def main() -> None:
    _print_header("CLIENT ZERO — Dealership / Auto Growth OS proof workflow")
    dealership_agent = AgentPassport(
        agent_ref="agent:lead-rescue",
        display_name="Auto Growth OS Lead-Rescue Agent",
        capabilities=("lead_followup", "appointment_booking"),
        atc_ref="atc:internal:lead-rescue:v1",
    )
    run_scenario(
        tenant_ref="tenant:dealership-zero",
        tenant_label="Client Zero — Dealership (Auto Growth OS)",
        agent=dealership_agent,
        verifier_ref="verifier:appointment-confirmed",
        work_claim="re-engage a stale sales lead and book a confirmed appointment",
        amount=20,
    )

    print("\n")
    _print_header("TENANT ZERO / MoverOS — pilot scenario (same loop, not Client Zero)")
    moveros_agent = AgentPassport(
        agent_ref="agent:front-desk",
        display_name="MoverOS AI Front Desk Agent",
        capabilities=("lead_rescue", "quote_followup"),
        atc_ref="atc:internal:front-desk:v1",
    )
    run_scenario(
        tenant_ref="tenant:moveros",
        tenant_label="Tenant Zero — MoverOS (AI Front Desk)",
        agent=moveros_agent,
        verifier_ref="verifier:booking-confirmed",
        work_claim="rescue a missed moving-quote lead and confirm a booking",
        amount=15,
    )

    print("\nSANDBOX NOTE: credits are non-redeemable internal accounting units. "
          "No token, no liquidity, no chain, no network. Simulation only.")


if __name__ == "__main__":
    main()
