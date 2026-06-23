# Tenant Isolation Checklist

> **STATUS: MOCK / SANDBOX.** Drillable checklist over the existing tenant
> isolation primitives. The invariants below are proven against PGlite in CI;
> production enforcement (a non-superuser DB role on managed Postgres) is a
> deploy-time step, not a claim made here.

Source:

- `packages/db/src/kysely.rls.pglite.test.ts`, `closer.rls.pglite.test.ts`,
  `kysely.pglite.test.ts` (tenant-isolation cases).
- `packages/db/fixtures/tenant_isolation.fixture.sql`,
  `0001_tenants_users.fixture.sql`.
- `packages/db/migrations/0001_tenants_users.sql`.
- `docs/cognitia/TENANT_MAP.md`; control-matrix AC-1/AC-5/AU-1.

## Invariants (must all hold)

- [ ] **RLS is FORCED** on every tenant-scoped table (owner cannot bypass).
- [ ] Every request sets the tenant via `withTenant` → `SET LOCAL` for the
      transaction; no query runs without a tenant context.
- [ ] Tenant is **server-derived** from the session principal, never from a
      client header (`x-tenant-id` is not trusted).
- [ ] The app connects as a **non-superuser** role (`app_user`); superuser /
      `BYPASSRLS` is never used by the app path.
- [ ] No `app.bypass_rls` (or equivalent) escape hatch is reachable in normal
      operation; any use is logged and alertable (see incident-response SEV-1).
- [ ] Cross-tenant read returns **zero rows** (proven: "tenant A rows are
      invisible to tenant B").
- [ ] Cross-tenant write is rejected / scoped (kill-switch and connection-status
      updates are tenant-scoped — ENF-1).
- [ ] Idempotency keys are unique **per tenant** `(tenant, idempotency_key)`.
- [ ] Events/audit rows carry `tenant_id`; exports are tenant-scoped.

## Pre-deploy gate (production)

- [ ] Confirm the managed-Postgres app role is non-superuser and `FORCE ROW LEVEL SECURITY` is set on all tenant tables (see `docs/cognitia/execution/MANAGED_POSTGRES_RLS_VERIFICATION_PLAN.md`).
- [ ] Run the RLS test suite against the target DB; attach the run as evidence
      (control-matrix AC-1).
- [ ] Verify no migration grants the app role `BYPASSRLS`.

## On suspected breach

Treat as SEV-1 (`docs/runbooks/incident-response.md`): preserve
`events`/`audit_events`, run the isolation tests to scope exposure, confirm
`app_user` was in effect, then follow the breach-comms timeline.
