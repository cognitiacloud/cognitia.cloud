# Managed Postgres RLS Verification Plan (founder-gated)

Date: 2026-06-13. Status: **READY TO RUN — BLOCKED on a persistent dev DB.**
No persistent dev DB connection is available in this environment (no
`DATABASE_URL`/`PG*`/Supabase dev URL present; the `Cognitia Preview` project
is paused and restore was previously permission-denied). Per instruction this
plan is produced ready-to-run; it was **not** faked or partially executed.

## Purpose

Close the one runtime gap in `MAINLINE_RUNTIME_VERIFICATION_STATUS.md`: prove
that the merged economy loop enforces **row-level security at the Postgres
engine under a restricted, non-superuser role** on a persistent managed
Postgres — the assurance PGlite cannot give (its default role is a superuser
that bypasses RLS).

## No-production rule (hard)

This runs ONLY against a dedicated **dev** database. Never a production DB,
never a database holding real customer data, never the `moveros-staging`
project (separate app, `public.leads` collision — documented). No deploy. No
secrets printed (connection string stays in the environment, never echoed).

## Required environment

- A persistent **dev** Postgres (Supabase `Cognitia Preview` unpaused, or any
  throwaway Postgres 16 instance) reachable as `DATABASE_URL`.
- `DATABASE_URL` exported to the session (a SERVICE/owner role for the apply
  step — it must be able to create roles, tables, triggers, policies).
- `pg` driver installed for the migration runner (dev-only, optional peer):
  `pnpm add -w pg`.

## Required non-superuser role (the actual test subject)

After migrations apply (as the service role), create a restricted role that
**does not** bypass RLS, mirroring the proven precedent in
`packages/db/src/kysely.rls.pglite.test.ts`:

```sql
create role app_user nosuperuser nologin;          -- or WITH LOGIN PASSWORD for a separate connection
grant usage on schema public to app_user;
grant select, insert, update, delete on all tables in schema public to app_user;
grant execute on all functions in schema public to app_user;
-- future tables (defensive):
alter default privileges in schema public grant select, insert, update, delete on tables to app_user;
```

The economy loop is then exercised **as `app_user`** (either a dedicated
login role on its own connection, or `set role app_user` per transaction),
with the tenant GUC set exactly as the repository does:
`set app.current_tenant_id = '<tenant-uuid>'` (this is what `withTenant`
issues). On a hosted Supabase project, the equivalent restricted principal is
the `authenticated`/`anon` role family; `app_user` is the portable form.

## Migration apply sequence (exact)

The runner `packages/db/scripts/apply-migrations.mjs`
(`pnpm --filter @cognitia/db migrate`) applies every `*.sql` in
`packages/db/migrations/` in filename order. On `main @ 6f4c297` that is
exactly:

```
0001_tenants_users
0002_integrations_external_maps
0003_gtm_entities
0004_events_agent_runs_actions
0005_campaigns_sequences_touchpoints
0006_signals_playbooks_embeddings        (needs pgvector; see blockers)
0007_evals_experiments
0008_credential_ciphertexts
0009_cognitia_trust_core
0010_skillproof_reputation
0011_moveros_lead_rescue
0012_credits_wallet
0013_skillproof_frontdesk_ext
0014_wallet_binding_deactivate
0016_agent_economy
0017_dispute_resolution
0018_marketplace_listings
```

**0015 is intentionally absent** (reserved for the parked COG-016
field-provenance branch) and is therefore skipped automatically — there is no
file to apply. If only the economy-critical subset is desired (matching the
smoke harness), apply: 0001–0004, 0007, 0009–0014, 0016, 0017, 0018.

Verify post-apply (as service role):

```sql
select table_name from information_schema.tables where table_schema='public'
  and table_name in ('work_orders','skill_execution_orders','dispute_resolutions','marketplace_listings');
-- expect 4 rows
select to_regclass('public.field_provenance');   -- expect NULL (0015 absent)
select relname, relrowsecurity, relforcerowsecurity from pg_class
  where relname in ('work_orders','skill_execution_orders','dispute_resolutions','marketplace_listings','credits_accounts');
-- expect relrowsecurity = t (RLS enabled) on each
```

