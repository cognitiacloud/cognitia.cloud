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
- It runs as a database **superuser**, which **bypasses row-level security** — so
  it does **not** prove engine-level RLS under a restricted (non-superuser) role
  on a managed Postgres. That verification is a tracked, separate step (see the
  managed-Postgres RLS caveat below).

## Migration chain

- Applied/verified locally: **0001–0014** and **0016–0018**.
- **0015 is reserved/absent** — intentionally held for a separate deferred
  workstream; it is not part of the current verified chain.

## Managed-Postgres RLS caveat

Tenant isolation is enforced by Postgres row-level security via a per-transaction
GUC plus redundant `tenant_id =` predicates, and is exercised by the contract
tests. However, the local engine runs as a superuser that **bypasses RLS**, so
RLS under a restricted `nosuperuser` role on a managed database is **not yet
verified**. A ready-to-run plan exists
(`docs/cognitia/execution/MANAGED_POSTGRES_RLS_VERIFICATION_PLAN.md`); it is
pending a dedicated dev database.

## No production DB requirement

Everything above runs locally with the in-process engine. You never need a
production database, a managed Postgres, or any secret to reproduce the evidence.
