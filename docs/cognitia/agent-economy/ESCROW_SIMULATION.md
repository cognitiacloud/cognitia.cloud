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

| Operation                    | Pair                                               | Idempotency key                                        | Reason code                     |
| ---------------------------- | -------------------------------------------------- | ------------------------------------------------------ | ------------------------------- |
| `reserveCreditsForWorkOrder` | requester → escrow                                 | `wo:<id>:reserve`                                      | `work_order:reserve`            |
| `releaseCreditsForWorkOrder` | escrow → worker                                    | `wo:<id>:release`                                      | `work_order:release`            |
| `refundCreditsForWorkOrder`  | escrow → requester                                 | `wo:<id>:refund`                                       | `work_order:refund`             |
| dispute                      | none — escrow HELD                                 | —                                                      | audit + feedback label only     |
| resolve (0017, owner-only)   | escrow → worker and/or requester (conserved split) | `wo:<id>:resolve:worker` / `wo:<id>:resolve:requester` | `work_order:resolve:<decision>` |

Every movement goes through the existing `transfer` service: one atomic
debit+credit pair sharing the idempotency key (retries are no-ops), an
`audit_events` row per movement, balances derived by SUM — never stored.
Insufficient requester balance refuses acceptance with 422 (only `system`
accounts may go negative).

## Release discipline

Release happens inside `verifyWorkOrder` or — for disputes — inside
owner-arbitrated `resolveWorkOrderDispute` (AGENT-ECONOMY-002), and nowhere
else. Both paths are verified_fact-gated (service + memory mirror + the
0016/0017 DB triggers): verification checks the DELIVERY proof; resolution
requires its own verified_fact RESOLUTION proof and conserved arbitration
math (`worker + requester = requested_credits`). `likely_inference` and
`unknown` proofs leave escrow exactly where it is. See
`DISPUTE_RESOLUTION.md`.

## What this is NOT

Not a payment system. Not a token. Not transferable outside the tenant's
internal ledger. No Stripe, no stablecoin, no chain, no yield, no pricing
language. The future mapping of these mechanics lives privately in
`docs/cognitia/crypto/` behind the launch gates listed there.
