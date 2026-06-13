# AUTH-2 — Enterprise SSO + access review (SAML + OIDC, tenant-scoped)

**Status:** SSO + role mapping + access-review evidence implemented (GTM lane).
**Backlog ref:** operating-plan §5 #7 (pre-GA). **Self-contained:** no migration,
no repository-contract change — builds on the existing `auth.ts` SessionVerifier
seam + the SEC-1 audit chain, so it adds **zero** shared-data-layer divergence
with the agent-economy lane (see `docs/competitive/LANE_RECONCILIATION.md`).

## Scope decisions

- **Both SAML and OIDC**, selected **per tenant**. The protocol/IdP is resolved
  from the verified token issuer — never from client input (tenant isolation).
- **Primary IdP default: Okta.** Use **Microsoft Entra ID (Azure AD)** when the
  customer is Microsoft-centric. `generic` covers any other OIDC/SAML IdP. The
  provider only changes claim defaults (e.g. Entra's group/role claim).
- **SCIM: deliberately deferred.** Automated provisioning/deprovisioning is not
  required for the private-alpha launch (handful of users, manual setup). It is
  the documented next increment (seam below). This honors "SCIM only if required
  for launch."

## What shipped (`apps/api/src/sso.ts`)

- **`TenantSsoConfig`** — per tenant: `protocol` (oidc|saml), `provider`
  (okta|entra|generic), expected `issuer` + `audience`, the IdP signing public
  key (PEM), a `roleMapping` (IdP group/role → app Role), and a `defaultRole`
  (null ⇒ reject unmapped users — least privilege).
- **`SsoConfigStore`** (`InMemorySsoConfigStore` + documented encrypted-store
  seam) — the verifier and access-review never see the storage backend.
- **`SsoSessionVerifier implements SessionVerifier`** — drops into the existing
  server auth seam. For each bearer assertion it: resolves the tenant by issuer,
  verifies the **RS256 signature against that tenant's key**, enforces
  `iss` + `audience` + `exp`/`nbf`, extracts the subject (OIDC `sub` / SAML
  NameID), and maps groups → role **fail-closed** (highest mapped role; unmapped
  ⇒ `defaultRole`, or reject when null). Returns the same
  `{ tenantId, userRef, role }` principal the rest of the API already consumes —
  so **existing role gates (`requireMutatingRole`/`requireOwner`) now gate on
  IdP-mapped roles** with no handler changes.

### Honest boundary

Both protocols are verified over an RS256-signed assertion. The OIDC path
validates a standard id_token. The SAML path validates a signed assertion
envelope (Issuer/Audience/Conditions/AttributeStatement). All security-relevant
checks — signature, issuer, audience, time window, subject, group→role,
fail-closed, tenant isolation — are implemented and tested offline. The
production **wire bindings** (OIDC **JWKS** key rotation; SAML **XML-DSig**
canonicalization) plug into `verifyAssertion` / the config-key seam **without
changing this control logic**.

## Access-review evidence (`apps/api/src/accessReview.ts`)

`GET /auth/access-review` (**owner-only**, and the export is itself audited as
`access_review_exported`):

- **Policy** — the tenant SSO config: protocol, provider, issuer, audience,
  group→role mapping, default role. **The signing key is never exported.**
- **Observed access** — derived from the immutable, hash-chained audit trail:
  every distinct actor, their action count, first/last seen, and the distinct
  audit verbs they performed. Most-recent first.

## Tests

`sso.test.ts` (11): OIDC + SAML happy paths, wrong-signature / expired /
not-yet-valid / wrong-audience / unknown-issuer rejects, fail-closed unmapped
(null default), default-role fallthrough, highest-role precedence, tenant
isolation (re-labelled-issuer spoof fails signature), malformed tokens, pure
`mapGroupsToRole`. `accessReview.test.ts` (7): audit aggregation, key-never-
exported, export audited, owner-only (operator/viewer 403), unconfigured tenant,
and an end-to-end server proof that an IdP-mapped operator may run a mutating
route while a viewer-mapped token gets 403 and an unmapped token 401.

## Next increment (documented, not built)

Tracked explicitly as **AUTH-3** — see
`docs/launch/tickets/AUTH-3-live-idp-bindings.md`. **Gating precondition: a pilot
IdP must be chosen first;** the live wire bindings are not started until then.

- **JWKS rotation** (OIDC) and **XML-DSig** (SAML) live wire bindings behind
  `verifyAssertion`.
- **SCIM 2.0** provisioning/deprovisioning (parallel, also pilot-gated).
- Persisting `TenantSsoConfig` in the encrypted per-tenant store + an owner-only
  config CRUD surface.

The three AUTH-2 invariants — **tenant isolation** (issuer→tenant), **fail-closed
auth**, and **exportable access-review evidence** — are acceptance criteria for
AUTH-3 and must hold unchanged through the binding work.
