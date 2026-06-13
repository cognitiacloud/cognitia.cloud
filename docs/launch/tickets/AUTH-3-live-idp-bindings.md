# AUTH-3 — Live IdP bindings (OIDC JWKS rotation + SAML XML-DSig) + SCIM

**Status:** **NOT STARTED — blocked on pilot IdP selection.** This is the
explicit next increment after AUTH-2. Per direction, the live wire bindings are
built **only after a pilot customer's IdP is chosen** (Okta or Microsoft Entra
ID); until then this ticket exists to track the work, not to start it.

**Depends on:** AUTH-2 (shipped — `apps/api/src/sso.ts`, `accessReview.ts`).
**Self-contained constraint (carried forward):** no migration, no
repository-contract change. Build behind the existing seams.

## Gating decision needed from the owner

1. **Pilot IdP** — Okta (AUTH-2 default) or Microsoft Entra ID (if the pilot is
   Microsoft-centric). This selects which binding is built first.
2. **SCIM required for the pilot?** — only build automated provisioning/
   deprovisioning if the pilot needs it; otherwise it stays deferred.

## Scope (when unblocked)

### 1. OIDC — JWKS key rotation

Replace the static `signingPublicKeyPem` with a JWKS source: fetch the IdP's
`jwks_uri`, select the signing key by the token header `kid`, cache with TTL,
and refresh on rotation / unknown `kid`. Plugs in behind `verifyAssertion`
(the issuer/audience/time/role/fail-closed logic is unchanged).

### 2. SAML — XML-DSig

Replace the compact-assertion stand-in with real SAML Response/Assertion
handling: XML canonicalization (C14N), `<ds:Signature>` verification against the
tenant's IdP certificate, and assertion parsing (Issuer, Conditions/
NotBefore/NotOnOrAfter, AudienceRestriction, Subject/NameID, AttributeStatement
→ groups). Plugs in behind the same `verifyAssertion` seam. Likely uses a
vetted library (e.g. `xml-crypto` / `@node-saml`) — added as a dependency at
that time, not before.

### 3. Config persistence + CRUD

Persist `TenantSsoConfig` in the encrypted per-tenant store (the documented
`SsoConfigStore` seam) and add an owner-only config surface to register/rotate
a tenant's IdP. Keeps secrets server-side; never exports the signing material.

### 4. SCIM 2.0 (only if pilot-required)

`/scim/v2/Users` + `/scim/v2/Groups`: provisioning creates the tenant principal/
role mapping; **deprovisioning revokes access** (disable principal / drop group
mapping) — the security-critical half. Idempotent, tenant-scoped, audited.

## Acceptance criteria (invariants that MUST hold unchanged)

- **Tenant isolation** — a token is only ever mapped to the tenant whose
  configured issuer/cert signed it; cross-tenant tokens reject. (AUTH-2 test
  `tenant isolation: a token from tenant A never authenticates as tenant B`
  must still pass against the live bindings.)
- **Fail-closed auth** — bad/rotated-out signature, expired/not-yet-valid,
  wrong audience, unknown issuer, or unmapped-with-null-default all reject; no
  fallback role is ever invented.
- **Exportable access-review evidence** — `GET /auth/access-review` (owner-only,
  audited, signing key never exported) keeps working over the live path.
- No migration / no repository-contract change; full `pnpm check` green before
  push; no shared-surface drift with the agent-economy lane
  (`docs/competitive/LANE_RECONCILIATION.md`).
