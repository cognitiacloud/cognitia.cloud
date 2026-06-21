"""Client Zero proof loop — runnable demo (SANDBOX ONLY, offline).

LANE: Client Zero = the dealership / Auto Growth OS proof workflow. This is the
primary Sales Closer proof path. This file holds the dealership lane ONLY — the
MoverOS lane lives in `tenant_zero_moveros_demo.py`. Do not mix the two lanes'
refs, claims, or fixtures in this file.

It walks one Client Zero action end-to-end through the shared economy primitive:

    action -> proof event -> verification -> escrow release -> reputation delta

It is the executable twin of docs/cognitia/agent-economy/04-client-zero-proof-loop.md.

Run:
    python -m sandbox.agent_economy.client_zero_demo
"""

from __future__ import annotations

from sandbox.agent_economy.economy_sandbox import AgentPassport
from sandbox.agent_economy.proof_loop import SANDBOX_NOTE, print_header, run_scenario


def main() -> None:
    print_header("CLIENT ZERO — Dealership / Auto Growth OS proof workflow")
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
    print(f"\n{SANDBOX_NOTE}")
    print("LANE NOTE: this is the Client Zero (dealership) lane only. "
          "The parallel MoverOS lane runs separately via "
          "`python -m sandbox.agent_economy.tenant_zero_moveros_demo`.")


if __name__ == "__main__":
    main()
