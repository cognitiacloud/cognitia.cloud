# Cognitia v1.1 — Post-Merge Verification

Date: 2026-06-11. Evidence tags throughout.

## ⚠️ Actual merge state (verified_fact — corrects the tasking premise)

The tasking stated the stack was merged. **It is not.** At verification time:
PR #38 is open/draft (`merged: false`, mergeable_state clean) and
`origin/claude/soc-1-readiness-package` is still at `206e6d2` with no v1.1
commits. However, the stack tip
`claude/cog-007-010-command-audit-proof-pack` @ `7113096` **linearly contains
all nine v1.1 commits** (COG-002 → COG-007/010) on the soc-1 base, so every
content verification below ran against exactly what the merged result will be.
Merging remains a founder action per MERGE_READINESS.md.

## Verification results

| Check                         | Result                                                                              | Tag           |
| ----------------------------- | ----------------------------------------------------------------------------------- | ------------- |
| Branch/commit                 | `claude/cog-007-010-command-audit-proof-pack` @ `7113096`, identical to origin      | verified_fact |
| Stack completeness            | All v1.1 commits present in order on the soc-1 base (git log)                       | verified_fact |
| `pnpm install`                | OK, lockfile unchanged                                                              | verified_fact |
| `pnpm check`                  | **400/400 tests green (63 files)**, typecheck + format clean                        | verified_fact |
| Migrations                    | 0001–0014 present, correctly ordered, no edits to merged ones                       | verified_fact |
| Dashboard route               | `GET /cognitia/command/summary` registered in server.ts                             | verified_fact |
| Docs                          | demo script, proof-pack ×3, final audit, merge readiness, final handoff all present | verified_fact |
| Dev/staging DB                | `DATABASE_URL` not set → **no migrations applied** (correct per tasking #9)         | verified_fact |
| Live smoke (in-memory server) | See below — all assertions passed                                                   | verified_fact |

## Live smoke test (real Fastify server, in-memory repo, port 3411)

Booted `apps/api/src/server.ts` with a dev `SESSION_SECRET`; issued an owner
session via `issue-session.mjs`; drove the full loop over HTTP:
agent + ATC → Core 20 import (20 imported: 1 real source, 19 honest seeds) →
encrypted lead intake → `propose_sms_reply` → structured approval →
**`simulation:false` refused with HTTP 403** → simulated send executed
(response_time_ms captured) → verified_fact booked outcome ($1,500, CRM
evidence ref) → reputation event + snapshot (score 5) → credits account +
wallet placeholder → `GET /cognitia/command/summary`.

Assertions all passed: populated counts correct; verified-only booked value =
150000¢; crypto gates shown disabled; **zero PII in the aggregate** (customer
name, phone fragment, and message text absent from the payload).

## Token / SMS / PII guards

- Token marketing: no token/coin/staking/swap/dex routes or page directories
  (doctrine guard + skillproof + credits route-scan tests, all green).
- SMS safety: real send refused live (403) on top of the four structural
  layers (no provider, deny-by-default permission, owner gate, no adapter).
- PII: encrypted at rest, masked lists, refs-only events/audits,
  redaction-gated publishing, PII-free dashboard — test-verified AND
  live-verified.

## Dev DB setup needed (exact, for the founder)

1. Provision Postgres (e.g. Supabase project; NOT production data).
2. `export DATABASE_URL=postgres://…` (dev instance only) and `pnpm add -w pg`.
3. `node packages/db/scripts/apply-migrations.mjs` (applies 0001–0014 in
   order, one transaction each).
4. Set `SESSION_SECRET`, `COGNITIA_PII_KEY_BASE64` (32-byte base64),
   `CREDENTIAL_SECRET_KEY_BASE64`.
5. Re-run the smoke from this doc against the live DB; additionally verify
   RLS under a NON-superuser role (the PGlite harness cannot — documented
   caveat in `kysely.pglite.test.ts`).

## Default-branch promotion

Blocked (honestly) on the merges themselves: promoting a default candidate
before the PRs merge would bypass review. After #32→…→#38 merge into
`claude/soc-1-readiness-package`, promote that branch (or cut `main` from it)
in repo settings. Steps in MERGE_READINESS.md.
