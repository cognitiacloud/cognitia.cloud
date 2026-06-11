# COG-009 — Platform Map

Evidence tags: `verified_fact` (all files read this session).

| Inspected                 | Finding                                                                                                                                                                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0012_credits_wallet.sql` | credits_accounts (unique tenant+owner), append-only ledger (unique tenant+key+direction, amount>0, internal-rail check, distinct accounts, forbid update/delete triggers), wallet_bindings (status check-locked to placeholder, chain default none) |
| Repository pattern        | twin impls + shared contract (memory + PGlite); tenant-scoped everything                                                                                                                                                                            |
| Service pattern           | per-feature module + zod parse + typed errors + audit/events emission                                                                                                                                                                               |
| Routes                    | unprefixed operator routes, sendAuthed RBAC                                                                                                                                                                                                         |
| Audit/events              | `*.v1` dotted action names, refs-only payloads                                                                                                                                                                                                      |
| Operator UI               | client page + paste-token + typed ApiClient                                                                                                                                                                                                         |
| Doctrine guards           | no token routes/marketing, no custom DID, internal docs excluded from scans                                                                                                                                                                         |
| COG-008 handoff           | reputation read/recompute done; credits/wallet were the open Lane C items                                                                                                                                                                           |

Reused: everything above. Not rebuilt: approval ledger, proof service.
New migration 0014 only (wallet deactivated status — strictly more inert).

Decisions (documented per brief):

- Single-sided `recordCreditsLedgerEntry` intentionally unsupported
  (double-entry integrity); `POST /credits/transfer` is the only writer.
- Conceptual rails (card_stripe, usdc_base, usdt, future_cognitia_token)
  surface on the readiness board as designed-for-later/legal-gated; the DB
  check keeps them unwritable.
- Routes follow platform convention; brief's `/api/cognitia/*` mapping table
  is in CREDITS_AND_WALLET_PLACEHOLDERS.md.
