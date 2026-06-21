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

## Terminology

- **Client Zero** = the **dealership / Auto Growth OS proof workflow**. This is
  the canonical Client Zero and is **not** redefined here.
- **Tenant Zero / MoverOS** = a separate pilot scenario (AI Front Desk). It is
  only ever labeled "Tenant Zero / MoverOS" and never stands in for Client Zero.

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

```bash
python -m sandbox.agent_economy.client_zero_demo
python -m unittest discover -s sandbox/agent_economy -p 'test_*.py' -v
```

Memo #4 is the prose version of what the demo prints.
