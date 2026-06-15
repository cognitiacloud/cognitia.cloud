# V1 Go-Live Checklist

> Gates the CRM-writeback-only V1. Source of truth: `docs/competitive/operating-plan.md`
> (scope fence §0). **No item here may depend on email/send/replies/deliverability.**
> Each box maps to a control (`docs/security/control-matrix.md`) and an acceptance
> test (`docs/testing/v1-acceptance.md`).

## Gate status (live dashboard, 2026-06-09)

🟢 green = met · 🟡 yellow = code done, deploy/operator pending · 🔴 red = not started.

| Gate                                                                         | Status | Blocker                                                                                              | Owner                 | Next action                                                                                           |
| ---------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------- |
| **Gate 0** code (auth/RLS/idempotency/fence)                                 | 🟢     | —                                                                                                    | ENG-platform          | keep as required CI checks                                                                            |
| **Gate 0** deploy (app_user role, KMS key, TLS, backups+PITR)                | 🟡     | deploy-time evidence not produced                                                                    | ENG-platform + Ops    | provision + run `backup-restore-drill.md`, `deploy-verification.md`                                   |
| **Gate 1** CRM execute path (code)                                           | 🟢     | —                                                                                                    | ENG-integrations      | —                                                                                                     |
| **Gate 1** live HubSpot (token, idempotency property, AES key, seeded creds) | 🟡     | live creds (B-3)                                                                                     | Operator              | run `operator-handoff.md` 12-step; `GET /integrations/readiness` must return READY before first write |
| **Gate 1** approval console (UI-1)                                           | 🟢     | — (landed `1623554`; reviewer checklist applied)                                                     | ENG-web               | pre-GA polish: hide buttons by role, real login                                                       |
| **Gate 3** SSO/SAML                                                          | 🟡     | AUTH-2 done (SAML+OIDC, tenant-scoped, access-review); live IdP wire bindings = AUTH-3 (pilot-gated) | ENG-platform          | choose pilot IdP → AUTH-3                                                                             |
| **Gate 3** audit export + retention (SEC-2)                                  | 🟢     | done (per-contact export + integrity proof + retention status; tested)                               | ENG-platform          | —                                                                                                     |
| **Gate 3** SOC 2 Type 1 + IR drill + pen test                                | 🔴     | program/evidence                                                                                     | Security + Compliance | onboard Vanta; run IR drill                                                                           |
| **Gate 3** pgBouncer SET LOCAL validation (B-2)                              | 🔴     | real pooled infra                                                                                    | ENG-platform          | pooled isolation test before scale                                                                    |

**Needed for design-partner alpha:** Gate 0 (code 🟢 + deploy 🟡) + Gate 1 (code 🟢 + live 🟡 + UI-1 or API-driven approval). See `design-partner-alpha-checklist.md`.
**Needed before paid customers:** Gate 3 items + the yellow Gate 0/1 deploy items.
**Post-V1:** email/voice/ads/LinkedIn/Salesforce/enrichment/autopilot (fenced out).

---

## Gate 0 — before ANY customer data touches the system

- [ ] **Auth-derived tenant** (API-1): tenant comes from the authenticated principal; a forged `x-tenant-id` cannot change scope.
- [ ] **RLS enforced** under a non-superuser DB role (app_user), proven in CI (`kysely.rls.pglite.test.ts`).
- [ ] **Tenant-isolation + idempotency tests are CI release gates** (build fails if they fail).
- [ ] **Secrets in KMS/secret manager**; AES key injected at boot, never committed; rotation <90d.
- [ ] **Immutable audit log** on; structured logs assert no raw PII/tokens.
- [ ] **Backups/PITR** enabled and a **restore tested** at least once.
- [ ] **DPA template** ready; sub-processor register started.
- [ ] **Migrations applied**; API refuses to boot on schema mismatch.

## Gate 1 — V1 go-live (first real CRM action)

- [ ] **CRM-1**: real `HttpHubspotClient` wired into the execute-path adapter (no fake client in prod composition).
- [ ] **Worker secret/token injection** live (SecretStore + ConnectionTokenProvider from deployment-owned key).
- [ ] **HubSpot portal prepared** per `docs/runbooks/hubspot-onboarding.md` (private app, least-priv scopes, idempotency property AND `cognitia_*` provenance properties on tasks/notes).
- [ ] **Approval console (UI-1)** mounted; operator can run Mira → review → approve → execute.
- [ ] **Human approval mandatory**: execute refuses unapproved actions (409); proven in CI.
- [ ] **Decision reasons (FLY-1)**: approve/reject require a structured reason (400 without); each decision persists to `feedback_labels` and is queryable (`GET /decisions`); proven in CI.
- [ ] **Idempotent execution**: a re-executed action creates exactly one HubSpot object.
- [ ] **Provenance (PROV-1)**: every CRM write carries `cognitia_*` lineage (agent/run/action/evidence/risk/approver); idempotent replay does not re-stamp; proven in CI.
- [ ] **Kill switch** works: setting `integration_connections.status='paused'` halts execution.
- [ ] **Least-privilege DB role** (app_user, non-superuser) used by API + worker.
- [ ] **Observability**: `*.failed.v1` + sync_run dashboards; worker heartbeat; `/health` pings DB.
- [ ] **Scope-fence guard (code)**: no executable email path in the prod composition (email adapter unregistered AND Mira proposes only `crm.*` in V1 mode). See review-log blocker B-1.

## Gate 2 — before first OUTBOUND EMAIL _(NOT V1 — day-60+; listed only to keep it fenced)_

- [ ] _(Deferred)_ ESP + SPF/DKIM/DMARC + warmed domain; reply/bounce webhooks + signature verify; suppression/consent. **Do not work in V1.**

## Gate 3 — before first PAYING customer

- [x] **SSO** (SAML+OIDC, tenant-scoped) + access-review export — **AUTH-2 done**; MFA + live IdP wire bindings (JWKS/XML-DSig) = AUTH-3 (pilot-gated).
- [x] **Audit-trail export** (per-contact action/approval chain) + retention status — **SEC-2 done** (`docs/security/SEC-2-audit-export-retention.md`).
- [ ] **SOC 2 Type 1** complete or audit engaged; Type 2 observation window started.
- [ ] **Incident-response runbook** in place; one drill recorded.
- [ ] **Published pricing**.

> Status note (2026-06-14): the Gate-3 dashboard above predates SEC-2/AUTH-2,
> which have since shipped. See `docs/security/GTM_SELF_AUDIT_2026-06.md` for the
> authoritative current state.

## Sign-off

| Gate | Owner                      | Evidence link | Date | Signed |
| ---- | -------------------------- | ------------- | ---- | ------ |
| 0    | ENG-platform + Compliance  |               |      |        |
| 1    | ENG-integrations + ENG-web |               |      |        |
| 3    | Security + Product         |               |      |        |
