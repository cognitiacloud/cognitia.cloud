# Researcher Entrypoints

The canonical, public-safe index of where to start evaluating Cognitia. No token
sale, no investment language, no price/return claims. Everything here is either
reproducible or carries an explicit caveat.

## Start here

| Entry point               | What it is                                                   | Where                                                   |
| ------------------------- | ------------------------------------------------------------ | ------------------------------------------------------- |
| Trust / Proof Explorer    | static, read-only status surface                             | `/trust` route                                          |
| Security policy           | disclosure process, scope, secrets, caveats                  | `SECURITY.md` (repo root)                               |
| Researcher Pack           | single starting point (built/verified/design-only/blocked)   | `docs/cognitia/public/RESEARCHER_PACK.md`               |
| Verify It Yourself        | clone + `pnpm check` to reproduce evidence                   | `docs/cognitia/public/VERIFY_IT_YOURSELF.md`            |
| Token Status & Gates      | no public token; gates not passed                            | `docs/cognitia/public/TOKEN_STATUS_AND_GATES.md`        |
| Claims We Do Not Make     | honest self-limitation                                       | `docs/cognitia/public/CLAIMS_WE_DO_NOT_MAKE.md`         |
| Recommended Review Order  | the proof-trail path                                         | `docs/cognitia/public/RESEARCHER_REVIEW_ORDER.md`       |
| Standards Alignment       | MCP/A2A/VC/EAS/ERC-8004/x402 mapping (compatible-by-design)  | `docs/cognitia/public/STANDARDS_ALIGNMENT.md`           |
| API & Surfaces            | HTTP surfaces by area + auth model (no token/payment routes) | `docs/cognitia/public/API_AND_SURFACES.md`              |
| Threat Model              | assets, adversaries, mitigations, known gaps                 | `docs/cognitia/public/THREAT_MODEL.md`                  |
| Governance Posture        | founder/operator controlled; no DAO; no token governance     | `docs/cognitia/public/GOVERNANCE_POSTURE.md`            |
| Trust Boundaries          | what crosses (public projection) vs what never crosses       | `docs/cognitia/public/TRUST_BOUNDARIES.md`              |
| Public Risk Register      | known risks/gaps, status, mitigation, next step              | `docs/cognitia/public/RISK_REGISTER_PUBLIC.md`          |
| Public diligence overview | the platform + verifiable primitives                         | `docs/cognitia/PUBLIC_DILIGENCE_OVERVIEW.md`            |
| Evidence manifest spec    | the exact public-feed data contract                          | `docs/cognitia/public/PUBLIC_EVIDENCE_MANIFEST_SPEC.md` |

## How discovery is wired (so it is findable)

- The repo **README** has a "Trust & diligence" section linking the above.
- The **`/trust`** page has a static "Researcher resources" section + diligence
  metadata (title "Cognitia Trust & Proof").
- The **public diligence overview** and **researcher review order** cross-link
  the pack.

## Standing caveats (always visible)

- Not production-deployed; not SOC 2 certified; no external audit yet.
- Managed-Postgres RLS under a restricted role is **not yet verified** (plan exists).
- No public token exists; token gates remain **NOT PASSED**.