## Exact smoke loop to rerun (under `app_user`)

Re-run the economy loop already proven on PGlite, but bound to the restricted
role + a real `DATABASE_URL`. Adapt `apps/api/src/economySmoke.live.test.ts`
to connect via `pg`/Kysely PostgresDialect using `DATABASE_URL` and run every
data operation through a connection authenticated as `app_user` (RLS active):

1. Seed two tenants A and B (service role).
2. As `app_user` with `app.current_tenant_id = A`:
   register requester + worker agents (+ worker ATC + accept/deliver/dispute
   permissions); open credits accounts; fund requester (internal credits);
   create skill + tier-2 verified version; create internal marketplace
   listing; order-from-listing; file + approve + execute the accept ask
   (escrow reserved once); deliver (verified_fact proof); owner verify
   (escrow released + reputation +3).
3. Negative path: deliver with `likely_inference`/`unknown` proof → verify
   refused (409); escrow stays reserved; zero reputation.
4. Dispute path: dispute → escrow held → owner refund → resolved + refund +
   resolution proof + reputation −2.
5. **RLS assertions (the point of this run):** as `app_user` with
   `app.current_tenant_id = B`, attempt to read tenant A's `work_orders`,
   `marketplace_listings`, `credits_accounts`, `proofs` → must return **zero
   rows** (engine-enforced, not app-predicate-enforced). Repeat with the GUC
   unset → must also return zero rows for any tenant.

## Expected pass/fail criteria

PASS when, under the non-superuser `app_user` role:

- All 0016/0017/0018 tables report `relrowsecurity = true`.
- Every cross-tenant read returns zero rows **with the app-layer `where
tenant_id` predicate removed** (proving the ENGINE blocks it, not just the
  query builder). A direct `select * from work_orders` while
  `app.current_tenant_id = B` returns only B's rows.
- The full happy/negative/dispute economy loop completes with identical
  outcomes to the PGlite smoke (escrow conservation, verified_fact gating,
  reputation deltas, dispute refund).
- No statement succeeds that the superuser-bypass PGlite run let slip.

FAIL (investigate, do not proceed) when:

- Any cross-tenant row is visible under `app_user` → RLS policy gap.
- The economy loop errors under the restricted role due to a missing GRANT
  (fix grants, not policies) — re-run.
- Any migration fails to apply on real Postgres (capture the SQL error).

## Commands (repo conventions)

```bash
# dev DB only — never production
export DATABASE_URL='postgres://…'     # provided by founder; never printed/committed
pnpm add -w pg                          # migration runner's optional peer
pnpm --filter @cognitia/db migrate      # applies all migration files in order
# then create app_user + grants (SQL above) and run the adapted smoke under it
```

A small Node harness (mirroring `economySmoke.live.test.ts` but with a
`pg`-backed Kysely `PostgresDialect` + a second `app_user` connection) is the
deliverable of the run; it should emit the same `SMOKE>` lines plus explicit
`RLS>` assertions for the cross-tenant denials.

## Blockers (current)

1. **No persistent dev DB** — no `DATABASE_URL`/`PG*` env; `Cognitia Preview`
   paused, restore previously permission-denied. **Founder action:** unpause
   it or provide a throwaway dev `DATABASE_URL`.
2. **`pg` not installed** — trivial (`pnpm add -w pg`), but a dependency add;
   defer until the DB exists so it lands with the run, not speculatively.
3. **0006 needs the `pgvector` extension** — managed Supabase has it
   (`create extension vector`); a bare Postgres needs it installed, or apply
   the economy-critical subset (skip 0005/0006/0008) which is sufficient for
   this RLS verification.

## Status

**Founder-gated.** Ready to execute the moment a dev `DATABASE_URL` is
provided. Nothing in this plan touches production; nothing was run against a
real DB this session.
