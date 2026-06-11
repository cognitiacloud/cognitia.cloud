# Credits + Wallet Placeholders (COG-009)

Internal economic-readiness layer. Credits are bookkeeping units — not a
currency, not a token, not transferable outside the system, not exchangeable.

## Credits

- **Accounts** (`credits_accounts`): one per owner (`tenant`/`agent`/`system`),
  idempotent open on the unique (tenant, owner_type, owner_id).
- **Ledger** (`credits_ledger_entries`): append-only double-entry. A transfer
  is one balanced debit+credit pair sharing an `idempotency_key`, inserted
  atomically (single transaction in Postgres). Replays are no-ops. Balances
  are derived sums — never stored-and-mutated. There is no update or delete
  surface anywhere (interface-level, service-level, and 0012 triggers).
- **Rail**: `internal_credits` only — enforced in the service (400 on any
  other rail) AND by the 0012 check constraint.
- **Overdraft**: only `system` accounts (the internal grant source) may go
  negative; agent/tenant accounts need sufficient balance (422 otherwise).
- **recordCreditsLedgerEntry note**: single-sided entries are deliberately
  NOT supported — they would break double-entry integrity. All ledger writes
  go through the transfer pair creator (`POST /credits/transfer`).

## Wallet placeholders

Inert rows only: no keys, no secrets, no custody, no signing, no chain
activity. `chain` defaults `none` (enum reserves `base`/`evm_other`);
`status` is `placeholder` or (0014) `deactivated` — activation does not exist.

## Routes (platform convention — unprefixed operator routes; the brief's

`/api/cognitia/*` names map 1:1)

| Brief name                                        | Actual route                                   |
| ------------------------------------------------- | ---------------------------------------------- |
| GET /api/cognitia/credits/accounts                | `GET /credits/accounts`                        |
| POST /api/cognitia/credits/accounts               | `POST /credits/accounts`                       |
| GET /api/cognitia/credits/accounts/:id            | `GET /credits/accounts/:id`                    |
| GET /api/cognitia/credits/accounts/:id/ledger     | `GET /credits/accounts/:id/ledger`             |
| POST /api/cognitia/credits/ledger                 | intentionally not implemented (see note above) |
| POST /api/cognitia/credits/transfers              | `POST /credits/transfer`                       |
| GET/POST /api/cognitia/wallet-bindings            | `GET/POST /wallet-bindings`                    |
| GET /api/cognitia/wallet-bindings/:id             | `GET /wallet-bindings/:id`                     |
| POST /api/cognitia/wallet-bindings/:id/deactivate | `POST /wallet-bindings/:id/deactivate`         |
| (readiness)                                       | `GET /crypto-readiness`                        |

## Audit events

`credits.account_created.v1`, `credits.transfer_recorded.v1`,
`wallet_binding.created.v1`, `wallet_binding.deactivated.v1` — payloads carry
refs and amounts only, never secrets.

## Console

`/credits` (accounts, balances, transfers, placeholder list) and
`/cognitia/crypto-readiness` (internal status board with the legal-gated
statement). See `CRYPTO_READINESS_INTERNAL.md`.
