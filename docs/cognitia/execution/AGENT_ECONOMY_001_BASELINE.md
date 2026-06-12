# AGENT-ECONOMY-001 — Baseline

Date: 2026-06-12. Evidence: `verified_fact` unless noted.

## Pre-coding confirmations (per mission brief)

| Check                             | Result                                                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Current branch                    | `claude/agent-economy-001-lab`, created fresh from `main`                                                                             |
| `main` contains v1.1 foundation   | YES — tip `99e2627` includes the merged COG-002…COG-010 stack (PRs #32–#38) plus doctrine Amendment A1 in `ARCHITECTURE_LOCK_V1_1.md` |
| COG-016 parked, not the base      | YES — `claude/cog-016-field-provenance` (`53116dc`) is untouched: not the base, not merged, not cherry-picked, no PR                  |
| `pnpm install --frozen-lockfile`  | clean                                                                                                                                 |
| `pnpm check` on clean `main` tree | **400/400 tests, green** (format + typecheck + lint + tests)                                                                          |

## Primitives confirmed present on main (the lab builds on, not into, them)

- Agent Trust Credential / ATC: `registerAgent`/`issueAtc`, revoked-terminal
  trigger, deny-by-default `sms.send_real` seed (0009).
- Proof Registry: append-only, evidence tags, verified_fact requires
  evidence_ref + verifier_ref, redaction-gated publishing (0009).
- SkillProof: skills/versions/tiers, tier ≥2 requires verified_fact, yank
  machinery (0010/0013).
- Reputation: append-only events, positive delta requires verified_fact
  (0010 trigger), reproducible snapshots.
- Credits ledger: balanced idempotent pairs, internal-rail check-locked,
  system-account grant source (0012).
- Wallet placeholders: inert, deactivate-only (0012/0014).
- Crypto readiness: internal statement endpoint + console page; doctrine
  guard tests banning public token surfaces.

## Migration numbering note

This branch adds `0016_agent_economy.sql`. **0015 is deliberately skipped** —
it is reserved by the parked COG-016 branch (`0015_field_provenance.sql`), so
a future un-parking cannot collide.

## Known overlap with open GTM PRs (likely_inference until merge)

PRs #44/#45/#46 (GTM proof-environment work) are open against `main` and also
touch `repository.ts`/`memory.ts`/`kysely.ts`/`schema.ts`/`handlers.ts`/
`server.ts` and create `NEXT_PROMPTS_FOR_AGENTS.md`. Whichever lands second
will need a small mechanical merge (both changes are additive in the same
regions).
