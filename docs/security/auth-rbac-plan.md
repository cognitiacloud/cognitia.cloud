# Auth / RBAC Plan

> **STATUS: MOCK / SANDBOX.** Describes the LOCAL, in-memory auth/RBAC
> primitives used for tests and demos, plus the PLANNED path to a real identity
> provider. There is no production auth provider, no live secret, and no live
> enforcement wired here. Going live remains blocked behind legal + customer +
> founder sign-off.

Source:

- `apps/api/src/auth.ts` — session principal derivation (`HmacSessionVerifier`).
- `packages/agents/src/security/permissionModel.ts` — roles, permissions, `can()`/`assertCan()`.
- `packages/agents/src/security/releaseGate.ts` — stage gating beyond RBAC.
- Tests: `serverAuth.test.ts`, `killSwitch.test.ts`, `permissionModel` tests.
- Control rows: `docs/security/control-matrix.md` AC-1…AC-5.

## Principles

1. **Server-derived identity, never client-trusted.** Tenant + role come from a
   verified session principal (`HmacSessionVerifier`), **not** from headers such
   as `x-tenant-id`. Missing/invalid `SESSION_SECRET` ⇒ fail closed (deny).
2. **Least privilege.** Roles map to the minimum permission set required.
3. **Fail closed.** Unknown role or unknown permission ⇒ `can()` returns
   `false` / `assertCan()` throws `PermissionDeniedError`.
4. **RBAC is necessary, not sufficient.** `configure_live_connector` permits
   configuration but the release gate (`releaseGate.ts` /
   `closer/automationReleaseGate.ts`) still blocks any live progression.

## Role → permission matrix (current, mock-safe)

Permissions: `view_lead`, `view_proof`, `reject_action`, `approve_action`,
`configure_live_connector`.

| Role     | view_lead | view_proof | reject_action | approve_action | configure_live_connector |
| -------- | :-------: | :--------: | :-----------: | :------------: | :----------------------: |
| viewer   |     ✓     |     ✓      |       –       |       –        |            –             |
| operator |     ✓     |     ✓      |       ✓       |       –        |            –             |
| approver |     ✓     |     ✓      |       ✓       |       ✓        |            –             |
| admin    |     ✓     |     ✓      |       ✓       |       ✓        |            ✓             |

## Enforcement points

- **API**: every mutating handler resolves the principal, then `assertCan(role,
permission)` before any state change; tenant is bound via `withTenant` (see
  tenant-isolation checklist).
- **DB**: RLS forced for defense-in-depth even if an app-layer check is missed.
- **UI**: the approvals surface (`apps/web/src/app/approvals/`) reflects, but
  does not enforce, permissions — enforcement is server-side only.

## Planned (blocked / PLANNED — AC-4)

- Real auth provider: OIDC / magic-link for V1; **MFA** required for privileged
  roles.
- Enterprise SSO: **SAML**; user lifecycle via **SCIM**.
- Session hardening: short-lived tokens, rotation, server-side revocation on
  incident (ties to `docs/runbooks/incident-response.md`).
- Bind `role`/`tenant` claims to the identity provider rather than the local
  demo model.

None of the PLANNED items are wired; this document records intent and the
fail-closed posture that must be preserved when they are.
