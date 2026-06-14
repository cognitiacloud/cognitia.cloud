# Diligence Surface Roadmap (LOOP 4)

Sequenced plan to raise Cognitia's researcher-facing credibility, cheapest +
safest first. All items are public-safe; none introduce token marketing.

## Phase 1 — Legible evidence (days; no founder gate)

- Researcher pack index + "verify it yourself" repro guide (spec done).
- Canonical narrative + compliance-posture note (credits ≠ money/token).
- Standards-mapping page (from LANE_Q), "compatible-by-design".
- Extend RESEARCHER_FAQ with the LANE_M hard-questions answers.
- Acceptance: an outsider can clone, reproduce 490 tests, and read a coherent,
  caveated story in <15 min.

## Phase 2 — Security legibility (days–weeks; partly founder-gated)

- SECURITY.md (threat model summary, secrets policy, responsible-disclosure intake).
- Publish the managed-Postgres RLS verification plan status prominently.
- Founder: default branch → `main` (D-7).
- Acceptance: a researcher can find the security posture + an honest gap list.

## Phase 3 — External validation (weeks; founder-gated)

- Managed-Postgres RLS verification run (V-6; needs dev DB).
- External pentest/audit (budget); publish summary when done.
- Team page / identity (D-4).
- Acceptance: at least one _third-party-verifiable_ signal (audit or named team).

## Phase 4 — Live, configured proof (weeks; founder-gated)

- Configure `COGNITIA_PUBLIC_TENANT_ID` with curated public-safe proofs, behind
  trustProxy + edge rate limits (V-5 plan).
- Acceptance: `/trust/live` shows real redaction-passed projections + aggregate
  reputation, reproducible against the repo.

## Phase 5 — Standards anchoring (design→sandbox; gated)

- ERC-8004 mapping + EAS attestation of public proofs + x402 sandbox adapter
  (design-only → sandbox; no mainnet).
- Acceptance: a demonstrable (sandbox) external anchor of a Cognitia proof.

## Guardrails on the whole roadmap

No token page/sale/price/return; no production/SOC2/audited claims until true;
no fabricated data; resilience framed as continuity, never evasion.
