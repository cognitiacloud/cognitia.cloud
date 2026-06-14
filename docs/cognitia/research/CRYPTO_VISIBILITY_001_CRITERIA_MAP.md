# CRYPTO-VISIBILITY-001 — Criteria → Cognitia Map

Date: 2026-06-14. Maps every diligence criterion from
`CRYPTO_VISIBILITY_001_RESEARCH.md` to Cognitia's actual surface. Honest by
construction: `verified_fact` = built + tested on `main` (cite the
migration/test); `likely_inference` = designed but not built; `unknown` /
**GAP** = not present yet → becomes a roadmap item. No token marketing, no
price/return language. There is no token; internal credits only; all
`TOKEN_GATES` NOT PASSED.

## A. Team & execution

| Criterion                                                          | Cognitia today                                                                                        | Tag                    |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ---------------------- |
| Real, multi-contributor commit history; deliverables not marketing | Merged economy stack #48→#55 + runtime smoke #56; 443/443 tests; documented execution logs per ticket | `verified_fact` (repo) |
| Public, named core team; outside-verifiable identities             | Founder-led; no public team page yet                                                                  | **GAP → roadmap**      |
| No pre-fundraise spike-then-silence pattern                        | Steady ticketed cadence (COG-001…, AGENT-ECONOMY-001…005, TOKEN-LAB-002, smoke)                       | `verified_fact`        |

## B. Traction & usage

| Criterion                                                        | Cognitia today                                                                                                              | Tag                |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Real usage, retention, engagement (not vanity/incentive-chasing) | Lab + GTM proof environments exist; **no production usage yet** (Tenant Zero pilot founder-gated)                           | **GAP → roadmap**  |
| Usage cross-checkable against independent sources                | Architecture produces evidence-tagged, append-only proofs designed to be externally checkable; not yet externally published | `likely_inference` |
| Take-rate / paid use rising with retention                       | Internal-credits escrow + verified outcomes model exists; no live revenue                                                   | **GAP → roadmap**  |

## C. Defensibility & technology

| Criterion                                                        | Cognitia today                                                                                                                                                  | Tag                                   |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| Proprietary tech / differentiation                               | Evidence-disciplined agent trust+economy: ATC, append-only Proof Registry with evidence tags, SkillProof tiers, verified_fact-gated reputation + escrow release | `verified_fact` (0009/0010/0012–0018) |
| Network effects / switching costs                                | Cross-tenant clearing + reputation-portability **designed** (CROSS_TENANT_SETTLEMENT_DESIGN)                                                                    | `likely_inference`                    |
| Technical due-diligence readiness (architecture, security, docs) | Architecture Lock, twin-repo contract tests on real Postgres (PGlite), extensive docs                                                                           | `verified_fact`                       |

## D. Tokenomics & economic design

| Criterion                                                             | Cognitia today                                                                                           | Tag                         |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------------------------- |
| Clear, gradual unlocks; defined budgets; no vague reallocatable pools | **No token exists**; settlement is internal credits (double-entry, append-only, rail-locked)             | `verified_fact` (0012)      |
| Economic sustainability scrutiny                                      | TOKEN_LAB_002: credits→stablecoin→token split; token = assurance collateral, **earns nothing**, no yield | `likely_inference` (design) |
| Distribution mechanics                                                | N/A until gates pass; deliberately undefined; no supply/tokenomics numbers published                     | `verified_fact` (posture)   |

## E. Security

| Criterion                                 | Cognitia today                                                                                                                     | Tag                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Who/what/when audited + findings resolved | DB-trigger + service + mirror invariants tested; **no external third-party security audit yet**                                    | **GAP → roadmap**                                                   |
| Upgrade authority clarity                 | Owner/operator RBAC; append-only proofs/ledger; RLS tenancy (engine-level RLS under restricted role still founder-gated to verify) | `verified_fact` (RBAC/append-only) / `unknown` (managed-PG RLS run) |

## F. Liquidity (token-market criterion)

| Criterion                                                      | Cognitia today                                                         | Tag                             |
| -------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------- |
| Order-book depth, no wash volume, no single-pool concentration | **Not applicable** — no token, no market, no DEX/liquidity by doctrine | `verified_fact` (N/A by design) |

## G. Compliance & regulatory readiness

| Criterion                     | Cognitia today                                                                                                                         | Tag                              |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Regulatory compliance posture | Legal gate (#4/#5) NOT PASSED and explicitly required before any token/stablecoin step; counsel work-packet drafted (TOKEN_LAB_002 §5) | `verified_fact` (gates)          |
| PII / data discipline         | RLS tenancy, encrypted lead PII, redaction-gated public proofs                                                                         | `verified_fact` (0003/0009/0011) |

## H. AI-agent standards alignment (the tailwind)

| Standard signal                     | Cognitia mapping                                                                                 | Tag                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| ERC-8004 agent **identity**         | Agent Trust Credential (ATC), VC-style, `external_ref` reserved for ERC-8004/EAS — no custom DID | `verified_fact` (0009) + `likely_inference` (external compat) |
| ERC-8004 **reputation** signals     | Reputation events, verified_fact-gated, reproducible snapshots                                   | `verified_fact` (0010)                                        |
| ERC-8004 **third-party validation** | SkillProof tiers requiring verified_fact proofs; Proof Registry verifier_ref                     | `verified_fact` (0010/0013)                                   |
| On-chain **capability publishing**  | Internal marketplace listings (tier-aware), internal-only today                                  | `verified_fact` (0018) + `likely_inference` (external)        |
| x402 **agent payments**             | Internal-credits escrow/clearing; external rails legal-gated, designed not built                 | `likely_inference` (TOKEN_LAB_002 §3)                         |
| EAS attestation anchoring           | `external_attestation_ref` column reserved; testnet trial is Stage S1 (gated)                    | `likely_inference`                                            |

## I. Anti-criteria (red flags Cognitia avoids by doctrine)

| Red flag                         | Cognitia counter                                                                 | Tag                                   |
| -------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------- |
| Unverifiable claims              | Evidence tags on every claim; verified_fact requires evidence_ref + verifier_ref | `verified_fact` (0009)                |
| Guaranteed/return language, hype | Doctrine guard tests fail the build on token-marketing phrases                   | `verified_fact` (doctrine.guard.test) |
| Premature token / exit liquidity | Internal credits only; 8 conjunctive gates NOT PASSED; bonds earn nothing        | `verified_fact`                       |
| Anonymous-then-vanish            | Append-only audit trail + ticketed execution record                              | `verified_fact`                       |
| Faked volume / vanity stats      | Reputation + escrow release move ONLY on verified_fact                           | `verified_fact` (0010/0016)           |

## Scorecard summary (honest)

- **Strong, verifiable today:** technology/defensibility, evidence discipline,
  AI-agent standards alignment (identity/reputation/validation), economic
  restraint (no premature token), anti-red-flag posture.
- **Designed, not built:** cross-tenant network effects, external rail/x402,
  token assurance-collateral model, EAS/ERC-8004 external anchoring.
- **Honest gaps → roadmap:** public team page, external security audit,
  production usage/traction, externally-published verifiable track record,
  managed-Postgres RLS proof.

The diligence-readiness thesis: Cognitia is unusually strong on the
_fundamentals serious researchers actually weight_ (team execution, real tech,
evidence, restraint) and is missing mostly the _public surfaces_ that make
those fundamentals externally checkable — which is exactly what the roadmap
(`CRYPTO_VISIBILITY_001_ROADMAP.md`) closes, without any token marketing.
