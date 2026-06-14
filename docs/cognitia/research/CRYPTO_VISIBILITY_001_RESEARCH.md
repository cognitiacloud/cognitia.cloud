# CRYPTO-VISIBILITY-001 — Research Synthesis

Date: 2026-06-14. Framing: **diligence-readiness** (founder-selected). Purpose:
understand how serious crypto researchers and investors evaluate early
projects, and how the AI-agent/crypto narrative is forming, so Cognitia can
be made honestly **evaluable on fundamentals** — NOT to market a token (there
is none; all eight `TOKEN_GATES` remain NOT PASSED). No price/return language,
no DEX/liquidity/staking/yield marketing.

Evidence tags: `verified_fact` = directly stated in a cited source;
`likely_inference` = synthesized across sources. Claims about Cognitia itself
live in the companion `CRYPTO_VISIBILITY_001_CRITERIA_MAP.md`.

## Source status

| Stream                                             | Method    | Status                     |
| -------------------------------------------------- | --------- | -------------------------- |
| 1. Early-project ("gem") discovery frameworks      | WebSearch | covered                    |
| 2. Researcher / VC diligence criteria              | WebSearch | covered                    |
| 3. AI-agent crypto tailwinds + standards           | WebSearch | covered                    |
| 4. Red flags / anti-criteria                       | WebSearch | covered                    |
| 5. Supplied YouTube video (`youtu.be/JbnZ4AzZ2ik`) | WebFetch  | **NOT FETCHED — see note** |

> **Video note (honest):** the supplied URL could not be retrieved. Every
> route returned HTTP 403 in this environment — the YouTube watch page,
> YouTube oEmbed, noembed, the r.jina.ai reader proxy, and a third-party
> transcript service. WebFetch egress appears broadly blocked here; WebSearch
> works. The video's content is therefore **not represented** below and was
> **not fabricated**. To fold it in, paste the transcript or the key
> points/title and I will reconcile it against the criteria taxonomy (the
> taxonomy already covers what "how I find crypto gems"-type videos typically
> assert, so additions are likely confirmatory).

## Stream 1 — Early-project discovery framework (the "five checks")

A consistent five-part checklist appears across 2025 "spot early gems"
guides — **builders, usage, liquidity, token design, security** — explicitly
to avoid "exit-liquidity" traps (`verified_fact`, Cointelegraph / Moongems):

- **Builders / team** — public core contributors with a track record; real,
  ongoing GitHub commits/PRs/deliverables, not marketing.
- **Usage** — cross-checked against independent sources (Messari, Token
  Terminal); favor paid use + retention + take-rate rising together; be wary
  of usage that evaporates when incentives stop ("vanity stats", reward-
  chasing TVL).
- **Liquidity** — order-book depth and consistent spreads matter more than
  raw volume (which wash-trades fake); concentration in one pool/venue is a
  red flag (Kaiko-style depth analysis).
- **Token design** — clear, gradual unlock schedules with defined community/
  liquidity budgets; not vague reallocatable "ecosystem" pools.
- **Security** — an audit only counts if you know who/what/when and whether
  findings were resolved; check upgradeability and who holds that authority.

## Stream 2 — Researcher / VC diligence criteria

Institutional diligence pattern-matches to conventional startup rigor plus
crypto-specific scrutiny (`verified_fact`, Alumni Ventures / TokenMinds /
CoinFabrik / Medium TDD guide):

- **Team & execution** — consistent, multi-developer commit history; a
  pre-fundraise activity spike then silence is a red flag.
- **Traction beats narrative** — real user growth, retention, engagement,
  revenue signals, credible pilots/partnerships; for protocols: active
  wallets, transaction volume, ecosystem liquidity.
- **Defensibility & technology** — proprietary tech, network effects, high
  switching costs, differentiation.
- **Tokenomics & economic sustainability** — vesting, emissions, distribution
  scrutinized hardest by trading/market-making-background funds.
- **Technical due diligence** — architecture, security, docs, feasibility.
- **Compliance & regulatory readiness** — rated a top-critical factor
  alongside team credibility.

## Stream 3 — AI-agent crypto tailwinds + emerging standards

The agent-economy narrative now has concrete standards (`verified_fact`,
bitcoin.com / ChainUp / KuCoin / coinedition):

