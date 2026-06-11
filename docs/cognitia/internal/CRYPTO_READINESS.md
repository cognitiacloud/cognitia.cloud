# INTERNAL — LEGAL-GATED

# Cognitia Crypto-Readiness Notes (Lane C)

This document is internal engineering/legal planning material. It is NOT
marketing, NOT an announcement, NOT investment material, and must never be
published, excerpted publicly, or linked from any public surface. Doctrine:
`ARCHITECTURE_LOCK_V1_1.md` §5 — no public token marketing of any kind.

## What exists today (v1.1, verified_fact)

- **Internal credits**: `credits_accounts` + append-only double-entry
  `credits_ledger_entries` (0012). A transfer is one balanced debit+credit
  pair, atomic, idempotent by key. Balances are derived sums. The rail column
  is check-locked to `internal_credits` — no other rail can be written.
- **Wallet bindings**: inert placeholder rows (`status` check-locked to
  `placeholder`, `chain` defaults `none`). No keys, no custody, no signing,
  no transactions, no chain activation path exists in code.
- **Overdraft policy**: only `system`-owned accounts (internal grant source)
  may go negative; agent/tenant accounts require sufficient balance.

## Progression (each step gated; none of these exist yet)

`internal credits → Stripe/card → stablecoin rails → Base/EVM optionality →
ERC-8004 / EAS / x402 integrations → token (LEGAL-GATED) → appchain
(usage-gated, likely never)`

- **Stripe/card**: widen the `rail` check in a deliberate future migration;
  requires real billing, refunds, and tax handling. Not before a paying pilot.
- **Stablecoin**: legal review first (MSB/money-transmitter exposure in
  Canada/BC); custodial vs self-custodial decision; never before card rails.
- **Base/EVM optionality**: `wallet_bindings.chain` enum already reserves
  `base`/`evm_other`; activation requires a migration + signing/custody
  design + security review (SkillProof tier-4-style audit).
- **ERC-8004 / EAS / x402**: ATC `external_ref` and proof
  `external_attestation_ref` columns are the anchor points; integration is a
  mapping exercise, not a migration, by design.
- **Token** (framing per Architecture Lock Amendment A1): a future
  coordination/economic primitive for the **broader Cognitia agent economy**
  — it attaches to the platform layer (Cognitia Core: trust, proofs,
  reputation, credits across all tenants and verticals), NOT to the moving
  workflow, the GTM dashboard, or any single tenant. Tenant Zero's revenue
  outcomes are evidence the platform works; they are not what a token would
  tokenize. Gating unchanged: only after (a) legal opinion, (b) sustained
  paying usage, (c) founder go decision. Kill gate (Command Book §I.1): if
  Lane A has no paying pilot by Week 8, all token-adjacent work stays frozen.

## Standing prohibitions (enforced by doctrine guard tests)

No public token/coin/staking/presale/airdrop pages or routes; no
"get in early" or price/return language anywhere; no DEX/liquidity docs; no
custom DID method; crypto docs live only in this internal folder.
