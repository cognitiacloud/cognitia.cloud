# CRYPTO-VISIBILITY-001 — Diligence-Readiness Roadmap

Date: 2026-06-14. Future-ready feature/doc roadmap to make Cognitia honestly
**evaluable** against the criteria in `CRYPTO_VISIBILITY_001_CRITERIA_MAP.md`.
Every item closes a mapped GAP or strengthens a verifiable strength. **None of
this is started by this ticket** (research/docs sprint only). Hard guardrails
on every item: no public token launch, no price/return language, no
DEX/liquidity/staking/yield marketing, no production deploys without founder
go, evidence tags on all claims, doctrine guards stay green.

Each item: criterion closed · type · gate.

## Now (cheap, high-trust, no new product surface)

| #   | Item                                                                                                                                                                      | Closes           | Type                    | Gate                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ----------------------- | ------------------------- |
| V-1 | **Public-safe diligence overview** (`docs/cognitia/PUBLIC_DILIGENCE_OVERVIEW.md`) — what Cognitia is, the verifiable primitives, the evidence model, the no-token posture | C, D, H, I       | docs (DONE this ticket) | none                      |
| V-2 | **Public team/contributor page** content (founder + named contributors, outside-verifiable links) — drafted as doc first, no web page until founder approves              | A (team)         | docs → web (gated)      | founder identity sign-off |
| V-3 | **Standards-alignment one-pager** mapping ATC/Proof/SkillProof/Reputation → ERC-8004 identity/reputation/validation + x402, citing the Architecture Lock compat targets   | H, defensibility | docs                    | none                      |

## Next (makes fundamentals externally checkable)

| #    | Item                                                                                                                                                                                                       | Closes                | Type                       | Gate                                                  |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- | -------------------------- | ----------------------------------------------------- |
| V-4  | ~~**Public-safe Trust/Proof explorer**~~ **DONE** — — read-only view of `public_safe` (redaction-passed) proofs + agent reputation snapshots; zero PII, zero internal details                              | B, E, H (validation)  | build (web, read-only)     | redaction-scan in the write path (exists); founder go |
| V-4b | ~~Live public proof feed (`/trust/live`, `/public/trust-feed`)~~ **DONE** — unauthenticated read-only; deny-by-default; public projection + aggregate reputation                                           | B, E, H               | build (web+api, read-only) | none (publish needs COGNITIA_PUBLIC_TENANT_ID)        |
| V-5  | **External security audit** of the trust surfaces + (later) any contract code; publish who/what/when/findings-resolved                                                                                     | E (security)          | external + docs            | founder budget                                        |
| V-6  | **Managed-Postgres RLS verification** run (`MANAGED_POSTGRES_RLS_VERIFICATION_PLAN.md`) — closes the last runtime-assurance gap (engine-level RLS under a restricted role)                                 | E (upgrade/isolation) | runtime                    | dev `DATABASE_URL` (founder)                          |
| V-7  | **Verifiable track-record export** — signed, evidence-tagged summary of completed verified work orders + outcomes (the "real usage, cross-checkable" signal) once Tenant Zero / pilots produce real volume | B (traction)          | build                      | production usage exists                               |

## Later (gated; standards + economy maturation)

| #    | Item                                                                                                                                                                                                 | Closes                 | Type            | Gate                                         |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | --------------- | -------------------------------------------- |
| V-8  | **ERC-8004 / EAS compatibility spike** (testnet only) — anchor `public_safe` proof projections + ATC ids as attestations using the reserved `external_attestation_ref`; prove external verifiability | H, defensibility       | build (testnet) | TOKEN_LAB_002 §4 S1 gate (founder + counsel) |
| V-9  | **x402-style agent-payment adapter (sandbox)** — external settlement of CLEARED balances only, never per-work-order escrow, never customer-facing                                                    | H, D                   | build (sandbox) | legal gate; cleared-balance design (005)     |
| V-10 | **Cross-tenant clearing implementation** (0019+) — turns the network-effects/defensibility design into reality; multi-tenant gate's technical half                                                   | C (network effects), H | build           | founder go (per 005 §9)                      |
| V-11 | **Assurance-collateral (bonding) on internal credits** — verifier/publisher/worker/dispute bonds, credits-first, no yield                                                                            | D, E                   | build           | TOKEN_LAB_002 §2; founder go                 |

## Sequencing logic

V-1…V-3 cost nothing but documentation and immediately raise diligence
legibility on the criteria researchers weight most (team, tech, evidence,
restraint). V-4…V-7 convert internal verifiable facts into _externally_
checkable surfaces — the single biggest gap between "strong fundamentals" and
"a researcher can confirm them." V-8…V-11 mature the standards alignment and
economy, each strictly behind its existing gate. Nothing here introduces
price/return language, a public token, or a DEX/liquidity/staking/yield
surface — diligence-readiness is achieved by **more verifiable evidence**, not
by marketing.

## Explicit non-goals (restated)

No public token/coin page; no token sale, presale, or listing language; no
price targets or return projections; no DEX/liquidity/staking/yield product
or marketing; no production deploy or production migration without founder go.
The token, if it ever exists, stays behind all eight `TOKEN_GATES`.