- **ERC-8004 "Trustless Agents"** — an Ethereum standard (proposed Aug 2025;
  reference deployments on mainnet ~late Jan 2026) giving autonomous agents a
  decentralized **identity + reputation + optional third-party validation**,
  letting agents **publish capabilities on-chain and accumulate reputation
  signals** instead of relying on curated directories — "trust becomes
  programmable."
- **x402** — revives HTTP 402 "Payment Required" so agents pay for resources
  instantly (machine-to-machine commerce). Pairing: "ERC-8004 is the ID,
  x402 is the wallet."
- **Market framing** — agentic commerce cited at ~$8B transaction value in
  2026, with large long-range projections; ~130k ERC-8004 agents projected
  across chains by 2026 (`likely_inference` on the exact figures — vendor
  blog projections, treat as directional, not as fact).

This stream is the most strategically load-bearing: Cognitia's existing
primitives (Agent Trust Credential, Proof Registry, SkillProof, Reputation,
internal credits/escrow, marketplace) are a private, evidence-disciplined
implementation of exactly the identity + reputation + validation + agent-
payment surface these standards are standardizing. The Architecture Lock
already names ERC-8004 / EAS / x402 as the future-compatibility targets.

## Stream 4 — Red flags / anti-criteria (what credible projects avoid)

Cross-source red flags (`verified_fact`, Cointelegraph / MOSS / Zipmex /
CoinLaw): anonymous/vanishing teams; guaranteed/steady-return promises;
no audit or locked/closed code with unclear upgrade authority; faked volume;
concentrated token holdings; no/short liquidity lock; unverifiable claims;
withdrawal friction. The structured-checklist approach (verify code, check
liquidity + allocation, confirm audits, validate team identity) is the
researcher norm.

Notably, several of these anti-criteria are things Cognitia's **doctrine
already enforces by construction** — evidence-tagged claims (no unverifiable
assertions), no price/return language (doctrine guards), no premature token
(internal credits only, gates NOT PASSED), append-only auditable records.
That is the core of the diligence-readiness thesis in the companion docs.

## Sources

- [How to Spot Early Crypto Gems in 2025 — Cointelegraph](https://cointelegraph.com/news/early-crypto-gems-how-to-discover-them-first)
- [How to Spot Hidden Gems in 2025 — Moongems](https://www.moongems.io/blog/how-to-spot-hidden-gems-in-2025-step-by-step-guide-crypto-investors)
- [Evaluating Web3 Startups: 7 Key Factors — Alumni Ventures](https://www.av.vc/blog/cme-evaluating-web3-startups-7-key-factors-every-investor-must-know)
- [Crypto Due Diligence Framework — TokenMinds](https://tokenminds.co/blog/crypto-due-diligence)
- [The VC's Guide to Technical Due Diligence on Web3 Startups — Medium](https://medium.com/@theillusionservices/the-vcs-guide-to-technical-due-diligence-on-web3-startups-3abab1796ee9)
- [Web3 Technical Due Diligence — CoinFabrik](https://www.coinfabrik.com/services/web3-technical-due-diligence/)
- [What Is ERC-8004? — Bitcoin.com News](https://news.bitcoin.com/what-is-erc-8004-ethereums-new-agent-standard-powers-thousands-of-onchain-ai-identities/)
- [x402 & ERC-8004: How AI Agents Pay on the Agentic Web — ChainUp](https://www.chainup.com/blog/x402-erc8004-ai-agent-payments-agentic-web/)
- [Understanding ERC-8004 — KuCoin](https://www.kucoin.com/blog/understanding-erc-8004-on-chain-identity-standard-for-ai-agents)
- [Ethereum Introduces ERC-8004 — Coin Edition](https://coinedition.com/ethereum-introduces-erc-8004-standard-for-ai-agent-identity-and-reputation-systems/)
- [How to Spot a Crypto Scam: 10 Red Flags — Cointelegraph](https://cointelegraph.com/news/how-to-spot-a-fake-crypto-investment-platform-10-red-flags)
- [15 Red Flags — MOSS](https://moss.sh/news/how-to-identify-crypto-scams-15-red-flags-to-watch-for/)
- [15 Red Flags & Protection Guide 2026 — Zipmex](https://zipmex.com/blog/how-to-spot-a-crypto-scam-15-red-flags-protection-guide-2026/)

Source caution: most are practitioner blogs/media, not peer-reviewed; market
sizing figures are vendor projections (`likely_inference`). The _criteria_
recur consistently enough across independent sources to treat the taxonomy
itself as reliable; the _numbers_ should not be quoted as fact.
