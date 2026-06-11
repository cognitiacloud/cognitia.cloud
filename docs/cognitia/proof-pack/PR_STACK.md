# Cognitia v1.1 — PR Stack

**All seven PRs are MERGED** (2026-06-11, in order, normal merge commits):
#32 `d34bad6`, #33 `a7fb025`, #34 `28edf55`, #35 `d48c983`, #36 `d4ff07a`,
#37 `6eb934a`, #38 `7fe0c1a` — merged base verified 400/400 tests green
(verified_fact; see `../execution/POST_MERGE_VERIFICATION.md`). The table
below records each PR's content; the "Status" column reflects pre-merge CI,
each of which was green on its head.

| #   | PR     | Branch                                        | Purpose                                                                                                                                                                          | Key tests                                                                                                      | Status               |
| --- | ------ | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------- |
| 1   | #32    | `claude/cog-002-schema-foundation`            | Migrations 0009–0012 (trust core, SkillProof/reputation, lead rescue, credits/wallet), Kysely interfaces, zod trust schemas, doctrine guards, fixture                            | `cognitia.trust.pglite.test.ts` (23 DB-invariant tests), `doctrine.guard.test.ts`, `trust.test.ts`             | open draft, CI green |
| 2   | #33    | `claude/cog-003-proof-registry`               | Proof service (append-only, supersede), PII redaction scanner (Hermes port), proof routes, `/proofs` console                                                                     | `proofs.test.ts`, `redaction/scanner.test.ts`, repository contract                                             | open draft, CI green |
| 3   | #34    | `claude/cog-004-atc`                          | Agent registry, ATC lifecycle (revoked terminal), permissions (`sms.send_real` deny-by-default, owner-gated allow), `/agents` consoles                                           | `atc.test.ts` (8)                                                                                              | open draft, CI green |
| 4   | #35    | `claude/cog-005-006-skillproof-ai-front-desk` | Migration 0013; SkillProof Core 20 (tiers, yank, no marketplace); MoverOS Front Desk (encrypted PII intake, approval-gated simulated sends, outcomes, summary); e2e mission loop | `skillproof.test.ts` (6), `frontdesk.test.ts` (6), `frontdesk.outcomes.test.ts` (8), `missionLoop.e2e.test.ts` | open draft, CI green |
| 5   | #36    | `claude/cog-008-reputation-v0`                | Reputation snapshots (reproducible `inputs_hash`), recompute, agent panel; no direct event-post surface                                                                          | `reputation.test.ts` (4)                                                                                       | open draft, CI green |
| 6   | #37    | `claude/cog-009-credits-wallet-placeholder`   | Migration 0014; credits accounts + atomic balanced ledger pairs; wallet placeholders + deactivate; `/credits` + crypto-readiness board; legal-gated docs                         | `credits.ledger.test.ts` (10)                                                                                  | open draft, CI green |
| 7   | (this) | `claude/cog-007-010-command-audit-proof-pack` | Command Dashboard + summary API; demo script, proof pack, final audit, merge readiness, final handoff                                                                            | `commandSummary.test.ts`                                                                                       | this pack            |

Upstream base of #32: `claude/soc-1-readiness-package` (the 59-commit platform
lineage). The repo default branch is near-empty — promotion is a founder
decision (see MERGE_READINESS.md).
