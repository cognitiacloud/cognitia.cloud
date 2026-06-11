# INTERNAL — LEGAL-GATED

# Crypto Readiness (Internal Summary)

Cognitia's crypto layer is designed-for-later. Current implementation supports
internal credits, accounting primitives, and wallet binding placeholders only.
Any public token, liquidity, staking, exchange, or payment execution requires
legal review, real usage gates, and founder approval.

Status board (operator console): `/cognitia/crypto-readiness`
API: `GET /crypto-readiness`
Deep engineering/legal notes: `docs/cognitia/internal/CRYPTO_READINESS.md`

| Surface                                                                | Status                                                                                          |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Internal credits (append-only double-entry ledger)                     | live (internal only)                                                                            |
| Wallet bindings                                                        | inert placeholders; deactivation only — no activation                                           |
| Conceptual rails (card_stripe, usdc_base, usdt, future_cognitia_token) | designed-for-later / legal-gated; check-locked OFF at the database                              |
| Public token                                                           | disabled                                                                                        |
| Legal gate                                                             | not passed                                                                                      |
| Real payment execution                                                 | disabled                                                                                        |
| Base/EVM optionality                                                   | designed-for-later (`wallet_bindings.chain` enum reserved)                                      |
| x402 / EAS / ERC-8004                                                  | future integration references only (`external_ref` / `external_attestation_ref` anchor columns) |
| DEX or pool listings                                                   | none planned                                                                                    |
| Staking or reward programs                                             | none planned                                                                                    |
| Public token launch readiness                                          | none                                                                                            |

This document must never be published or linked from any public surface.
