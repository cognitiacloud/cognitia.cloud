# Mission Pack A — Handoff (COG-003 + COG-004)

Date: 2026-06-11
Status: COMPLETE — both tickets implemented, tested, and in draft PRs.
Evidence tags: `verified_fact` unless noted.

## Branch / PR stack (merge in this order)

| Order | PR  | Branch                             | Base                               | Contents                                                                                  |
| ----- | --- | ---------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------- |
| 1     | #32 | `claude/cog-002-schema-foundation` | `claude/soc-1-readiness-package`   | Migrations 0009–0012, Kysely interfaces, zod trust schemas, doctrine guard tests, fixture |
| 2     | #33 | `claude/cog-003-proof-registry`    | `claude/cog-002-schema-foundation` | Proof service, PII redaction scanner, proof routes, `/proofs` console                     |
| 3     | #34 | `claude/cog-004-atc`               | `claude/cog-003-proof-registry`    | Agent registry, ATC lifecycle, permissions policy, `/agents` console                      |

CI: PR #32 and #33 `build-test` green (`verified_fact`, checked 2026-06-11).
The stack is linear — each PR's diff shows only its own ticket. After merging
one level, retarget the next PR's base (GitHub usually does this automatically
when the base branch is deleted on merge).

The repo default branch is still the near-empty `claude/ep002-mission-run-pPoba`;
promoting `claude/soc-1-readiness-package` (or its merge result) to default
remains an open founder decision (Discovery U1).

## What exists now

### Proof Registry (COG-003)

- `Repository` proof methods (insert/get/list/setProofPublishState) in both
  in-memory and Kysely implementations, verified by the shared contract
  against PGlite. Publish state is the only mutable pair; 0009 triggers stay
  authoritative.
- `apps/api/src/redaction/scanner.ts` — PII/secret scanner (Hermes regex
  port). Findings are audit-safe labels, never the matched PII.
- `apps/api/src/proofs.ts` — create / supersede / redaction-check; every
  write emits one `events` + one `audit_events` row (refs-only payloads).
- Routes: `GET /proofs`, `GET /proofs/public`, `POST /proofs`,
  `POST /proofs/:id/supersede`, `POST /proofs/:id/redaction-check`.
  No update/delete surface.
- Console: `/proofs` (tag badges, redaction check, public-view preview).

### Agent Trust Credential (COG-004)

- `Repository` agent/ATC/permission methods in both implementations +
  contract coverage (incl. revoked-terminal in PGlite via the 0009 trigger
  and mirrored in memory).
- `apps/api/src/atc.ts` — registerAgent (seeds `sms.send_real → deny`),
  issueAtc (strict claims: unknown keys rejected, so customer PII cannot
  ride in a credential), transitionAtc with the explicit lifecycle
  active → suspended ⇄ active, → expired, → revoked (terminal).
- RBAC doctrine guards: **revoke is owner-only**; **flipping
  `sms.send_real` to allow is owner-only**; all reads viewer-allowed.
- Routes: `GET/POST /agents`, `GET /agents/:id`, `POST /agents/:id/atc`,
  `GET/PUT /agents/:id/permissions`, `POST /atc/:id/{suspend|resume|expire|revoke}`.
- Console: `/agents` (list + ATC badges + registration), `/agents/[id]`
  (lifecycle buttons, permissions table).

## Verification commands

```bash
pnpm install
pnpm check        # format:check + typecheck + vitest — 358/358 green at handoff
pnpm vitest run apps/api/src/proofs.test.ts apps/api/src/atc.test.ts \
  apps/api/src/redaction/scanner.test.ts packages/db/src/cognitia.trust.pglite.test.ts
```

## Doctrine compliance notes

- No token marketing, no public token surface (doctrine guard tests enforce).
- No production deploys performed; no secrets touched.
- No real SMS path exists; `sms.send_real` is deny-by-default and
  owner-gated.
- `unknown`: live Postgres/Supabase state — migrations verified on PGlite
  only; apply via `packages/db/scripts/apply-migrations.mjs` at deploy time.

## Next

Prompt 6 in `FABLE_PROMPT_CHAIN.md` (SkillProof Core 20, COG-005) or
Prompt 5 (MoverOS Front Desk, COG-006) — both stack cleanly on COG-004.
