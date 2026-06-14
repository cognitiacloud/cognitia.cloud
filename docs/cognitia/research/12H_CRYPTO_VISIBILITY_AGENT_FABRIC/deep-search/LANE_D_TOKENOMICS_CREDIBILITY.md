# LANE D — Tokenomics Credibility

**Objective**: What separates credible token design from scammy token design.

**Sources (WebSearch)**: trustswap.com, assuredefi.com (stealth rug pulls),
icogemhunters.com (ICO red flags), manimama.eu; corroborated by general practice
and the in-repo `TOKEN_LAB_002` spec.

## Credible vs scammy (consolidated)

| Credible                                     | Scammy                                       |
| -------------------------------------------- | -------------------------------------------- |
| Token exists because the protocol _needs_ it | Token-first, utility "later"                 |
| Modest team allocation + long vesting        | Insiders hold ≥50%; cliff dumps              |
| Transparent supply + emissions               | Hidden mint/owner functions                  |
| Utility = at-risk collateral / fees          | Utility = "staking rewards/APY" bait         |
| No price/return promises                     | "Get in early," "next X," guaranteed returns |
| Liquidity locked / no rug levers             | Unlocked liquidity, admin drain              |

## Findings

- `likely_inference` — The most credible token utility for a trust/work protocol
  is **assurance collateral** (bonding + slashing) for verifiers/publishers/
  workers/arbiters — value that must be _at risk_ to mean anything.
- `verified_fact` — Cognitia's internal **credits** are deliberately NOT a token:
  double-entry, append-only, non-transferable outside the tenant ledger. This is
  the honest "no token needed yet" position.
- `verified_fact` — All token gates in `TOKEN_GATES` are NOT PASSED; the token may
  never launch (optional by design).

## Relevance to Cognitia

Cognitia's tokenomics credibility comes from _restraint_: it has a working
internal economy with no token, and a documented, gated path where a token would
only ever be assurance collateral. This is the inverse of the scammy pattern.

## Recommended actions

- Keep the token gated; keep credits ≠ token language crisp in public docs.
- If/when a token is modeled publicly, lead with collateral-at-risk utility, supply
  transparency, and vesting — never yield/APY.

## Public-safe wording

"Any future Cognitia token would be assurance collateral that must be at risk —
not a yield product. It is legal- and usage-gated and may never launch."

## Unsafe claims to avoid

No APY/yield/passive-income/staking-rewards language; no supply/price promises.
