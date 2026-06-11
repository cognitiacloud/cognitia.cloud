# Cognitia v1.1 — Discovery Report

Date: 2026-06-11
Author: Fable 5 discovery session (Step 1, COG-001)
Status: COMPLETE — discovery only, no product code written.
Revision note: an earlier draft of this report concluded the repo was greenfield based on the local clone (which only had 2 branches fetched). A full `git fetch origin` revealed ~30 remote branches containing a substantial existing codebase. This report reflects the corrected, full picture.

Evidence tags used throughout: `verified_fact` | `likely_inference` | `unknown`.

---

## 1. Repo root

`/home/user/cognitia.cloud` — `verified_fact` (from `pwd`).
Remote: `cognitiacloud/cognitia.cloud` on GitHub — `verified_fact` (git remote + session scope).

## 2. Current branch

`claude/cognitia-v1-1-discovery-g6ryrg` — `verified_fact` (`git branch --show-current`).

## 3. Latest commit

On this branch at discovery start: `0dfb0ad Add hermes vision skill (local OCR + multi-provider vision QC)` — `verified_fact`.

**Critical repo-topology finding** (`verified_fact`, from `git fetch origin` + `git remote show origin` + per-branch `git log`/`ls-tree` counts):

- The **default branch is `claude/ep002-mission-run-pPoba`** and contains only 1 commit / 14 files (the Hermes vision skill). There is **no `main`/`master`**.
- The remote has **~31 branches**. The most advanced lineage is:
  - `claude/soc-1-readiness-package` — **59 commits, 226 files**, tip `206e6d2` dated **2026-06-11** ("SOC-readiness & implementation handoff package for the control plane").
  - `claude/gtm-platform-mvp-setup-vYLBG` — 59 commits, 226 files, **tree-identical to soc-1** (`git diff` between them is empty) though not a git ancestor (likely parallel merge history).
  - Below them, a stack of ~26 feature branches (hard-1/4, run-1, learn-1, why-1, alpha-1, enf-1, gov-1, trust-2, undo-1, eval-1, met-1, prov-1, sim-1, etc.) at 35–57 commits each — PR-merge lineage #23–#29 visible in soc-1's history.
- **None of this work is merged into the default branch** — `verified_fact`.

## 4. Dirty files / untracked files

None at discovery start; working tree clean — `verified_fact`.

## 5. Package manager

On the advanced lineage (soc-1 / gtm-platform): **pnpm** (`packageManager: pnpm@10.33.0`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, Node >= 22) — `verified_fact` (root `package.json` read via `git show`).
On the default branch: none (only pip `requirements.txt` for the vision skill) — `verified_fact`.

## 6. Framework

On the advanced lineage — `verified_fact` (file tree + `docs/architecture.md` read via `git show`):
- `apps/api` — **Fastify** HTTP API (webhooks, REST, approval actions, auth, governance).
- `apps/web` — **Next.js (App Router)** operator console (approval queue pages exist).
- `apps/worker` — background jobs (CRM sync, agent runs).
- `packages/core` — zod schemas (agent, event, common), policies, events, logging.
- `packages/db` — **Kysely** query builder + raw SQL migrations + PGlite-based tests incl. RLS tests.
- `packages/integrations` — HubSpot (sync, webhook, write plans, rollback, readiness), email adapter.
- `packages/evals` — eval harness, golden/regression datasets.
- `packages/workflows` — n8n workflow JSONs.
- Tests: **Vitest** repo-wide; TypeScript strict; Prettier; GitHub Actions CI (`.github/workflows/ci.yml`).

Repo self-description: "AI GTM workforce platform — production-shaped MVP (Mira, Echo, Atlas, Beacon)" — `verified_fact` (root package.json description).

## 7. App structure

```
(advanced lineage: claude/soc-1-readiness-package, tree-identical to claude/gtm-platform-mvp-setup-vYLBG)
apps/api/        Fastify API: auth, governance, handlers, preflight, rationale,
                 runPlans, scorecards, trustMetrics, trustPacket + extensive tests
                 (killSwitch, rollback, provenance, batchDecide, crmExecute, ...)
apps/web/        Next.js operator console: /, /approvals; approvalQueue lib
apps/worker/     job runner: crmSync
packages/core/   zod schemas (agent, event), policies, events, logging
packages/db/     migrations 0001–0008, Kysely, RLS fixtures + tests, credential store
packages/integrations/  hubspot/*, email/*
packages/evals/  harness, golden-v1, regressions-v1
packages/workflows/      n8n JSONs
docs/            architecture.md, data-model.md, agent-contracts.md, evals.md,
                 event-taxonomy.md, integration-contracts.md, launch/*, competitive/*
hermes/          vision skill (also present on default branch)
```
`verified_fact` (full `git ls-tree -r` of the branch).

Default branch structure: `hermes/skills/vision-skill/` only — `verified_fact`.

## 8. API structure

Fastify server (`apps/api/src/server.ts`, `handlers.ts`) with session auth (`auth.ts`, `issue-session.mjs` script), governance/approval endpoints, HubSpot webhook, kill switch, rollback, preflight, trust metrics/trust packet surfaces — `verified_fact` (file names + architecture.md service-boundary table; individual route paths not yet enumerated → exact route inventory is `unknown` until COG-002 reads `handlers.ts`).

## 9. Database technology

**Postgres as source of truth; every table tenant-scoped, timestamped, RLS-protected** — `verified_fact` (docs/data-model.md). Kysely for access; PGlite for tests — `verified_fact`. Whether a live hosted Postgres (e.g. Supabase) instance exists and is current: `unknown`.

## 10. Migration system

