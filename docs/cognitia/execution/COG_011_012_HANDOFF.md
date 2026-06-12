# COG-011/012 — Handoff

Date: 2026-06-12. Branch `claude/cog-011-012-lead-detail-tenant-provisioning`
(contains COG-011 + COG-012). COG-011 alone is also PR #44. Evidence:
`verified_fact` unless noted.

## COG-011 — Lead detail

- `GET /leads/:id` (operator/owner-gated, existing secure pattern) returns:
  lead (decrypted for operator; masked phone; tenant-scoped), actions with
  drafts + approval/simulation status, evidence-tagged outcomes (estimated
  AND verified values stay separate), related proofs, **reputation_links**
  (events whose proofs belong to this lead's story), audit refs.
- Page `/moveros/front-desk/leads/[id]` renders all of it incl. the
  reputation-impact section; list rows link in. Viewer → 403; no raw PII in
  any aggregate/dashboard surface (tested).

## COG-012 — Tenant provisioning foundation

- `TENANT_SPECS` (apps/api/src/tenantProvisioning.ts): moveros (Tenant Zero),
  demandara, skillucate, alphainvesto — each with slug, display name,
  vertical, default agents + ATC scopes, default skills (core20), proof
  categories, outcome metrics, guardrails, compliance notes;
  **alphainvesto: `forbid_financial_claims: true`** + strict
  no-advice/no-return-claims guardrail text.
- `provisionTenant`: owner-only, idempotent by slug; creates the tenant row
  via the trusted service-role path (0001 doctrine), then INSIDE the new
  tenant: registers default agents (sms.send_real deny seeded), issues ATCs
  with spec scopes, imports Core 20; audit row `tenant.provisioned.v1`.
- Routes: `GET /tenants` (specs + provisioned state), `POST /tenants {slug}`
  — both owner-only. Console UI deliberately deferred (brief: don't
  overbuild); the API + dev-DB seed cover current need.

## Tests

5 provisioning tests (all four tenants incl. AlphaInvesto compliance flag,
idempotency, RBAC, isolation into the NEW tenant only) + detail-aggregate
test + tenant contract test on memory AND PGlite. Full gate green at handoff
(count in PR description).

## Blockers / next

Persistent dev DB + default-branch click (founder, unchanged). Next prompts:
NEXT_PROMPTS_FOR_AGENTS.md (COG-013 Twilio sandbox, COG-014 Demandara
onboarding pilot, COG-015 moveros-staging HTTP integration spike).
