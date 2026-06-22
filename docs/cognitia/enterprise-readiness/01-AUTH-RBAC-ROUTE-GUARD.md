# 01 — Auth / RBAC Route Guard

**Model:** `packages/enterprise-readiness/src/rbac.ts`
**Tests:** `src/rbac.test.ts`

## Goal

A deny-by-default, tenant-scoped, fail-closed authorization core that route
guards (middleware / server actions / edge handlers) call. The policy is pure
(no I/O); wiring it into the live app is an integration task.

## Model

- **Roles** (least → most privileged): `viewer`, `operator`, `approver`,
  `admin`, `owner`.
- **Capabilities** are the unit of authorization. Routes *require* capabilities;
  roles *grant* them. Read capabilities are separated from `*.live` / `*.write`.
- **Live capabilities** (`action.live`, `connectors.configure`,
  `release.gate.override`) are privilege-sensitive and **dark** in mock-safe mode.
- **Route guard table** (`ROUTE_GUARDS`) maps path → required capability. Any
  path not in the table is denied (`route_not_registered`).

## Decision order (`evaluateAccess`)

1. **Cross-tenant** → `cross_tenant_denied`. There is no implicit/global tenant.
2. **Unregistered route** → `route_not_registered` (deny-by-default).
3. **Missing capability** → `missing_capability:<cap>`.
4. **Live capability while mock-safe** → `live_capability_dark:<cap>`, even for
   `owner`. This is the fail-closed gate that keeps live actions dark.
5. Otherwise → `allow`.

## Integration plan (when live app is in scope)

1. Load the principal (`tenant_id`, `role`) from the authenticated session.
2. At the route boundary, call `evaluateAccess({ principal, resource_tenant_id, path })`.
3. On `allow:false`, emit `authz.access.denied.v1` (see #02) and return 403.
4. On `allow:true`, emit `authz.access.granted.v1` for live-capability routes only
   (avoid audit noise on reads).
5. Keep `ROUTE_GUARDS` the single source of truth; never inline ad-hoc checks.
6. Role changes emit `authz.role.changed.v1` and require `admin`+ plus an audit
   trail.

## Invariants under test

- granted read route allows; cross-tenant denies;
- unregistered route denies (deny-by-default);
- role lacking a capability denies;
- `owner` holds every capability statically, yet live capabilities stay dark in
  mock-safe mode.
