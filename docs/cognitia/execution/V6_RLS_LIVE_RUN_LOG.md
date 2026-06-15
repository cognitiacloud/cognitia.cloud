# V-6 Managed Postgres RLS — Live Run Log

Date: 2026-06-15. Status: **EXECUTED — PASS (25/25)**.

The V-6 verification was run for real this session against a throwaway **PostgreSQL
16.13** server (not PGlite), under a genuine **non-superuser `app_user` login role**
on its own connection (`app_user_mode: separate-login`). This is the assurance PGlite
cannot give: its default role is a superuser that bypasses RLS.

## Environment

- Server: PostgreSQL 16.13 (Ubuntu), throwaway cluster `16/v6dev` on `127.0.0.1:55432`,
  database `cognitia_v6_dev`, provisioned by `scripts/dev/provision-dev-postgres.sh up`.
- It is unmistakably a dev/throwaway: fresh `initdb`, isolated data dir + port, holds
  only the harness's seeded test rows. No production data, no secrets, no deploy.
- Harness: `scripts/dev/verify-managed-rls.mjs --apply-migrations`, guarded by
  `CONFIRM_DEV_DB=true`. Connection string never printed.

## Migrations applied

`0001–0004, 0007, 0009–0014, 0016, 0017, 0018, 0019` — **0015 is absent/reserved**
(parked COG-016 field-provenance), 0005/0006/0008 skipped (campaigns / pgvector /
credential ciphertexts; not RLS-critical). `0019_agent_fabric_nodes.sql` IS included.

## Result

All 25 assertions passed under the restricted role. Verbatim run output:

```
SMOKE> migration 0001_tenants_users.sql applied
SMOKE> migration 0002_integrations_external_maps.sql applied
SMOKE> migration 0003_gtm_entities.sql applied
SMOKE> migration 0004_events_agent_runs_actions.sql applied
SMOKE> migration 0007_evals_experiments.sql applied
SMOKE> migration 0009_cognitia_trust_core.sql applied
SMOKE> migration 0010_skillproof_reputation.sql applied
SMOKE> migration 0011_moveros_lead_rescue.sql applied
SMOKE> migration 0012_credits_wallet.sql applied
SMOKE> migration 0013_skillproof_frontdesk_ext.sql applied
SMOKE> migration 0014_wallet_binding_deactivate.sql applied
SMOKE> migration 0016_agent_economy.sql applied
SMOKE> migration 0017_dispute_resolution.sql applied
SMOKE> migration 0018_marketplace_listings.sql applied
SMOKE> migration 0019_agent_fabric_nodes.sql applied

== control: enforcement is real ==
  ok   superuser sees both tenants (RLS bypass control)
  ok   app_user sees ONLY tenant A proofs (RLS enforced)

== economy smoke under app_user (tenant A) ==
SMOKE> funded requester via double-entry ledger
SMOKE> work order opened + escrow reserved
  ok   verified_fact proof releases escrow (status=verified)
  ok   escrow released
SMOKE> reputation +3 recorded against verified_fact proof
  ok   in-tenant reputation event visible

== negative paths (engine refuses unproven payouts) ==
  ok   likely_inference proof CANNOT release escrow (trigger refuses)
  ok   likely_inference proof CANNOT grant positive reputation

== fabric registry (0019) under app_user (tenant A) ==
  ok   in-tenant fabric node insert + quarantine works
FABRIC> node debcfda7 registered and quarantined in-tenant

== cross-tenant isolation: tenant A cannot read tenant B ==
  ok   A cannot SELECT tenant B row in work_orders (0 rows)
  ok   A cannot SELECT tenant B row in proofs (0 rows)
  ok   A cannot SELECT tenant B row in marketplace_listings (0 rows)
  ok   A cannot SELECT tenant B row in fabric_nodes (0 rows)
  ok   A cannot SELECT tenant B row in credits_accounts (0 rows)
  ok   with tenant unset, work_orders returns 0 rows
  ok   with tenant unset, proofs returns 0 rows
  ok   with tenant unset, marketplace_listings returns 0 rows
  ok   with tenant unset, fabric_nodes returns 0 rows
  ok   with tenant unset, credits_accounts returns 0 rows
  ok   A cannot UPDATE tenant B fabric node (0 rows affected)
  ok   A cannot INSERT a row for tenant B (WITH CHECK violation)
RLS>   cross-tenant reads + writes denied by the engine, predicate removed

== public-safe projection + private proof fields ==
  ok   public projection returns only the public_safe proof
  ok   public projection narrative is the redacted summary_public
  ok   public projection NEVER includes details_private (column not selected)
  ok   private (public_safe=false) proof is excluded from the public projection
  ok   tenant B cannot read tenant A private proof fields (0 rows)
RLS>   public-safe projection redacted; private proof fields engine-protected
SUMMARY {"harness":"verify-managed-rls","app_user_mode":"separate-login","migrations_applied":true,"passed":25,"failed":0,"failures":[],"result":"PASS"}
```

## Interpretation

- **RLS is real under a restricted role.** The control assertion proves the harness
  is in an enforced (non-bypass) mode: the superuser sees both tenants, `app_user`
  sees only its own. Every cross-tenant probe ran with the application `where
tenant_id` predicate REMOVED, so the engine — not the query builder — is what
  returns zero rows.
- **`fabric_nodes` (0019) is correctly isolated** and the quarantine kill switch
  works in-tenant; tenant A cannot read or mutate tenant B's node.
- **The economy doctrine holds at the engine level:** only a `verified_fact` proof
  releases escrow and grants positive reputation; `likely_inference` is refused by
  database triggers even under a role that has full DML grants.
- **Public-safe projection stays redacted** (only `summary_public` of `public_safe`
  rows) and **private proof fields (`details_private`) are inaccessible** across
  tenants.

## Teardown

`scripts/dev/provision-dev-postgres.sh down` drops the throwaway cluster. The cluster
exists only for the duration of a verification session.

## Caveats

- This is a **local** managed-style PG16 server, which closes the engine-level
  non-superuser RLS risk. A hosted Supabase project additionally layers the
  `authenticated`/`anon` role family and PgBouncer; `app_user` is the portable
  equivalent. Re-running this harness against a hosted dev `DATABASE_URL` (same
  command) is the recommended final confirmation before relying on Supabase RLS.
