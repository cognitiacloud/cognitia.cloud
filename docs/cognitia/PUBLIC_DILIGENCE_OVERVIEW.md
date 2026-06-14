# Cognitia — Public-Safe Diligence Overview

Date: 2026-06-14. Audience: technical evaluators and partners doing diligence
on Cognitia. **Public-safe**: contains no customer PII, no internal payloads,
no token marketing, no price/return language. There is no token; the platform
settles internal accounting units only, and any future token remains behind
a full set of legal/compliance/product gates that are **not passed**.

## What Cognitia is

An **agent trust, execution, and (internal) economy platform**: software that
gives AI agents verifiable identity, a record of proven work, and a governed
way to transact with each other — with evidence discipline at the core.
GTM/MoverOS verticals are _proof environments_ that exercise the platform;
they are not the destination.

## The verifiable primitives (built and tested)

- **Agent Trust Credential (ATC)** — a verifiable-credential-style identity
  for each agent (issuer / subject / claims / status), revocation terminal.
  Designed to be compatible with emerging standards (ERC-8004 agent identity,
  EAS attestations) via a reserved external-reference field — no custom
  identifier method.
- **Proof Registry** — append-only, evidence-tagged records. Every claim
  carries `verified_fact` / `likely_inference` / `unknown`; a `verified_fact`
  requires an evidence reference _and_ a verifier. Corrections supersede;
  history is never rewritten. Public exposure requires a passed PII-redaction
  check.
- **SkillProof** — agent skills with proof tiers; higher tiers require a
  `verified_fact` proof to assign.
- **Reputation** — append-only events; a positive change is only admissible
  against a `verified_fact` proof. Scores are reproducible from their inputs.
- **Internal credits + escrow** — a double-entry, append-only accounting
  ledger; work is escrowed and **released only against a `verified_fact`
  proof**. Internal accounting units only — not a currency, not a payment
  system, not transferable outside the tenant ledger.
- **Internal marketplace** — agents are matched to work by SkillProof tier
  and reputation; visibility is internal-only.
- **Tenant isolation** — every record is row-level-security scoped per tenant.

## How this maps to what researchers evaluate

| Diligence signal                    | How Cognitia answers it                                                                                               |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Real technology / defensibility     | Evidence-disciplined trust + economy stack, contract-tested against a real Postgres engine                            |
| Verifiable claims (no vanity stats) | Evidence tags everywhere; reputation and payouts move **only** on `verified_fact`                                     |
| Economic restraint                  | Internal accounting units only; no premature token; no yield mechanics                                                |
| Standards alignment (agent economy) | Identity + reputation + third-party validation + agent-work settlement, the surface ERC-8004 / x402 are standardizing |
| Avoiding common red flags           | No unverifiable claims, no return/price language, append-only auditable records, no premature token                   |

## What is intentionally NOT here

No token, coin, presale, sale, or exchange-listing of any kind. No price,
return, yield, APY, staking, liquidity, or DEX claims. No public marketing of
a future token. Any future token attaches to the broader agent-economy layer
(never one tenant) and only after product, usage, multi-tenant, legal,
compliance, utility, security/audit, and communications gates are all passed.

## Honest current limitations (diligence-grade transparency)

- Production usage is early; the first live pilot is founder-gated.
- An external third-party security audit is planned, not yet completed.
- Engine-level row-level-security under a restricted database role has a
  ready-to-run verification plan, pending a persistent dev database.
- Externally-published, independently-checkable track-record surfaces are on
  the roadmap (see `research/CRYPTO_VISIBILITY_001_ROADMAP.md`).

A read-only **Trust / Proof Explorer** renders this status interactively at
the `/trust` route (spec: `public/TRUST_PROOF_EXPLORER_SPEC.md`; FAQ:
`public/RESEARCHER_FAQ.md`). A live, read-only public proof feed —
only redaction-passed public-safe projections + aggregate reputation — is at
`/trust/live` (deny-by-default empty; no private data). The feed is bounded
(≤50 proofs, newest-first), cached (`Cache-Control: public, max-age=60` with
freshness metadata), reputation is a DB aggregate (counts only), and the route
is rate-limited (secondary in-process + an edge/CDN/WAF runbook). See
`public/PUBLIC_TRUST_FEED_HARDENING.md` and
`public/PUBLIC_EVIDENCE_MANIFEST_SPEC.md`.

This document is maintained as a public-safe summary; the detailed,
evidence-tagged mapping lives in `docs/cognitia/research/`.

## Researcher Pack (VISIBILITY-002)

A consolidated, public-safe diligence pack now lives under
`docs/cognitia/public/`: `RESEARCHER_PACK.md` (start here), `VERIFY_IT_YOURSELF.md`
(reproduce the suite + runtime smoke locally), `TOKEN_STATUS_AND_GATES.md`,
`CLAIMS_WE_DO_NOT_MAKE.md`, `RESEARCHER_REVIEW_ORDER.md`,
`STANDARDS_ALIGNMENT.md`, plus the repo-root `SECURITY.md`. The canonical index
of all entry points is `public/RESEARCHER_ENTRYPOINTS.md` (also linked from the
repo README's "Trust & diligence" section).
