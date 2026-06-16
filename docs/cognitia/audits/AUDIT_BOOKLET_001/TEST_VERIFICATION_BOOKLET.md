# TEST / VERIFICATION BOOKLET — AUDIT-BOOKLET-001

`pnpm check` on main `313a82d` = **515 tests passed** across **78 test files**
(`git ls-files '*.test.ts'`). `pnpm check` = prettier + tsc + vitest.

> **Reconciliation update (AUDIT-BOOKLET-001B, 2026-06-15):** after PR #69 merged,
> current main is **525 tests / 80 files, green** (+10 / +2 from the Agent Fabric
> Lab). New coverage: `apps/api/src/agentFabric.test.ts` (register/validate; route
> rank + fail-closed; full loop route → simulate-execute → owner verify releases
> escrow + reputation; quarantine kill switch), `packages/core/src/agentFabric.guard.test.ts`
> (containment — no process/network imports or calls; simulation-labelled), a
> LEGEND-001 fabric-nodes case in `repository.contract.ts` (memory + PGlite), and
> the three migration-list references appended `0019_agent_fabric_nodes.sql`. The
> simulated execution path writes a `verified_fact` receipt proof but does **not**
> run real work and does **not** release escrow (the human `verify` still does).

> **Reconciliation update (V6A-DOCS-RECONCILE, 2026-06-15):** RLS was verified by
> the Postgres engine on a **real, local PostgreSQL 16** cluster under a
> **restricted, separate-login `app_user`** (`NOSUPERUSER`, `NOBYPASSRLS`) —
> tenant isolation held for economy, proofs, marketplace, and `fabric_nodes`. This
> is **stronger than PGlite** (whose default role is a superuser that bypasses
> RLS). **Hosted/managed-provider** verification (e.g. Supabase through PgBouncer)
> **remains pending / not yet verified**. The production database was not touched;
> this is **not** production-ready and **not** SOC 2 certified. The "remains
> unverified" table below is updated accordingly.

## Test-file distribution (by area)

- `apps/api/src` 44 (+1 redaction) — handlers, economy, disputes, marketplace,
  proofs, ATC, credits, reputation, skillproof, public trust feed (+server),
  rate limit, live economy smoke, etc.
- `packages/core/src` 6 (+events/policies/schemas) — incl. 5 guard tests
  (doctrine, researcherPack, apiSurfaces, visibilityDiscoverability, threatGovernance).
- `packages/db/src` 5 — incl. the shared repository contract run on memory AND
  PGlite, plus the Cognitia trust PGlite test.
- `packages/agents`, `packages/integrations` (HubSpot 7, email 1), `packages/evals`,
  `apps/web/src/app/trust` (+live) source-scan guards.

## What is verified by **unit / service** tests

Economy invariants (verified_fact-gated release/reputation; weak-proof refusal;
dispute refund/split), ATC lifecycle (revoked-terminal), SkillProof tiers, credits
double-entry + idempotency, redaction/public_safe, the public feed (deny-by-default,
projection-only, no enumeration, aggregate reputation, rate limit, cache headers).

## What is verified by **PGlite / runtime smoke**

- `repository.contract.ts` runs on **both** InMemoryRepository and KyselyRepository
  (PGlite) — production data-access behavior can't drift from the reference.
- `economySmoke.live.test.ts` applies real migrations to a live PGlite engine and
  runs the full loop: listing → work order → ledger accept → escrow reserve →
  deliver (simulated execution + proof) → verify → release + reputation; plus
  weak-proof refusal and dispute refund.

## What is verified by the **V-6A restricted-role Postgres run**

A separate verification applied the migrations to a **real, local PostgreSQL 16**
cluster and exercised tenant isolation under a **restricted, separate-login
`app_user`** (`NOSUPERUSER`, `NOBYPASSRLS`) — i.e. RLS enforced **by the engine**,
not bypassed. Cross-tenant denial held for `work_orders`, `proofs`,
`marketplace_listings`, `fabric_nodes`, and credits accounts (even with the
application's `tenant_id` predicate removed), and the public-safe projection
stayed redacted. This is **stronger than the PGlite smoke**, whose default role is
a superuser that bypasses RLS. It does **not** cover a **hosted/managed provider**
(e.g. Supabase through PgBouncer / the Supabase role family) — that remains **not
yet verified** — and it is **not** a production or production-readiness claim.

## What is verified by **guard / docs** tests

Doctrine guard (no token/coin/staking routes or marketing literals in `apps/web`;
no `did:cognitia`/"agent passport" in code); researcher-pack, api-surfaces,
discoverability, and threat/governance doc guards (docs exist, keep caveats, carry
no purchase CTA / price-return / DEX-yield marketing).

## What remains **unverified** (honest gaps)

| Gap                                                       | Severity | Why                                                       |
| --------------------------------------------------------- | -------- | --------------------------------------------------------- |
| Hosted/managed-provider RLS (e.g. Supabase via PgBouncer) | P1       | not yet verified; the V-6A run used a real **local** PG16 |
| Production deployment / uptime / scale                    | P1       | not deployed; smoke ≠ production                          |
| External security audit                                   | P1       | none performed                                            |
| Real-payment / token paths                                | n/a      | intentionally absent (nothing to verify)                  |
| Edge WAF / rate limiting                                  | P2       | in-process secondary only                                 |

Restricted-role RLS under a `nosuperuser` `app_user` on a real local PostgreSQL 16
is **verified (V-6A)**; the remaining gap is the **hosted/managed provider**.

The test suite proves **logic + isolation-in-code + the economy loop on a real
engine**, and the V-6A run proves **engine-level restricted-role RLS on a real
local Postgres** — together they still do not prove production readiness,
**hosted/managed-provider** RLS, or third-party-audited security.