Raw SQL migrations in `packages/db/migrations/` (0001–0008) applied via `packages/db/scripts/apply-migrations.mjs` — `verified_fact`. Existing migrations: tenants/users/memberships/roles → integrations/external maps/sync runs → GTM entities → events/agent_runs/actions/recommendations/audit_events → campaigns/sequences/touchpoints/conversations → signals/playbooks/documents/embeddings (pgvector) → evals → credential ciphertexts — `verified_fact` (data-model.md migration table + file list).

## 11. Existing tests

Extensive Vitest suites across all packages on the advanced lineage (~40+ `*.test.ts` files: auth, governance, lifecycle acceptance, kill switch, rollback, RLS via PGlite, HubSpot sync/webhook/rollback, evals golden/regression, e2e hubspotSync, …) — `verified_fact` (file list). Pass/fail status in this environment: `unknown` (not executed; dependencies not installed in this session).
Default branch: one Python unittest file for the vision skill — `verified_fact`.

## 12–13. Existing relevant models / lead/CRM/payment/agent code

`verified_fact` (data-model.md + schema.ts read):

| Cognitia v1.1 need | Already exists on advanced lineage? |
|---|---|
| agents / actions / audit | ✅ `agent_runs`, `agent_actions` (proposed/approved/executed lifecycle), `audit_events`, immutable `events` |
| leads / CRM | ✅ `leads`, `accounts`, `contacts`, `opportunities`, `meetings`, `conversations`, HubSpot sync |
| approval gating | ✅ approval queue (API + web UI), governance, preflight, kill switch, rollback |
| trust surfaces | ✅ `trustMetrics.ts`, `trustPacket.ts`, scorecards, decision rationale, provenance |
| PII discipline | ✅ partial: `contacts.email_hash` / `phone_hash` (hashed, not raw) — `verified_fact`; suppression flag exists |
| evals | ✅ experiments, eval_runs, golden/regression datasets |
| payments / credits / wallet | ❌ none found — `verified_fact` (no matching files/tables) |
| ATC / credentials for agents | ❌ none (credential_ciphertexts is for *integration* credentials, e.g. HubSpot tokens — `verified_fact` from migration name + credentialStore.ts) |
| proofs / evidence tags / reputation | ❌ none — `verified_fact` |
| skills / SkillProof | ❌ none — `verified_fact` |
| MoverOS / SMS front desk | ❌ none (platform is B2B GTM/HubSpot-oriented) — `verified_fact` |

## 14. Existing auth / tenant / permission system

✅ Exists on advanced lineage: tenants, users, memberships, roles, RLS enforcement (tested via PGlite), session auth in API — `verified_fact`.

## 15. Build/test commands discovered

From root `package.json` (advanced lineage) — `verified_fact`:
- `pnpm build` · `pnpm test` (vitest run) · `pnpm typecheck` · `pnpm check` (format + typecheck + test) · `pnpm format`
- DB: `packages/db/scripts/apply-migrations.mjs`
- CI: `.github/workflows/ci.yml` exists.
Execution success in this container: `unknown` (not run).

## 16. Unknowns

| # | Unknown | Impact |
|---|---|---|
| U1 | Why the default branch is near-empty while 59 commits of platform work sit unmerged on soc-1/gtm lineage; which branch the founder considers canonical | **Top decision for COG-002.** Recommendation in §18. |
| U2 | Whether a live Postgres (Supabase?) instance exists/matches migrations | DB provisioning step in COG-002. |
| U3 | Whether `pnpm install && pnpm test` passes on soc-1 in this environment | First action of COG-002. |
| U4 | Exact Fastify route inventory (handlers.ts not yet read line-by-line) | COG-002 reads it before adding routes. |
| U5 | Whether any separate canonical MoverOS repo exists outside this repo | Kill gate §I.3: if unclear by Day 7, build here. This repo's GTM platform is currently the best candidate host — `likely_inference`. |
| U6 | Relationship between `soc-1` and `gtm-platform` branches (identical trees, divergent history) | Pick one as base; recommend soc-1 (newest dated tip). |
| U7 | Inlet/warm-network pilot commitments | Business blocker for Lane A, not code. |

## 17. Blockers

- No technical blockers for Step 1 (docs only).
- **B1 (COG-002):** canonical-branch ratification (U1) — the Command Book §0 carries the recommendation; founder confirmation requested at COG-002 start.
- **B2:** real SMS remains human-approval-gated; simulation-first mandatory (doctrine).

## 18. Recommended implementation branch

**Base all Cognitia v1.1 implementation on `claude/soc-1-readiness-package`** (or its identical twin `gtm-platform-mvp-setup-vYLBG`), not on the near-empty default branch — recommendation, `likely_inference` that this is the founder's most current intended platform (newest commit dated today, self-describes as a handoff package, contains 90% of Lane A/B infrastructure already built and tested).

Mechanics: COG-002 creates `claude/cog-002-schema-foundation` **from `origin/claude/soc-1-readiness-package`**, and the founder should also set/confirm the repo default branch. Building greenfield instead would discard tenancy+RLS, approval gating, audit, HubSpot, and eval infrastructure that v1.1 needs — rejected option.

## 19. Confidence levels for major conclusions

| Conclusion | Tag | Confidence |
|---|---|---|
| Default branch is near-empty; ~59-commit GTM platform exists unmerged on soc-1/gtm lineage | verified_fact | High |
| Platform stack: pnpm + TS + Fastify + Next.js + Kysely/Postgres + RLS + Vitest | verified_fact | High |
| agent_actions/audit/approval/leads/tenancy already exist; proofs/ATC/skills/reputation/credits do not | verified_fact | High |
| soc-1 lineage is the intended current platform | likely_inference | Medium-high |
| Tests pass in this container | unknown | — |
| Live DB instance status | unknown | — |
| Separate canonical MoverOS repo | unknown | — |
