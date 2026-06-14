# LANE N — Future-Ready Features

**Objective**: Features that would raise Cognitia's diligence score, ranked by
leverage vs. risk. (Design signals only; build decisions in LOOP 6.)

| Feature | Leverage | Risk | Notes |
| ------- | -------- | ---- | ----- |
| Public researcher pack (entry point) | HIGH | LOW | LOOP 4; converts internal rigor to legible evidence |
| "Verify it yourself" repro guide | HIGH | LOW | clone → 490 tests → smoke |
| Managed-Postgres RLS verification (V-6) | HIGH | LOW | closes the top technical gap; needs dev DB |
| Public SECURITY.md + disclosure intake | HIGH | LOW | researcher + B2B expectation |
| External audit / pentest | HIGH | MED | budget-gated |
| Team page (identity) | HIGH | LOW (founder choice) | biggest trust gap |
| ERC-8004 compatibility spike (design) | MED | LOW | standards alignment, no mainnet |
| EAS attestation of public proofs (design) | MED | LOW | external anchoring of evidence |
| x402 sandbox adapter (design) | MED | MED | payment-on-proof; sandbox only |
| Marketplace detail pages | MED | LOW | product depth |
| Work-order templates | MED | LOW | usability + more proofs |
| API/SDK docs | MED | LOW | integration legibility |
| Distributed agent fabric prototype plan | MED | MED | LOOP 5; design-only now |
| Assurance-bond simulation (internal) | MED | LOW | models token utility WITHOUT a token |

## Findings
- `recommended` — Sequence: researcher pack + repro guide + SECURITY.md (cheap,
  high) → V-6 RLS (needs dev DB) → audit + team page (founder-gated) → standards
  spikes (design) → fabric prototype.

## Unsafe claims to avoid
Designing a feature ≠ shipping it. Label everything design-only until built; never
imply a standards spike means "compliant/live."
