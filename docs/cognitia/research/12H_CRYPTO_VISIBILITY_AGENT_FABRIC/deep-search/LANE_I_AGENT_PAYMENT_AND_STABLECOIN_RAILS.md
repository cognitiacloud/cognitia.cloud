# LANE I — Agent Payment & Stablecoin Rails

**Objective**: How agent-to-agent payments work today (x402, stablecoins, Base/EVM)
and how Cognitia should relate to them.

**Sources (WebSearch)**: x402.org + ecosystem; chainup.com, eco.com, cobo.com
(x402 explainers); base.org; arXiv 2507.19550 (A2A + x402 micropayments);
arXiv 2603.01179 (A402 binding payment to service execution).

## Findings

- `verified_fact` (well-corroborated) — **x402** uses HTTP 402 to let an agent pay
  for a resource inline; facilitators settle (often stablecoins on Base/EVM).
- `likely_inference` — Research is actively trying to **bind payment to verified
  service execution** (e.g. "A402"), i.e. don't release payment unless the work is
  proven — which is _exactly_ Cognitia's escrow-releases-only-on-verified_fact model.
- `verified_fact` — Cognitia today settles in **internal credits only**, no real
  payments, no token transfers (by design + guardrail).

## Relevance to Cognitia

Cognitia's escrow + verified*fact release is the trust complement to x402's
payment rail: x402 moves money; Cognitia proves the work that \_should* trigger the
move. A future, gated **x402 sandbox adapter** could map "verified_fact proof →
payment release" without Cognitia ever custodying funds.

## Gaps

- No x402 adapter (design-only, gated).
- No stablecoin settlement (intentionally out of scope; legal-gated).

## Recommended actions

- Design-only `x402 sandbox adapter` spec (LOOP 5/6): proof → payment-release
  signal; sandbox/testnet only; no mainnet, no custody.

## Public-safe wording

"Cognitia settles internally in non-transferable credits today. A future, gated
design could let a verified_fact proof trigger an external payment rail (e.g.
x402) without Cognitia holding funds."

## Unsafe claims to avoid

No "live payments," no custody claims, no stablecoin yield, no mainnet settlement.
