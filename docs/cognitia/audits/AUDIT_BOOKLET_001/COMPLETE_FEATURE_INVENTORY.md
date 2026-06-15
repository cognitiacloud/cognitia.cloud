# COMPLETE FEATURE INVENTORY — AUDIT-BOOKLET-001

Evidence-tagged inventory of every Cognitia feature on mainline (`313a82d`).
Status legend: **built** (code present), **runtime_verified** (exercised by a
live/PGlite or unit test), **docs_only**, **design_only**, **blocked**,
**parked**. "built" is never claimed without a code/migration/route/test anchor.

## Core Trust Layer

| Feature                       | Status           | Anchors                                                         | Public-safe claim / caveat                                                                                     |
| ----------------------------- | ---------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Agent Trust Credential (ATC)  | runtime_verified | mig 0009; `apps/api/src/atc.ts`; contract test (COG-004)        | VC-style identity (issuer/subject/claims/status); revocation terminal. Internal issuer; no external anchoring. |
| Proof Registry                | runtime_verified | mig 0009; `apps/api/src/proofs.ts`; contract (COG-003)          | Append-only, evidence-tagged; private bodies never public.                                                     |
| Evidence tags / verified_fact | runtime_verified | 0009 CHECK; reputation/escrow triggers; smoke                   | Only `verified_fact` moves value/reputation.                                                                   |
| PII redaction / public_safe   | runtime_verified | 0009 `proofs_public_requires_redaction`; redaction scanner test | public_safe requires a passed redaction check.                                                                 |
| SkillProof                    | runtime_verified | mig 0010/0013; `skillproof.test.ts`                             | Tiers; tier ≥2 needs verified_fact; yanked versions blocked.                                                   |
| Reputation                    | runtime_verified | mig 0010; `reputation.test.ts`; smoke                           | Append-only; positive only vs verified_fact; aggregate-only in public.                                         |
| Wallet placeholders           | built            | mig 0012/0014; `CREDITS_AND_WALLET_PLACEHOLDERS.md`             | Placeholder bindings only; no chain activity, no transfers.                                                    |

## Agent Economy Layer

| Feature                       | Status           | Anchors                                                      | Caveat                                                                        |
| ----------------------------- | ---------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Work Orders                   | runtime_verified | mig 0016; `agentEconomy.ts`; smoke                           | Governed lifecycle; terminal states enforced.                                 |
| Credits ledger                | runtime_verified | mig 0012; `credits.ts`; contract (COG-009)                   | Double-entry, append-only; non-transferable; not money.                       |
| Escrow simulation             | runtime_verified | mig 0016 trigger; smoke                                      | Reserve once; release ONLY on verified_fact.                                  |
| Dispute resolution            | runtime_verified | mig 0017; `disputeResolution.test.ts`                        | Owner-arbitrated release/refund/split + resolution proof.                     |
| Agent Action Ledger proposals | runtime_verified | `agentEconomyActions.ts`; `agentEconomyAgentActions.test.ts` | Agent proposes; human approves; operator executes. Verify/dispute stay human. |
| Internal Marketplace          | runtime_verified | mig 0018; `marketplace.ts`; contract (004)                   | Internal-visibility check-locked; no public market.                           |
| Tier-aware matching           | runtime_verified | `marketplace.ts`; tests                                      | Ranks by SkillProof tier + reputation.                                        |

## Public Diligence Surfaces

