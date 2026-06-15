# V-6 Managed Postgres RLS — Ready-to-Run Harness Plan

Date: 2026-06-15. Status: **HARNESS SHIPPED + EXECUTED (PASS 25/25)**.

This supersedes the founder-gated `MANAGED_POSTGRES_RLS_VERIFICATION_PLAN.md`
(2026-06-13), which described the run but predated migration `0019` and shipped no
runnable harness. V-6 turns that plan into runnable code, **adds `fabric_nodes`
(0019) coverage**, and executes it against a real Postgres 16 server under a
non-superuser role. See `V6_RLS_LIVE_RUN_LOG.md` for the captured live run.

## Why

The single largest un-closed runtime risk is whether RLS holds on a **managed
Postgres under a restricted, non-superuser role**. RLS was otherwise only proven on
PGlite, whose default role is a superuser that _bypasses_ RLS. The only prior
non-superuser precedent (`packages/db/src/kysely.rls.pglite.test.ts`) covered just
migrations 0001–0004 on `accounts`. Nothing exercised the Agent Economy, the Proof
Registry's public/private split, or the Agent Fabric registry under a real
restricted role. V-6 closes that.

## Deliverables (in this repo)

- `scripts/dev/provision-dev-postgres.sh` — provision / drop a throwaway local
  Postgres 16 cluster (own data dir + port; dev-only, never production).
- `scripts/dev/verify-managed-rls.mjs` — fail-closed verification harness. Refuses
  to run without `CONFIRM_DEV_DB=true` + `DATABASE_URL`; refuses production-looking
  targets (`prod` / `moveros`); never prints the connection string.
- `scripts/dev/verify-managed-rls.guard.test.ts` — vitest proving the harness fails
  closed (runs in `pnpm check`; no DB required).
- `scripts/dev/verify-managed-rls.README.md` — operator runbook.

## RLS model (confirmed in migrations)

- Tenant context is a per-transaction GUC `app.current_tenant_id`, read by
  `app_current_tenant_id()` (0001). A trusted-job escape hatch `app.bypass_rls` is
  read by `app_bypass_rls()`.
- Every tenant table: `enable row level security` + **`force row level security`** +
  policy `using/with check (app_bypass_rls() or tenant_id = app_current_tenant_id())`.
  `force` is what makes the table owner also subject to RLS; only a superuser or a
  `BYPASSRLS` role escapes — hence the test must run as a plain non-superuser.
- The production path sets the GUC via `withTenant()` in `packages/db/src/client.ts`
  (`set_config('app.current_tenant_id', …, true)` — `SET LOCAL`, auto-reset on
  commit/rollback).
- Proofs (0009): `summary_public` (the only public-facing, redacted narrative),
  `details_private jsonb` (never public), `public_safe` (default false; requires
  `redaction_check_passed_at`), append-only via guard trigger. The **public-safe
  projection** is `summary_public` of `public_safe=true` rows only; the **private
  proof field** is `details_private`.
- Economy (0016/0017/0018): escrow release and the work-order `verified` transition
  require a `verified_fact` proof — enforced by a database trigger, not just the
  service layer. Positive `reputation_events` likewise require `verified_fact` (0010).
- Fabric (0019): `fabric_nodes` is tenant-scoped with `force row level security`;
  `status` ∈ `active | quarantined` is the per-node kill switch.

## Migration apply sequence (exact)

Applied in filename order (mirrors `apps/api/src/economySmoke.live.test.ts`):

```
0001 0002 0003 0004 0007 0009 0010 0011 0012 0013 0014 0016 0017 0018 0019
```

**0015 is intentionally absent** (reserved for the parked COG-016 field-provenance
branch). 0005/0006/0008 are skipped: campaigns / pgvector / credential ciphertexts
are not RLS-critical, and 0006 would require the `vector` extension. `create
extension` lines are stripped — `gen_random_uuid()` is core in PG13+.

## Restricted role (the actual test subject)

After migrations apply (as the owner/service role), create a real non-superuser:

```sql
create role app_user login nosuperuser;
grant usage on schema public to app_user;
grant select, insert, update, delete on all tables in schema public to app_user;
grant execute on all functions in schema public to app_user;
grant usage, select on all sequences in schema public to app_user;
```

The harness opens a **separate login connection** as `app_user` (stronger than
`set role`; it falls back to `set role app_user` if a separate login is refused by
`pg_hba`). On a hosted Supabase project the equivalent restricted principal is the
`authenticated`/`anon` role family; `app_user` is the portable form.

## What the harness asserts (mapped to the V-6 checklist)

1. **Economy smoke under the restricted role** — fund (double-entry ledger), open
   work order, reserve escrow, deliver with `verified_fact` proof, owner-verify →
   escrow released, reputation +3.
2. **Fabric registry RLS** — register a `fabric_nodes` row and quarantine it in-tenant.
3. **Tenant A cannot read tenant B** — with the app predicate REMOVED, cross-tenant
   `SELECT`/`UPDATE`/`INSERT` on `work_orders`, `proofs`, `marketplace_listings`,
   `fabric_nodes`, `credits_accounts` are denied by the engine (and with the GUC
   unset, nothing is visible).
4. **Public-safe projection remains redacted** — only `summary_public` of
   `public_safe=true` rows; `details_private` is never selected; private proofs are
   excluded.
5. **Private proof fields inaccessible** — tenant B cannot read tenant A's
   `details_private` even by id.
6. **In-tenant work order / escrow / reputation / fabric paths work** — proving the
   denials are RLS, not a broken grant.
7. **Control** — superuser sees both tenants, `app_user` sees only its own (proves
   the harness is in an enforced, non-bypass mode).

## How to run

See `scripts/dev/verify-managed-rls.README.md`. Summary:

```bash
DEV_URL="$(scripts/dev/provision-dev-postgres.sh up)"
CONFIRM_DEV_DB=true DATABASE_URL="$DEV_URL" \
  node scripts/dev/verify-managed-rls.mjs --apply-migrations
scripts/dev/provision-dev-postgres.sh down
```

To verify a hosted Supabase dev project instead, export its dev `DATABASE_URL` and
run the same harness command (no local cluster needed). **Never a production DB.**

## Result

Executed 2026-06-15 against PG16.13: **PASS, 25/25**, `app_user_mode:
separate-login`. Full log: `V6_RLS_LIVE_RUN_LOG.md`.

## Recommended next step

Re-run the identical harness once against a hosted Supabase **dev** `DATABASE_URL`
(the `Cognitia Preview` project, unpaused) to confirm the same result through
PgBouncer + the Supabase role family — the last managed-hosting nuance beyond the
engine-level guarantee this local run already established.
