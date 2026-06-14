# Unsafe Language Blacklist (LOOP 4)

Canonical list of phrases/claims Cognitia must never publish. Mirrors and extends
the doctrine guard (`packages/core/src/doctrine.guard.test.ts`), which already
fails the build if banned marketing literals or token/coin routes appear in
`apps/web`. This doc is the human-readable superset (docs + comms + web).

## Tier 0 — never, anywhere (financial-promotion / securities risk)
- "get in early", "presale", "public sale", "pre-sale", "ICO/IDO/IEO" (as our offer)
- "buy the token", "token sale is live", "mint now", purchase CTA of any kind
- "APY", "yield", "staking rewards", "passive income", "earn yield"
- "guaranteed return", "expected return", "price target", "% return", "to the moon"
- "next Ethereum", "next Solana", "next [bluechip]"
- any price, market cap, ticker, or listing claim (no token exists)

## Tier 1 — never as a claim of fact (overclaim)
- "decentralized and impossible to shut down" / "uncensorable" / "unstoppable"
- "production-ready" / "enterprise-grade" (until proven)
- "SOC 2 certified" / "audited" / "pentested" (until true, with report)
- "compliant" / "registered" / "approved" (legal conclusions)
- "ERC-8004 compliant / live on mainnet" (it's compatible-by-design, draft standard)
- "secure" / "unhackable"

## Tier 2 — never as resilience framing (legal/ethical)
- "evade government / sanctions / export controls"
- "operate where it's banned", "bypass restrictions", "unregulated AI"
- Resilience = continuity + user-owned compute + portability, NEVER evasion.

## Tier 3 — never fabricate
- on-chain data, holder counts, liquidity, TVL
- community/member/engagement metrics
- partnerships, backers, customers, revenue, pilots that don't exist
- transcripts, quotes, statistics (incl. the LOOP 1 video)

## Enforcement
- `apps/web`: doctrine guard test (build-failing) covers Tier-0 marketing literals
  + token/coin/staking/presale/airdrop routes.
- docs/comms: human review against this list; the V-4 `/trust` "what we do not
  claim" page is the public-facing version.
- Recommended (LOOP 8): consider extending a guard/test to scan docs for the most
  dangerous Tier-0/Tier-2 phrases as a tripwire (carefully, to avoid self-match).
