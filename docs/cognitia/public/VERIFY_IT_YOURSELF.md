# Verify It Yourself

Cognitia's central claim is that its evidence is **reproducible**. You do not have
to trust this repo's descriptions — you can run the suite and the runtime smoke
yourself. No production database, no secrets, and no network services are required.

## Prerequisites

- Node.js (version per the repo's `.nvmrc` / `package.json` engines) and
  [pnpm](https://pnpm.io/).
- No database to install: the contract + smoke tests run against **PGlite**, an
  in-process Postgres (WebAssembly). No `DATABASE_URL` needed.

## Steps

```bash
git clone https://github.com/cognitiacloud/cognitia.cloud
cd cognitia.cloud
pnpm install
pnpm check        # format check + typecheck + full test suite
```

## Expected result

- **490 tests pass across 74 test files** (the count at the time of writing; it
  grows as features land — expect "all green," and check the latest CI on `main`).
- `pnpm check` runs prettier (format), `tsc` (typecheck), and `vitest` (tests).

## The runtime smoke test

- File: `apps/api/src/economySmoke.live.test.ts`.
- It applies the real SQL migrations to a live PGlite Postgres engine and runs the
  **full Agent Economy loop**: listing → work order → Action-Ledger accept
  (approval-required) → escrow reserved once → delivery with a `verified_fact`
  proof → release + reputation on verify → weak-proof refusal → dispute → refund.

### What the smoke proves

- The economy invariants hold against a **real Postgres engine** (not just mocks):
  escrow releases and positive reputation move **only** on a `verified_fact`
  proof; weak evidence moves nothing; disputes refund.

### What it does NOT prove

- It does **not** prove production readiness, uptime, or scale.
- The PGlite smoke runs as a database **superuser**, which **bypasses row-level
  security** — so the smoke **alone** does not prove engine-level RLS under a
  restricted role. A **separate V-6A run** on a **real, local PostgreSQL 16**
  cluster, under a restricted `nosuperuser` `app_user`, **did** verify engine-level
  RLS (see the caveat below). Verification on a **hosted/managed provider**
  remains a tracked, separate step.

## Migration chain

- Applied/verified locally: **0001–0014** and **0016–0018**.
- **0015 is reserved/absent** — intentionally held for a separate deferred
  workstream; it is not part of the current verified chain.

## Postgres RLS verification status

Tenant isolation is enforced by Postgres row-level security via a per-transaction
GUC plus redundant `tenant_id =` predicates, and is exercised by the contract
tests. The PGlite smoke runs as a superuser that **bypasses RLS**, so PGlite alone
cannot prove restricted-role enforcement.

A **separate V-6A run** closed that gap on a **real, local PostgreSQL 16** cluster:
RLS was verified **by the engine** under a **separate-login `app_user`** that is
`NOSUPERUSER` and `NOBYPASSRLS`. Cross-tenant denial held for the economy, proofs,
marketplace, and `fabric_nodes` (even with the application `tenant_id` predicate
removed), and the public-safe projection stayed redacted. The production database
was not touched, and this is **not** a production-ready or SOC 2 claim.

What remains: verification on a **hosted/managed provider** (e.g. Supabase through
PgBouncer / the Supabase role family) is **not yet verified**. A ready-to-run plan
exists (`docs/cognitia/execution/MANAGED_POSTGRES_RLS_VERIFICATION_PLAN.md`); the
hosted run is pending a dedicated hosted/managed dev database.

## No production DB requirement

Everything above runs locally with the in-process engine. You never need a
production database, a managed Postgres, or any secret to reproduce the evidence.
