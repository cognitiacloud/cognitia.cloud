# FINDINGS_LEDGER — 12H Sprint

Consolidated findings with evidence status + severity. Statuses:
`verified_fact | likely_inference | aspirational | unknown | unsafe_overclaim |
recommended`. Severity: P0–P3.

| ID | Finding | Status | Sev | Source |
| -- | ------- | ------ | --- | ------ |
| F-1 | Cognitia's diligence edge is reproducible engineering (490 tests on 2 backends, append-only proofs, runtime smoke) | verified_fact | P2 | repo, VF-1..7 |
| F-2 | Cognitia's primitives (ATC/SkillProof/Proof/Reputation/Credits/Escrow/Marketplace/Disputes) map cleanly to the agent-economy narrative + ERC-8004/x402/VC | likely_inference | P2 | LANE_B/Q |
| F-3 | Token-first, product-thin design is the dominant AI-crypto failure mode; Cognitia is the inverse | likely_inference | P2 | LANE_P |
| F-4 | Biggest researcher red flags Cognitia must address: anonymous team, no external audit, no public reproducible proof feed live, no third-party attestation | likely_inference | P1 | LANE_C/M |
| F-5 | "Decentralized / impossible to shut down" is an unsafe overclaim Cognitia must never make | unsafe_overclaim | P0 | guardrails, LANE_J/R |
| F-6 | Distributed agent fabric is feasible by composition (mesh + capability registry + router + signed receipts); novelty = proof-backed economics | likely_inference | P2 | LANE_N, fabric docs |
| F-7 | Highest-leverage visibility move = public-safe researcher pack, not new product | recommended | P1 | LANE_L, VISIBILITY_GAP_ANALYSIS |
| F-8 | Future token's only honest utility = assurance collateral (bond/slash), legal+usage gated | likely_inference | P1 | TOKEN_LAB_002, LANE_D |
| F-9 | RLS-on-managed-Postgres verification is the most credibility-moving open technical item | verified_fact (gap) | P1 | VF-14, U-2 |
| F-10 | Resilience/sovereignty thesis must be sober (user-owned compute, portable work) — never an evasion pitch | recommended | P1 | LANE_R |

(Updated as lanes complete; see per-lane files for detail.)
