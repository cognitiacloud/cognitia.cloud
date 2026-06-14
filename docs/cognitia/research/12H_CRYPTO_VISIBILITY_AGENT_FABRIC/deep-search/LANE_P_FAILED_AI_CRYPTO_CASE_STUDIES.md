# LANE P — Failed / Scammy AI-Crypto Case Studies (what they did wrong)

**Objective**: Failure patterns to avoid, from documented scams and collapses.

**Sources (WebSearch)**: Motley Fool "beware the AI crypto scam" (2026); TRM Labs
(AI scaling crypto fraud); chainup.com AI fraud threats 2026; North Dakota
Securities alert; yellow.com "top 10 AI crypto scams 2025"; Medium "Fake AI, Real
Losses" (a ~$14M SEC fraud using fake AI signals); CBS/Moneywise victim reports.

## Failure patterns (abstracted)
- `verified_fact` (reported) — **Fake-AI "bot returns"**: free tokens / fake
  profit dashboards → real deposits drained (OpenClaw-style wallet-drain pages;
  ~$14M SEC fraud using fabricated AI signals).
- `likely_inference` — **Token-first, product-thin**: ChatGPT-era "AI" tokens that
  were pump-and-dumps with no working product.
- `likely_inference` — **Anonymous teams + treasury control + no audit** → rug.
- `likely_inference` — **Yield/APY bait + "get in early"** marketing → securities
  + consumer-protection exposure and eventual collapse.
- `likely_inference` — **Unverifiable claims** (no code, no repro, screenshots only).

## The anti-pattern checklist (what Cognitia must NEVER do)
1. Promise returns / profits / APY / passive income.
2. Sell a token or run a presale/public sale.
3. Show fake dashboards or fabricated metrics/proofs.
4. Hide the team while controlling a treasury.
5. Claim audited/SOC2/decentralized/production without proof.
6. Use "next Ethereum/Solana," "get in early," "to the moon."
7. Custody user funds without licensing.

## Relevance to Cognitia
Every failure pattern maps to an existing Cognitia guardrail. The defensive moat
is *doing the opposite, verifiably*. The one residual exposure (anonymous team) is
the same as a known scam signal — strengthening the case for a team page (D-4).

## Recommended actions
- Encode the anti-pattern checklist into `UNSAFE_LANGUAGE_BLACKLIST.md` (LOOP 4)
  and keep the doctrine guard tests enforcing it in `apps/web`.

## Unsafe claims to avoid
This entire lane IS the list of claims to avoid. Treat it as canonical.
