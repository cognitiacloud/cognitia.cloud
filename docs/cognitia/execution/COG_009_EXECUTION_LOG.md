# COG-009 — Execution Log

| #   | Step                                                                                                        | Result                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1   | Stack inspection + branch from cog-008 @ 9b50834                                                            | Case: #36 unmerged, green                                                                    |
| 2   | Baseline pnpm install + check                                                                               | 385/385 green                                                                                |
| 3   | Repository: credits accounts/ledger-pair/wallet methods (memory+Kysely+contract; PGlite harness +0012/0014) | atomic pair, idempotency uniqueness, placeholder check mirrored                              |
| 4   | Migration 0014 wallet deactivation (placeholder→deactivated only)                                           | no activation path anywhere                                                                  |
| 5   | Service credits.ts: openAccount/getAccountView/transfer/createWalletBinding/deactivateWalletBinding         | internal rail enforced (400), overdraft policy (system-only negative), audit names per brief |
| 6   | Routes: /credits/_, /wallet-bindings/_, /crypto-readiness                                                   | mapping table documented                                                                     |
| 7   | UI: /credits + /cognitia/crypto-readiness (legal-gated statement, no marketing language)                    | —                                                                                            |
| 8   | Docs: CREDITS_AND_WALLET_PLACEHOLDERS.md, CRYPTO_READINESS_INTERNAL.md, internal/CRYPTO_READINESS.md        | all INTERNAL — LEGAL-GATED                                                                   |
| 9   | Tests: credits.ledger.test.ts (10) + contract additions                                                     | green                                                                                        |
| 10  | Final `pnpm check`                                                                                          | **397/397 tests, 62 files green**                                                            |

No real payments, no token transfer, no key storage, no deploys, no secrets,
no destructive git.
