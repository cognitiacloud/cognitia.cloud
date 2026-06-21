# Cognitia Agent Economy — Internal Sandbox (Worker D)

This folder holds the design for improving Cognitia's **internal** agent economy
**without launching any public token**. It pairs six memos with a runnable,
offline simulation in [`sandbox/agent_economy/`](../../../sandbox/agent_economy/).

## Hard boundaries (apply to every document here)

- No public coin launch · no liquidity · no exchange listing
- No token-appreciation language · no investment claims
- No legal conclusions
- No real blockchain deployment (testnet only if explicitly approved — out of
  scope here)
- The sandbox makes **no network calls, no database writes, no chain calls**
- "Credits" are **non-redeemable internal accounting units**, not money

## Vocabulary caveat

These memos reference tables and concepts — `proofs`, `reputation_events`,
`credits_ledger`, `work_orders`, `audit_events`, `agent_trust_credentials` — that
are **aligned to sibling-branch vocabulary and are not verified in this branch
HEAD** (this checkout contains only the vision-skill). They are treated as
forward-compatible targets, not as migrations present in this branch.

## Terminology (two parallel client lanes)

- **Client Zero = the dealership / Auto Growth OS proof workflow.** The primary
  Sales Closer proof path. This is the canonical Client Zero and is **not**
  redefined here.
- **MoverOS = the parallel moving-company lane.** Label it:
  - **"Tenant Zero / MoverOS"** when run as a **sandbox/demo** (how it is used in
    this repo today), or
  - **"Client One / MoverOS"** only if/when treated as a **real client pilot**
    (not done here; requires explicit approval).
  - **Never call MoverOS "Client Zero."**

Both lanes may reuse the same underlying primitives (lead intake → consent/
compliance gate → human approval → booking/writeback → proof report), but their
files, fixtures, refs, claims, and customer language are kept **separate**:
dealership artifacts under Client Zero paths, MoverOS artifacts under
MoverOS / Tenant Zero / Client One paths. No live outreach, SMS/calls, ads,
vendor calls, or real prospect data — everything here is offline simulation with
synthetic refs.

## Reading order

| # | Memo | Mission output |
|---|------|----------------|
| 1 | [`01-internal-credit-token-sandbox-memo.md`](01-internal-credit-token-sandbox-memo.md) | Internal credit/token sandbox memo |
| 2 | [`02-proof-event-schema-proposal.md`](02-proof-event-schema-proposal.md) | Proof event schema proposal |
| 3 | [`03-action-ledger-spec.md`](03-action-ledger-spec.md) | Action ledger spec (+ reputation, passport) |
| 4 | [`04-client-zero-proof-loop.md`](04-client-zero-proof-loop.md) | Client Zero proof loop |
| 5 | [`05-token-risk-language.md`](05-token-risk-language.md) | Token-risk language |
| 6 | [`06-deferred-until-revenue-and-proof.md`](06-deferred-until-revenue-and-proof.md) | What must wait until revenue/proof exists |

## Runnable twin

Each lane has its **own** demo (kept separate); both reuse the same neutral engine:

```bash
# Client Zero — dealership / Auto Growth OS lane
python -m sandbox.agent_economy.client_zero_demo

# Tenant Zero / MoverOS — parallel moving-company lane (sandbox)
python -m sandbox.agent_economy.tenant_zero_moveros_demo

# Shared invariant tests (lane-neutral engine)
python -m unittest discover -s sandbox/agent_economy -p 'test_*.py' -v
```

Memo #4 is the prose version of what the Client Zero demo prints.
