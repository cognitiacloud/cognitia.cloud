# Agent Economy Sandbox (simulation only)

> **This is a sandbox.** Everything here runs in memory. There is **no token, no
> liquidity, no exchange listing, no blockchain, no network, and no database.**
> "Credits" are **non-redeemable internal accounting units** used to demonstrate
> the agent-economy loop. They are not money and carry no investment value.

A self-contained, standard-library-only simulation of Cognitia's internal agent
economy. It exists to make the design in
[`docs/cognitia/agent-economy/`](../../docs/cognitia/agent-economy/) concrete and
testable.

## What it proves

The full loop, end to end, with the core invariants enforced in code:

```
action  ->  proof event  ->  verification  ->  escrow release  ->  reputation delta
```

- **Credit ledger** — double-entry, internal-rail-locked, idempotent
  (`CreditLedger`, mirrors `credits_ledger`).
- **Proof registry** — append-only proof events tagged
  `verified_fact | likely_inference | unknown`; corrections supersede, never
  mutate (`ProofRegistry`, mirrors `proofs`).
- **Action ledger** — append-only, idempotency-keyed, versioned event types
  (`ActionLedger`, mirrors `audit_events`).
- **Reputation** — a positive delta is applied **only** against a `verified_fact`
  proof (`Reputation`, mirrors `reputation_events`).
- **Work order + escrow** — escrow releases **only** against a `verified_fact`
  proof; rejection refunds the payer (`EconomyEngine`, mirrors `work_orders`).
- **Agent passport** — minimal internal identity (`AgentPassport`, mirrors
  `agent_trust_credentials`); internal refs only, no PII, no crypto suites.
- **Guardrails** — `assert_no_public_token_surface()` trips loudly if any
  public-token / external-value flag is ever set.

> The table names above are **aligned to sibling-branch vocabulary and are not
> verified in this branch HEAD.** They are mirrored here in memory only.

## Run

Each client lane has its **own** demo (kept separate so artifacts never mix); both
reuse the same lane-neutral engine and runner:

```bash
# From the repository root.

# Client Zero — dealership / Auto Growth OS lane (primary Sales Closer proof path)
python -m sandbox.agent_economy.client_zero_demo

# Tenant Zero / MoverOS — parallel moving-company lane (sandbox scenario)
python -m sandbox.agent_economy.tenant_zero_moveros_demo

# Invariant tests (stdlib unittest, lane-neutral engine).
python -m unittest discover -s sandbox/agent_economy -p 'test_*.py' -v
```

### Lane naming (exact)

- **Client Zero = dealership / Auto Growth OS.** Primary Sales Closer proof path.
- **MoverOS = parallel moving-company lane.** Labeled **Tenant Zero / MoverOS** as a
  sandbox/demo (as here), or **Client One / MoverOS** only if promoted to a real
  pilot (not done here). **MoverOS is never "Client Zero."**

Both lanes reuse the same primitives (`economy_sandbox.py` + `proof_loop.py`) but
keep their files, refs, claims, and customer language separate. No live outreach,
SMS/calls, ads, vendor calls, or real prospect data — synthetic refs only.

## Files

| File | Purpose |
|------|---------|
| `economy_sandbox.py` | Lane-neutral in-memory engine: ledger, proofs, actions, reputation, escrow, passports, guardrails |
| `proof_loop.py` | Lane-neutral runner for the shared proof loop (used by both lane demos) |
| `client_zero_demo.py` | **Client Zero (dealership / Auto Growth OS) lane only** |
| `tenant_zero_moveros_demo.py` | **Tenant Zero / MoverOS lane only** |
| `test_economy_sandbox.py` | Invariant tests (verified_fact gating, escrow, idempotency, guardrails) |
| `requirements.txt` | Intentionally empty — stdlib only |
