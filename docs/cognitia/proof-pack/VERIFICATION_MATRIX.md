# Cognitia v1.1 — Verification Matrix

"Tested" = executed green in-session. DB-invariant rows are verified against
real Postgres semantics via PGlite in addition to the in-memory mirror.

| Capability                                                                            | Built | Tested | Test file(s)                                                  | Evidence tag  | Open blocker                               |
| ------------------------------------------------------------------------------------- | ----- | ------ | ------------------------------------------------------------- | ------------- | ------------------------------------------ |
| Schema foundation (0009–0014, RLS, enums)                                             | ✅    | ✅     | `cognitia.trust.pglite.test.ts`, `kysely.pglite.test.ts`      | verified_fact | live DB unknown                            |
| Proof integrity (append-only, tags, supersede, verified_fact refs)                    | ✅    | ✅     | `proofs.test.ts`, `cognitia.trust.pglite.test.ts`             | verified_fact | —                                          |
| PII redaction (scanner, public_safe gating)                                           | ✅    | ✅     | `redaction/scanner.test.ts`, `proofs.test.ts`                 | verified_fact | —                                          |
| ATC lifecycle (issue/suspend/resume/expire/revoke-terminal, strict claims)            | ✅    | ✅     | `atc.test.ts`, repository contract                            | verified_fact | —                                          |
| SkillProof tiers (0–2 live, 3–4 locked, yank, no marketplace)                         | ✅    | ✅     | `skillproof.test.ts`                                          | verified_fact | 19/20 skills seeded (sources inaccessible) |
| AI Front Desk simulation (encrypted PII, approval-gated, refusal of real SMS)         | ✅    | ✅     | `frontdesk.test.ts`                                           | verified_fact | lead-detail page deferred                  |
| Lead outcomes (evidence-tagged revenue receipts)                                      | ✅    | ✅     | `frontdesk.outcomes.test.ts`                                  | verified_fact | —                                          |
| Reputation v0 (verified-only positive, reproducible snapshots)                        | ✅    | ✅     | `reputation.test.ts`, `frontdesk.outcomes.test.ts`            | verified_fact | —                                          |
| Credits ledger (atomic pairs, idempotent, append-only, internal rail)                 | ✅    | ✅     | `credits.ledger.test.ts`, repository contract                 | verified_fact | —                                          |
| Wallet placeholders (inert, deactivate-only, no keys)                                 | ✅    | ✅     | `credits.ledger.test.ts`, repository contract                 | verified_fact | —                                          |
| Crypto readiness (legal-gated board + docs, no marketing)                             | ✅    | ✅     | `credits.ledger.test.ts` (#13–#16)                            | verified_fact | legal gate not passed (by design)          |
| Command dashboard (summary API + `/cognitia` page)                                    | ✅    | ✅     | `commandSummary.test.ts`                                      | verified_fact | —                                          |
| Doctrine guards (no token routes/marketing, no custom DID, no legacy passport naming) | ✅    | ✅     | `doctrine.guard.test.ts`, `commandSummary.test.ts` doc guards | verified_fact | —                                          |
| End-to-end trust loop (agent→cert→lead→approval→sim send→receipt→reputation)          | ✅    | ✅     | `missionLoop.e2e.test.ts`                                     | verified_fact | —                                          |

Final suite size at pack completion: recorded in `V1_1_FINAL_AUDIT.md` §12
from the last `pnpm check` run.
