# API-1 — Production API on Kysely + auth-derived tenant + RBAC

**Owner:** ENG-platform · **Risk:** High · **Effort:** ~3d · **Gate:** 0 (before any customer data)
**Deps:** none (unblocks CRM-1, UI-1, everything) · **Scope fence:** unaffected (no email).

## Objective

Replace the in-memory, header-trust API composition with the production
`KyselyRepository`, and derive `tenant_id` from the **authenticated principal**, not a
client header. This is the substrate gate — nothing persists or isolates correctly until it lands.

## Current reality (HEAD ea7677e)

- `apps/api/src/server.ts` → `buildHandlers()` constructs `InMemoryRepository`.
- Tenant is read from `request.headers['x-tenant-id']` (an **auth-bypass** — must change).
- `createPostgresRepository(DATABASE_URL)` already exists (`packages/db/src/factory.ts`); `pg` is an optional peer dep.

## Files likely to change

- `apps/api/src/server.ts` — build the prod composition from `createPostgresRepository`; pool lifecycle/shutdown.
- `apps/api/src/context.ts` _(new)_ — `RequestContext { tenantId, userRef, role, traceId }`; verify session/JWT → tenant + role.
- `apps/api/src/handlers.ts` — take `RequestContext`; stop reading `x-tenant-id` directly; enforce RBAC on approve/execute.
- `apps/api/package.json` — promote `pg` to a real dependency.
- `apps/api/src/*.test.ts` — run handlers over `KyselyRepository` (PGlite harness) instead of in-memory.

## Acceptance criteria

1. A forged/extra `x-tenant-id` header **cannot** change query scope (tenant from principal only).
2. All endpoints run on `KyselyRepository`; every call is `withTenant`-scoped.
3. RBAC: `viewer` cannot approve/execute; `operator`/`owner` can.
4. `GET /health` returns DB-up; 503 when DB down.
5. Mira run → approve → execute persists across a fresh process/connection.
6. Existing approval-flow tests pass against the production composition.

## Test plan

- Integration over PGlite (reuse `repository.contract.ts` harness): approval flow green on `KyselyRepository`.
- Auth: missing/invalid principal → 401; tenant A principal cannot read tenant B (RLS + predicate).
- RBAC matrix test (viewer/operator/owner).
- CI: tenant-isolation + idempotency tests promoted to **release gates**.

## Security notes

- No client-supplied tenant trust. Principal → tenant mapping is server-side only.
- API + worker run under the **non-superuser `app_user`** role (RLS enforced).
- Verify `SET LOCAL` tenant scoping holds under **pgBouncer transaction mode** before paying customers (see review-log B-2).

## Blockers

- **Auth provider decision** (magic-link/OIDC for V1; SAML deferred to AUTH-2). _Smallest next step:_ pick OIDC issuer + library; stub `verifySession()` returning `{ tenantId, userRef, role }`. **Blocks V1.**

## V1 vs post-V1

V1 (Gate 0). SAML/SCIM is post-V1 (AUTH-2, pre-GA).
