# LANE Q — Agent Standards (MCP, A2A, ERC-8004, W3C VC, EAS, x402)

**Objective**: The standards Cognitia should align to, and the exact mapping.

**Sources (WebSearch + established knowledge)**: ERC-8004 guides (kucoin,
quicknode, eco, cobo, coinedition); x402.org; base.org; arXiv 2507.19550 (A2A +
x402); MCP (modelcontextprotocol.io); W3C VC Data Model; EAS docs.

## Standards summary + Cognitia mapping

| Standard       | What it is                                                                           | Cognitia primitive it maps to                                        |
| -------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| **MCP**        | Open model↔tool/context protocol                                                     | Agent tool/skill invocation surface; fabric tool routing             |
| **A2A**        | Agent-to-agent interop (Linux Foundation)                                            | Work-order handoff between agents/tenants                            |
| **ERC-8004**   | On-chain agent identity + reputation + validation (draft; mainnet reported Jan 2026) | ATC (identity), Reputation, Proof Registry (validation)              |
| **W3C VC 2.0** | issuer/subject/claims/status credentials                                             | ATC is VC-shaped (issuer/subject/claims/status, revocation terminal) |
| **EAS**        | general on/off-chain attestations                                                    | external anchoring of public-safe proofs                             |
| **x402**       | HTTP-402 agent payments                                                              | future payment-on-verified_fact adapter (sandbox)                    |

## Findings

- `verified_fact` — Cognitia's ATC is already modeled as a verifiable-credential-
  style identity (issuer/subject/claims/status; revocation terminal), with a
  reserved external-reference field for standards anchoring (no custom DID method).
- `likely_inference` — The cleanest near-term alignment is **VC (identity shape)**
  - **EAS (attest public proofs)** + **ERC-8004 (map registries)** + **x402
    (payment-on-proof)** — all design-only, no mainnet.

## Relevance to Cognitia

Standards alignment is a major researcher signal _and_ a real interop benefit.
Cognitia is unusually well-positioned because its internal model already matches
the standards' shapes.

## Gaps

- Mapping is documented as intent, not demonstrated; no spike.

## Recommended actions

- LOOP 5/6: design-only `ERC-8004 mapping` + `EAS attestation` + `x402 adapter`
  specs. Explicitly "compatible-by-design," not "compliant/live."

## Public-safe wording

"Cognitia's identity/reputation/proof primitives are designed to map onto MCP,
A2A, ERC-8004, W3C VC, EAS, and x402. External anchoring is design-only and gated."

## Unsafe claims to avoid

No "ERC-8004 compliant/deployed," no "live on mainnet," no claim of ratified
standard status (ERC-8004 is a draft).
