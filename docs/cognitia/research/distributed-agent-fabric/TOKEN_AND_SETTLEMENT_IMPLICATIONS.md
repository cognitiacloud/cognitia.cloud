# Token & Settlement Implications (design-only, gated)

## Settlement today (unchanged)

- The fabric settles in **internal credits** only: escrow holds a budget per work
  order; release on `verified_fact`; refund/split on dispute. Non-transferable
  outside the tenant ledger. **No real payments, no token transfers.**

## Why distribution _might_ later motivate a token (still gated)

A distributed fabric introduces **counterparties you don't control** (other users'
nodes, other tenants). In that setting, the honest economic problem is **assurance**:
how does a requester trust an unknown node, and how is bad/unsafe work penalized
beyond reputation?

- The credible answer is **assurance collateral**: a node/verifier/publisher posts
  a bond that is **slashed** for proven bad work (via disputes). Value that must be
  _at risk_ to mean something — which internal, non-transferable credits cannot
  honestly provide across trust boundaries.
- This is the SAME conclusion as `TOKEN_LAB_002`: a token's only honest utility is
  collateral-at-risk for verifiers/publishers/workers/arbiters.

## Gates (unchanged — all NOT PASSED)

A token remains behind every `TOKEN_GATES` gate: product, usage, multi-tenant,
legal, compliance, utility, security/audit, communications. **It may never launch.**
Cross-tenant _real_ settlement is itself gated (legal + AML).

## Design-only future spikes (no mainnet, sandbox only, gated)

- **Assurance-bond simulation** using internal credits (model bond/slash mechanics
  with NO token) — safe to prototype; teaches the mechanism without a token.
- **x402 sandbox adapter**: map `verified_fact` proof → external payment-release
  signal, sandbox/testnet only, Cognitia never custodies funds.
- **EAS attestation** of public-safe proofs (external anchoring of evidence).

## Hard "never"s

No mainnet contract; no DEX/liquidity/staking/yield; no price/return; no presale/
sale; no APY; no token transfers; no custody of user funds; no claim the token is
needed/valuable. Distribution does not unlock the token — only the gates do.

## Public-safe wording

"Fabric work settles in internal credits. Any future token would be assurance
collateral for cross-boundary trust, and only if every gate is passed."
