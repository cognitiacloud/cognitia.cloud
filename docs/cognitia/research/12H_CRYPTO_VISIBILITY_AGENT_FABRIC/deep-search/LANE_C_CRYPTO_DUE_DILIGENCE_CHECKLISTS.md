# LANE C — Crypto Due-Diligence Checklists

**Objective**: The consolidated checklist a serious researcher runs.

**Sources (WebSearch)**: crypto.com, trustswap.com, cryptorobotics.ai,
manimama.eu (DD for crypto projects 2026), assuredefi.com, icogemhunters.com.

## The checklist (consolidated) + Cognitia status
| Dimension | What researchers check | Cognitia status |
| --------- | ---------------------- | --------------- |
| Team | Named, credible, reachable; prior track record | **GAP** — not publicly named |
| Product | Working, reproducible, not a deck | **STRONG** — runtime-verified loop |
| GitHub | Active commits, tests, releases, PR history | **STRONG** — 490 tests, PR history |
| Docs | Architecture, API, security, risk pages | **STRONG/partial** — extensive internal + public-safe |
| Tokenomics | Necessity, supply, vesting, no insider dump | **N/A today** — no token; gates documented |
| Market/demand | Real users / revenue | **GAP** — no public traction evidence |
| Security | External audit, bounty, IR, secrets hygiene | **GAP** — no external audit yet |
| Legal | No investment promises; jurisdiction aware | **STRONG** — explicit restraint + gates |
| Community | Real, non-bot, technical | **GAP** — minimal public presence |
| On-chain | Distribution, liquidity locks, contract verify | **N/A** — no token/contract (do not fake) |

## Findings
- `likely_inference` — A fully anonymous team that controls treasury + no audit is
  the single biggest compound red flag; Cognitia avoids the treasury/token half
  but carries the anonymity half.
- `verified_fact` — Cognitia scores unusually well on product/GitHub/docs/legal —
  the dimensions hardest to fake.

## Recommended actions
- Close the four gaps in priority order: (1) team page (identity), (2) external
  audit (or at least a public pentest + bug-bounty intake), (3) live reproducible
  proof feed, (4) public traction once a pilot lands.

## Public-safe wording
"Cognitia is built to pass an engineering-first diligence checklist; the open
items (team page, external audit, live proof feed, traction) are tracked publicly."

## Unsafe claims to avoid
Do not claim audited/SOC2/production-ready; do not fabricate on-chain or community metrics.
