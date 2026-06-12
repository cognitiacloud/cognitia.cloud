# Escrow Simulation (AGENT-ECONOMY-001)

Date: 2026-06-12. Internal credits ONLY — this is double-entry bookkeeping on
the 0012 ledger, not payments. The `ledger_internal_rail_only` check is
untouched; no new rail exists.

## Accounts

- Requester/worker agents hold `owner_type='agent'` credits accounts.
- Each work order gets its own `owner_type='escrow'` account
  (`owner_id` = the work order id) — 0016 widens the 0012 owner-type check,
  the 0014 precedent (widen by migration, never edit history).
- `system` accounts remain the only overdraftable grant source.

## Movements (all balanced pairs, all idempotent, all audited)

| Operation                    | Pair               | Idempotency key   | Reason code                 |
| ---------------------------- | ------------------ | ----------------- | --------------------------- |
| `reserveCreditsForWorkOrder` | requester → escrow | `wo:<id>:reserve` | `work_order:reserve`        |
| `releaseCreditsForWorkOrder` | escrow → worker    | `wo:<id>:release` | `work_order:release`        |
| `refundCreditsForWorkOrder`  | escrow → requester | `wo:<id>:refund`  | `work_order:refund`         |
| dispute                      | none — escrow HELD | —                 | audit + feedback label only |

Every movement goes through the existing `transfer` service: one atomic
debit+credit pair sharing the idempotency key (retries are no-ops), an
`audit_events` row per movement, balances derived by SUM — never stored.
Insufficient requester balance refuses acceptance with 422 (only `system`
accounts may go negative).

## Release discipline

Release happens inside `verifyWorkOrder` and nowhere else, and only after the
verified_fact check passes (service + memory mirror + the 0016 DB trigger).
`likely_inference` and `unknown` proofs leave escrow exactly where it is.
Disputed escrow stays in the escrow account — neither side is paid until a
future, deliberate resolution mechanism exists.

## What this is NOT

Not a payment system. Not a token. Not transferable outside the tenant's
internal ledger. No Stripe, no stablecoin, no chain, no yield, no pricing
language. The future mapping of these mechanics lives privately in
`docs/cognitia/crypto/` behind the launch gates listed there.
