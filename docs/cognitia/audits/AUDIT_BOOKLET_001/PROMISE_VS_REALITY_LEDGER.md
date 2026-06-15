# PROMISE VS REALITY LEDGER — AUDIT-BOOKLET-001

Repo scan for risky/major claim terms across `apps/` + `docs/cognitia/public/`.
**Finding: every risky term on a public/app surface appears as a negation, a
status disclosure, or an explicit "what we do not claim" — no affirmative unsafe
claim was found.** `did:cognitia` / "agent passport" appear in **no** code
(doctrine-guarded).

## Term-by-term (public/app surfaces)

| Term                                                         | Where it appears                           | Form                                                   | Safe?                |
| ------------------------------------------------------------ | ------------------------------------------ | ------------------------------------------------------ | -------------------- |
| production-ready                                             | `/trust` FAQ; CLAIMS doc; threat model     | "Not production-deployed / not production-ready"       | ✅ safe negation     |
| SOC 2 / certified                                            | `/trust`; CLAIMS; risk register            | "not SOC 2 certified; no certification claim"          | ✅ safe negation     |
| decentralized                                                | CLAIMS; governance; threat model           | "not decentralized in production"                      | ✅ safe negation     |
| unstoppable / cannot be shut down / uncensorable             | CLAIMS; threat model                       | listed as claims we refuse                             | ✅ safe negation     |
| token launched / public token                                | `/trust`; TOKEN_STATUS; many               | "No public token exists; may never launch"             | ✅ safe negation     |
| liquidity / DEX / staking / yield / annual-yield             | `/trust` gate table; crypto-readiness page | status rows = "No" / "placeholders only"               | ✅ status disclosure |
| price / returns / get-in-early / moon / next Ethereum/Solana | —                                          | not present (affirmative); negated in CLAIMS/blacklist | ✅                   |
| pre-sale / public sale / exchange-listing                    | CLAIMS; TOKEN_STATUS                       | "no pre-sale, no public sale, no exchange-listing"     | ✅ safe negation     |
| real payments / wallet transfers / mainnet                   | `/trust`; CLAIMS                           | "no real payments; no token transfers; no mainnet"     | ✅ safe negation     |
| guaranteed                                                   | —                                          | not present                                            | ✅                   |
| Agent Passport / did:cognitia                                | none in code                               | absent (guard-enforced)                                | ✅                   |

Representative evidence (`apps/web/src/app/trust/page.tsx`): "No public token
exists.", "Not SOC 2 certified; not production-deployed.", "No liquidity, no DEX,
no staking or yield product.", "Token may never launch." Crypto-readiness page:
"placeholders only … any public token, liquidity, staking, exchange, or payment
execution [is gated]".

## What we CAN safely say (verified)

- Cognitia is a proof-backed trust + agent-economy platform, **runtime-verified
  locally/dev** (515 tests; live PGlite economy smoke).
- Append-only proofs; only `verified_fact` moves value/reputation; tenant
  isolation via RLS + redundant predicates (tested in code).
- **No public token, no sale, no real payments**; internal credits only.
- An honest, public diligence pack (researcher pack, threat model, governance,
  risk register, "claims we do not make").

## What we must NOT say yet (unsafe_overclaim until proven)

Production-ready · enterprise-grade · SOC 2 certified · audited · decentralized
in production · uncensorable / unstoppable / cannot be shut down · any token
launch / sale / price / return / yield / annual-yield / "get-in-early" · ERC-8004
"compliant"/"live on mainnet" · managed-RLS "verified" (until the V-6 run) ·
any pilot/traction/revenue number without evidence.
