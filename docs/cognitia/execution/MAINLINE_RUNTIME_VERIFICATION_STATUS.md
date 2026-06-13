# Mainline Runtime Verification Status

Date: 2026-06-13. Owner: Claude (runtime). This is the single source of truth
for what the merged economy mainline has been proven to do at RUNTIME (not
just in unit tests) and what remains unproven.

## Final main commit

`6f4c297` — Merge of PR #56 (ECONOMY-SMOKE-001) into `main`. Lineage:
`#48 → #49 → #51 → #52 → #53 → #55` (economy + crypto-docs stack) →
`#56` (live runtime smoke). Working tree clean.

## Test result

`pnpm check` on `6f4c297`: **443/443 tests, 68 files, green**
(format:check + typecheck + vitest). Baseline before the smoke harness was
438/438; the live smoke added 5 cases.

## Migrations verified locally (PGlite real-Postgres engine)

Applied in order and confirmed via `information_schema`:

| Migration                          | Status                                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 0001–0004, 0007                    | applied                                                                                                 |
| 0009, 0010, 0011, 0012, 0013, 0014 | applied                                                                                                 |
| **0015**                           | **ABSENT — reserved for parked COG-016** (`field_provenance` table confirmed not present)               |
| **0016** (agent economy)           | applied — `work_orders`, `skill_execution_orders`; `credits_accounts.owner_type='escrow'` widening live |
| **0017** (dispute resolution)      | applied — `dispute_resolutions`                                                                         |
| **0018** (marketplace listings)    | applied — `marketplace_listings`                                                                        |

The chain applies cleanly with 0015 skipped — no dependency on the reserved slot.

## Smoke paths verified (live, via production ApiHandlers + KyselyRepository)

1. **Happy path** — listing → order-from-listing → Action-Ledger accept ask
   → approve → execute (escrow reserved exactly once; re-execute 409) →
   deliver (simulated execution mints a `verified_fact` proof) → owner verify
   → escrow released to worker → reputation +3.
2. **Marketplace** — `visibility='internal'` enforced; tier-aware
   `match_score = tier*1000 + reputation*10 + verified_orders` (=2031 live);
   `eligible_for_verified_work` at tier ≥ 2.
3. **Negative path** — `likely_inference` and `unknown` delivery proofs
   cannot release escrow (409); escrow stays reserved; zero reputation.
4. **Dispute path** — escrow held → operator arbitration 403 → owner refund
   → resolved, requester fully refunded, resolution proof, worker −2,
   `economy.work_order.resolved.v1` audit.
5. **Tenant isolation** — tenant B sees none of tenant A's economy rows.

Harness: `apps/api/src/economySmoke.live.test.ts`. Raw output:
`ECONOMY_SMOKE_001_RUNTIME_LOG.md`. Full result: `ECONOMY_SMOKE_001_REPORT.md`.

## What IS runtime-verified

- The full economy state machine executes end-to-end against a real Postgres
  engine through the production handler + repository code (not mocks).
- DB-level invariants enforced by real Postgres: verified_fact-only escrow
  release (0016 trigger), dispute conservation + resolved-terminal (0017),
  marketplace internal-visibility + yank guard (0018), tier ≥ 2 requires
  verified_fact skill proof (0013), append-only proofs/ledger.
- Escrow conservation (reserve-once, release, refund) on the internal rail;
  the only transfer route is `/credits/transfer`.
- Reputation movement is verified_fact-gated (0010) and tenant-scoped.
- Guardrails on the merged surface: no public token/coin/buy/sell/pricing/
  dex/liquidity/staking/yield/swap/payout/withdraw routes; marketplace/
  listing routes only under authed `/agent-economy/`; no public web pages;
  doctrine + SkillProof no-marketplace tests pass.
- Repository-layer tenant isolation (explicit `tenant_id` predicates +
  `withTenant` GUC) holds on the real engine.

## What remains UNVERIFIED

- **Engine-level RLS under a restricted (non-superuser) role on a persistent
  managed Postgres.** Not yet proven against a hosted DB in the economy loop.
- Durability / connection-pool behavior on a long-lived managed instance
  (PGlite is in-process and ephemeral).
- Any production deployment (out of scope; founder-gated).

## Exact RLS caveat

> **PGlite / local smoke verifies runtime LOGIC but does NOT prove
> engine-level RLS under a restricted managed Postgres role.** PGlite's
> default session role is a superuser, which BYPASSES row-level security.
> The dedicated `packages/db/src/kysely.rls.pglite.test.ts` harness proves
> RLS policies are correctly written by switching to a `nosuperuser`
> `app_user` role, but that is a schema-policy test — it is NOT the merged
> economy loop running end-to-end under a restricted role on a hosted
> Postgres. Closing that gap is `MANAGED_POSTGRES_RLS_VERIFICATION_PLAN.md`
> (founder-gated: requires a persistent dev DB).
