# Standards Alignment

How Cognitia's primitives relate to emerging agent standards. **Read the status
column carefully**: most alignment is _designed-for-compatibility_, not built.
Nothing here claims a live integration or certification. Each external/current
claim is either sourced or marked "needs verification before public use."

## Status legend

- **built (internal)** — implemented and tested in this repo.
- **designed for compatibility** — the internal model is shaped to map onto the
  standard; no integration built.
- **research target** — under design study only.
- **blocked / future** — gated; not started.

## Alignment table

| Standard                               | What it is                                                   | Cognitia mapping                                                                     | Status                                                               |
| -------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| **MCP** (Model Context Protocol)       | open model↔tool/context protocol                             | agent tool/skill invocation surface; future fabric tool routing                      | designed for compatibility                                           |
| **A2A** (Agent-to-Agent)               | cross-agent interop protocol                                 | work-order handoff between agents/tenants                                            | research target                                                      |
| **W3C Verifiable Credentials 2.0**     | issuer/subject/claims/status credentials                     | ATC is VC-shaped (issuer/subject/claims/status; revocation terminal)                 | built (internal) shape; external issuance designed for compatibility |
| **EAS** (Ethereum Attestation Service) | on/off-chain attestations                                    | external anchoring of public-safe proofs via the reserved `external_attestation_ref` | research target                                                      |
| **ERC-8004** ("Trustless Agents")      | on-chain agent identity + reputation + validation registries | ATC (identity), Reputation, Proof Registry (validation) map to the registry roles    | designed for compatibility                                           |
| **x402**                               | HTTP-402 agent payments                                      | future payment-on-`verified_fact` adapter (sandbox), no custody                      | blocked / future                                                     |
| **Base / EVM**                         | settlement chain optionality                                 | possible external settlement venue if a legal-gated token/payment step ever exists   | blocked / future                                                     |

## Important honesty notes

- ERC-8004 is an emerging standard; public reporting describes a 2025 publication
  and a 2026 mainnet milestone — **needs verification before public use** if cited
  as fact. Cognitia does **not** claim to be "ERC-8004 compliant" or "live on
  mainnet."
- x402 is described as an HTTP-402-based agent-payment pattern with reported
  large transaction volumes — figures are third-party and **need verification
  before public use**.
- "Designed for compatibility" means the internal data shapes were chosen to map
  cleanly onto these standards. It does **not** mean an adapter exists.

## Why this matters

Standards alignment is a credibility signal _and_ a real interoperability benefit,
but only if stated honestly. Cognitia's position: compatible-by-design today,
external anchoring (EAS / ERC-8004 / x402) as gated, design-only future work — see
`docs/cognitia/research/distributed-agent-fabric/` and the crypto-visibility
research lanes.
