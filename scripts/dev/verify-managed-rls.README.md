# V-6 Managed Postgres RLS Verification Harness

Prove that Row-Level Security (RLS) is **genuinely enforced by the Postgres engine
under a restricted, non-superuser role** — the assurance PGlite cannot give, since
its default role is a superuser that _bypasses_ RLS.

This directory contains:

- `provision-dev-postgres.sh` — stand up / tear down a throwaway local Postgres 16
  cluster (its own data dir + port; holds only seeded test rows).
- `verify-managed-rls.mjs` — the fail-closed verification harness.
- `verify-managed-rls.guard.test.ts` — vitest proving the harness refuses to run
  without an explicit dev acknowledgement (runs in `pnpm check`; no DB needed).

## The no-production rule (hard)

This harness runs **only** against a dedicated dev / throwaway database. It will
**refuse** to run unless:

- `CONFIRM_DEV_DB=true` is set (explicit operator acknowledgement), **and**
- `DATABASE_URL` is set.

It refuses outright if the host or database name contains `prod` or `moveros`
(the documented `public.leads` collision app). The connection string is **never**
printed. No deploy, no secrets, never a production database.

## Run it (local throwaway cluster)

```bash
# 1. provision a throwaway PG16 cluster (prints a localhost DATABASE_URL, no secret)
DEV_URL="$(scripts/dev/provision-dev-postgres.sh up)"

# 2. run the verification (applies migrations 0001–0019, minus the absent 0015)
CONFIRM_DEV_DB=true DATABASE_URL="$DEV_URL" \
  node scripts/dev/verify-managed-rls.mjs --apply-migrations

# 3. tear the cluster down (destroys all data)
scripts/dev/provision-dev-postgres.sh down
```

## Run it (a managed dev DATABASE_URL you provide)

```bash
export DATABASE_URL='postgres://…'   # a DEV/throwaway managed DB; never production
pnpm add -w pg                        # if not already installed
CONFIRM_DEV_DB=true node scripts/dev/verify-managed-rls.mjs --apply-migrations
```

If migrations are already applied, omit `--apply-migrations`.

## What it does

1. **Applies migrations** `0001–0004, 0007, 0009–0014, 0016–0019` (mirrors
   `apps/api/src/economySmoke.live.test.ts`; **0015 is absent/reserved**; 0005/0006/0008
   are skipped — campaigns / pgvector / credential ciphertexts are not RLS-critical).
2. **Creates a restricted role** `app_user` (`login nosuperuser`) with table/function/
   sequence grants, and opens a **separate login connection** as that role (falls back
   to `set role app_user` if a separate login is refused). Either way the principal is
   non-superuser, so RLS is enforced.
3. **Seeds two tenants** A and B as the owner (superuser bypass), then runs every
   assertion as `app_user`:
   - **control** — superuser sees both tenants, `app_user` sees only its own (proves
     we are in an enforced, non-bypass mode);
   - **economy smoke** — fund (double-entry ledger), open work order, reserve escrow,
     deliver with a `verified_fact` proof, owner-verify → escrow released, reputation +3;
   - **negative paths** — a `likely_inference` proof cannot release escrow and cannot
     grant positive reputation (DB triggers refuse);
   - **fabric registry (0019)** — register a `fabric_nodes` row and quarantine it
     in-tenant;
   - **cross-tenant isolation** — with the app predicate REMOVED, tenant A cannot
     `SELECT`/`UPDATE`/`INSERT` tenant B rows in `work_orders`, `proofs`,
     `marketplace_listings`, `fabric_nodes`, `credits_accounts` (and with the tenant
     GUC unset, nothing is visible);
   - **public-safe projection** — the public projection returns only `summary_public`
     of `public_safe=true` rows and never `details_private`; private proofs are
     excluded; tenant B cannot read tenant A's private proof fields.

Output: `SMOKE>` / `RLS>` / `FABRIC>` lines, then a `SUMMARY {…}` JSON line with
`passed`, `failed`, `app_user_mode`, and `result`. Exit code is non-zero on any
failed assertion or refused guard.

See `docs/cognitia/execution/V6_RLS_HARNESS_READY_PLAN.md` for the full plan and
`docs/cognitia/execution/V6_RLS_LIVE_RUN_LOG.md` for a captured live run.
