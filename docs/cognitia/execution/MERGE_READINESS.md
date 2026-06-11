# Cognitia v1.1 — Merge Readiness

Date: 2026-06-11. **STATUS: EXECUTED** — the full stack was merged in order on
2026-06-11 under the founder's post-merge directive; see
`POST_MERGE_VERIFICATION.md` for merge commits and the green verification of
the merged base (400/400 tests). This document is retained as the record of
the merge plan that was followed. Evidence: `verified_fact` unless noted.

## Required merge order

1. #32 `claude/cog-002-schema-foundation` → base `claude/soc-1-readiness-package`
2. #33 `claude/cog-003-proof-registry`
3. #34 `claude/cog-004-atc`
4. #35 `claude/cog-005-006-skillproof-ai-front-desk`
5. #36 `claude/cog-008-reputation-v0`
6. #37 `claude/cog-009-credits-wallet-placeholder`
7. Final Pack `claude/cog-007-010-command-audit-proof-pack`

## Status

**All seven merged** (in the required order, normal merge commits, no branch
deletions): #32 `d34bad6` → #33 `a7fb025` → #34 `28edf55` → #35 `d48c983` →
#36 `d4ff07a` → #37 `6eb934a` → #38 `7fe0c1a`. Merged base verified green;
`main` created at the merged tip as the default-branch candidate (repo
settings flip = founder admin click).

## Dependency notes

Strictly linear; each PR's diff is only its own ticket. After merging one
level, GitHub normally retargets the next PR automatically when the merged
head branch is deleted — but per guardrails do NOT delete branches; instead
manually retarget each next PR's base after its parent merges.

## Default branch

The repo default (`claude/ep002-mission-run-pPoba`) is near-empty.
Recommendation (founder decision): after merging the stack into
`claude/soc-1-readiness-package`, promote that branch (or a new `main` cut
from it) to default so future clones see the real platform.

## Verify after EACH merge

```bash
git fetch origin && git checkout <merged-base> && pnpm install && pnpm check
```

All green before merging the next level.

## After the final merge

```bash
pnpm install && pnpm check                       # full gate
pnpm vitest run apps/api/src/missionLoop.e2e.test.ts
# When a dev/staging Postgres exists (founder provides DATABASE_URL):
node packages/db/scripts/apply-migrations.mjs    # applies 0001–0014 in order
```

Then set real env values (never committed): `SESSION_SECRET`,
`COGNITIA_PII_KEY_BASE64` (32-byte base64), `CREDENTIAL_SECRET_KEY_BASE64`,
`DATABASE_URL`. No production deploy without founder go.
