# COG-009 — Handoff (Credits + Wallet Placeholder)

Branch `claude/cog-009-credits-wallet-placeholder` stacked on
#32→#33→#34→#35→#36. Evidence: `verified_fact` unless noted.

## Built

- Credits: idempotent account open, atomic balanced transfer pairs
  (idempotency-key replay = no-op), derived balances, internal rail only
  (service 400 + DB check), overdraft only for system accounts,
  `/credits` console.
- Wallet placeholders: create (placeholder only, zod + DB check), get/list,
  deactivate (0014; strictly more inert), no keys/secrets stored, no
  activation path (route-scan tested).
- Crypto readiness: `GET /crypto-readiness` + `/cognitia/crypto-readiness`
  internal board with the required legal-gated statement, conceptual rails
  marked designed-for-later, token/payments/legal-gate all shown disabled;
  forbidden marketing phrases tested absent.
- Audit events: credits.account_created.v1, credits.transfer_recorded.v1,
  wallet_binding.created.v1, wallet_binding.deactivated.v1.

## Intentional deviations (documented)

- No single-sided ledger-entry endpoint (double-entry integrity).
- Routes unprefixed per platform convention (mapping table in
  CREDITS_AND_WALLET_PLACEHOLDERS.md).

## Verify

`pnpm check` (397/397 at handoff);
`pnpm vitest run apps/api/src/credits.ledger.test.ts`

## Next

COG-007 dashboard polish or COG-010 demo/tests/handoff (final ticket).
Standing founder items: merge order for #32→…→#37, default-branch promotion,
live Postgres for `apply-migrations.mjs`.
