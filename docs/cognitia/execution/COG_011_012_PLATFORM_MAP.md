# COG-011/012 — Platform Map

All `verified_fact` (read/authored in-session).

- **Lead detail (COG-011)**: `GET /leads/:id` aggregate (lead + actions w/
  drafts + outcomes + proofs + reputation links + audit refs; operator-gated
  decryption) + `/moveros/front-desk/leads/[id]` page. Reused: frontdesk
  service, draftStore, proof/outcome/reputation repos.
- **Provisioning (COG-012)**: `tenants` table (0001) is service-role managed
  → Kysely impl uses the documented `withTenant(..., {bypassRls:true})`
  trusted path; memory mirror keeps slug idempotency. Reused wholesale:
  registerAgent (seeds sms deny), issueAtc, importCoreSkills — provisioning
  is composition, not new trust logic.
- **Specs**: `TENANT_SPECS` in `apps/api/src/tenantProvisioning.ts` is the
  single source for the four tenants' identity/agents/scopes/skills/proof
  categories/metrics/guardrails/compliance (TENANT_MAP.md §Provisioning).
- Blockers carried: persistent dev DB (founder), default-branch click.
