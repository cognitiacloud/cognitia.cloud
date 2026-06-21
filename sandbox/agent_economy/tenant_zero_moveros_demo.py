"""Tenant Zero / MoverOS proof loop — runnable demo (SANDBOX ONLY, offline).

LANE: MoverOS = the parallel moving-company lane. In this repo MoverOS is run as a
sandbox/demo scenario, so it is labeled "Tenant Zero / MoverOS". (If/when MoverOS
becomes a real client pilot, the canonical label is "Client One / MoverOS" — but
that promotion is not done here and requires explicit approval; nothing in this
file implies a live pilot.)

This file holds the MoverOS lane ONLY — the dealership lane lives in
`client_zero_demo.py`. Do not mix the two lanes' refs, claims, or fixtures here,
and never label MoverOS "Client Zero".

It walks one MoverOS action end-to-end through the SAME shared economy primitive
the dealership lane uses:

    action -> proof event -> verification -> escrow release -> reputation delta

Run:
    python -m sandbox.agent_economy.tenant_zero_moveros_demo
"""

from __future__ import annotations

from sandbox.agent_economy.economy_sandbox import AgentPassport
from sandbox.agent_economy.proof_loop import SANDBOX_NOTE, print_header, run_scenario


def main() -> None:
    print_header("TENANT ZERO / MoverOS — moving-company lane (sandbox scenario)")
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
    print(f"\n{SANDBOX_NOTE}")
    print("LANE NOTE: this is the Tenant Zero / MoverOS lane only — NOT Client "
          "Zero. The dealership lane runs separately via "
          "`python -m sandbox.agent_economy.client_zero_demo`.")


if __name__ == "__main__":
    main()