| Feature                                                           | Status                    | Anchors                                                     |
| ----------------------------------------------------------------- | ------------------------- | ----------------------------------------------------------- |
| `/trust` explorer                                                 | runtime_verified (static) | `apps/web/src/app/trust/page.tsx`; `trust.test.ts`          |
| `/trust/live` feed view                                           | built                     | `trust/live/page.tsx`; `trust-live.test.ts`                 |
| `GET /public/trust-feed`                                          | runtime_verified          | `handlers.ts` `publicTrustFeed`; `publicTrustFeed*.test.ts` |
| Public evidence manifest                                          | docs_only (spec)          | `public/PUBLIC_EVIDENCE_MANIFEST_SPEC.md`                   |
| Researcher Pack / Verify-It-Yourself / Review Order / Entrypoints | docs_only                 | `public/*.md`; `researcherPack.guard.test.ts`               |
| SECURITY.md                                                       | docs_only                 | repo root                                                   |
| Claims We Do Not Make                                             | docs_only                 | `public/CLAIMS_WE_DO_NOT_MAKE.md`                           |
| API & Surfaces                                                    | docs_only                 | `public/API_AND_SURFACES.md`; `apiSurfaces.guard.test.ts`   |
| Threat Model / Governance / Trust Boundaries / Risk Register      | docs_only                 | `public/*.md`; `threatGovernance.guard.test.ts`             |
| Public Diligence Overview                                         | docs_only                 | `docs/cognitia/PUBLIC_DILIGENCE_OVERVIEW.md`                |
| Curated static proof samples                                      | built                     | `trust/curated-proofs.ts`; `curated-proofs.test.ts`         |

## Crypto / Token Architecture (all internal, gated)

| Item                                  | Status           | Anchor                                                     |
| ------------------------------------- | ---------------- | ---------------------------------------------------------- |
| Token thesis / utility map            | docs_only        | `crypto/TOKEN_UTILITY_MAP.md`, `TOKEN_LAB_001_INTERNAL.md` |
| Token architecture spec               | docs_only        | `crypto/TOKEN_LAB_002_ARCHITECTURE_INTERNAL.md`            |
| Token gates                           | docs_only        | `crypto/TOKEN_GATES.md` (all NOT PASSED)                   |
| Credits/stablecoin/token split        | docs_only        | TOKEN_LAB_002                                              |
| Assurance-collateral thesis           | docs_only        | TOKEN_LAB_002; TOKEN_STATUS_AND_GATES                      |
| Comms guardrails                      | built (enforced) | `doctrine.guard.test.ts` + public docs                     |
| Contract sandbox plan (TOKEN-LAB-003) | parked           | not started; founder+counsel gated                         |
| What is NOT launched                  | verified_fact    | no token/coin/sale/DEX/staking route exists (route scan)   |

## Cross-tenant / Standards / Future

| Item                                                   | Status                                                          | Anchor                                                  |
| ------------------------------------------------------ | --------------------------------------------------------------- | ------------------------------------------------------- |
| Cross-tenant settlement design                         | design_only                                                     | `agent-economy/CROSS_TENANT_SETTLEMENT_DESIGN.md`       |
| Reputation portability                                 | design_only                                                     | same                                                    |
| Standards alignment (MCP/A2A/W3C VC/EAS/ERC-8004/x402) | design_only / compatibility-target                              | `public/STANDARDS_ALIGNMENT.md`                         |
| Distributed Agent Fabric                               | design_only on main; **pending PR #69** builds a simulation lab | `research/distributed-agent-fabric/`; PR #69 not merged |

## Runtime / Testing

- **ECONOMY-SMOKE-001**: `apps/api/src/economySmoke.live.test.ts` (live PGlite) +
  `execution/ECONOMY_SMOKE_001_*` docs. Proves the full economy loop against a
  real Postgres engine. Does NOT prove production readiness or managed-RLS under a
  restricted role (engine runs as superuser, bypassing RLS).
- KyselyRepository (PGlite) + InMemoryRepository run the **same** contract.

## Parked / Deferred / Blocked

COG-016 (parked branch, no PR) + migration 0015 (reserved/absent); TOKEN-LAB-003
(not started); real token contracts / real payments / token transfers (none);
production deploy (none); managed-Postgres RLS verification (blocked on dev DB);
public token / public marketplace transactions (none); distributed agent fabric
(design-only on main; simulation lab pending in #69).

## GTM lane note

GTM/MoverOS pages (`/moveros`, `/moveros/front-desk`) + Mira CRM action lifecycle
exist on main and are runtime-verified (CRM action tests). Older GTM PRs (#44/#45)
are **separate and not merged**; their claims are NOT imported here.
