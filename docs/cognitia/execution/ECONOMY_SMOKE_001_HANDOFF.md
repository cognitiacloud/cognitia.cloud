# ECONOMY-SMOKE-001 — Handoff

Date: 2026-06-13. Branch `claude/economy-smoke-001` (from `main` @ `c2caf97`).
Status: economy stack runtime-verified on a local/dev Postgres engine;
report + runtime log produced.

## What this delivered

A **reusable live smoke harness** — `apps/api/src/economySmoke.live.test.ts`
— that applies the real migrations 0001–0014 + 0016–0018 to PGlite and runs
the full Agent Economy loop through the production handlers/repository. It
proves the merged stack works beyond the unit suite: migration chain,
escrow conservation, verified_fact gating, reputation deltas, internal-only
marketplace + tier ranking, dispute refund, tenant isolation, and all
route/page guardrails. `pnpm check` is **443/443** with it included.

Read `ECONOMY_SMOKE_001_REPORT.md` for the full result; the raw observed
output is in `ECONOMY_SMOKE_001_RUNTIME_LOG.md`.

## How to re-run

```
pnpm install --frozen-lockfile
pnpm vitest run apps/api/src/economySmoke.live.test.ts   # live loop, ~2s
pnpm check                                               # full suite incl. smoke
```

No env vars, no external DB, no secrets. PGlite is in-process and ephemeral.

## The one thing PGlite cannot prove (the recommended next step)

PGlite's default role is a superuser that bypasses RLS. This run verified the
repository-layer tenant predicates, `withTenant` GUC, and every DB
CHECK/trigger invariant — but NOT RLS-engine enforcement under a restricted
role. That is the **founder-gated persistent dev-DB step**:

1. Unpause `Cognitia Preview` or provide a `DATABASE_URL` (never a prod DB).
2. Apply migrations 0001–0014 + 0016–0018 (skip 0015 — reserved for parked
   COG-016) under the service role.
3. Re-run the loop under a NON-superuser role to confirm RLS denies
   cross-tenant reads at the engine. Procedure precedent:
   `LANE_A_DEV_DB_VERIFICATION.md`.

## Standing guardrails respected this session

Local/dev DB only; no production DB; no production deploy; no real payments;
no token transfers; no TOKEN-LAB-003; no GTM PR work; no COG-016 work; no
secrets printed. Freeze on new feature work held — this was verification.

## Open (unchanged, founder-gated)

Persistent dev-DB RLS run (above); default-branch flip to `main`; GTM PR #45
union + #44 closure; Tenant Zero recruitment; TOKEN-LAB-003 / counsel pack.
COG-016 stays parked; migration slot 0015 stays reserved.
