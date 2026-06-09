# V1 Go-Live Checklist

> Gates the CRM-writeback-only V1. Source of truth: `docs/competitive/operating-plan.md`
> (scope fence §0). **No item here may depend on email/send/replies/deliverability.**
> Each box maps to a control (`docs/security/control-matrix.md`) and an acceptance
> test (`docs/testing/v1-acceptance.md`).

## Gate status (live dashboard, 2026-06-09)

🟢 green = met · 🟡 yellow = code done, deploy/operator pending · 🔴 red = not started.

| Gate                                                                         | Status | Blocker                                  | Owner                 | Next action                                                         |
| ---------------------------------------------------------------------------- | ------ | ---------------------------------------- | --------------------- | ------------------------------------------------------------------- |
| **Gate 0** code (auth/RLS/idempotency/fence)                                 | 🟢     | —                                        | ENG-platform          | keep as required CI checks                                          |
| **Gate 0** deploy (app_user role, KMS key, TLS, backups+PITR)                | 🟡     | deploy-time evidence not produced        | ENG-platform + Ops    | provision + run `backup-restore-drill.md`, `deploy-verification.md` |
| **Gate 1** CRM execute path (code)                                           | 🟢     | —                                        | ENG-integrations      | —                                                                   |
| **Gate 1** live HubSpot (token, idempotency property, AES key, seeded creds) | 🟡     | live creds (B-3)                         | Operator              | run `operator-handoff.md` 10-step                                   |
| **Gate 1** approval console (UI-1)                                           | 🔴     | not landed                               | ENG-web (Codex)       | scaffold Next.js page (see UI-1 ticket)                             |
| **Gate 3** SSO/SAML                                                          | 🔴     | not started (signed-session seam exists) | ENG-platform          | AUTH-2 (pre-GA)                                                     |
| **Gate 3** audit export + retention (SEC-2)                                  | 🔴     | not started                              | ENG-platform          | SEC-2                                                               |
| **Gate 3** SOC 2 Type 1 + IR drill + pen test                                | 🔴     | program/evidence                         | Security + Compliance | onboard Vanta; run IR drill                                         |
| **Gate 3** pgBouncer SET LOCAL validation (B-2)                              | 🔴     | real pooled infra                        | ENG-platform          | pooled isolation test before scale                                  |

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
- [ ] **HubSpot portal prepared** per `docs/runbooks/hubspot-onboarding.md` (private app, least-priv scopes, idempotency property on tasks/notes).
- [ ] **Approval console (UI-1)** mounted; operator can run Mira → review → approve → execute.
- [ ] **Human approval mandatory**: execute refuses unapproved actions (409); proven in CI.
- [ ] **Idempotent execution**: a re-executed action creates exactly one HubSpot object.
- [ ] **Kill switch** works: setting `integration_connections.status='paused'` halts execution.
- [ ] **Least-privilege DB role** (app_user, non-superuser) used by API + worker.
- [ ] **Observability**: `*.failed.v1` + sync_run dashboards; worker heartbeat; `/health` pings DB.
- [ ] **Scope-fence guard (code)**: no executable email path in the prod composition (email adapter unregistered AND Mira proposes only `crm.*` in V1 mode). See review-log blocker B-1.

## Gate 2 — before first OUTBOUND EMAIL _(NOT V1 — day-60+; listed only to keep it fenced)_

- [ ] _(Deferred)_ ESP + SPF/DKIM/DMARC + warmed domain; reply/bounce webhooks + signature verify; suppression/consent. **Do not work in V1.**

## Gate 3 — before first PAYING customer

- [ ] **SSO** (OIDC minimum) + MFA.
- [ ] **Audit-trail export** (per-contact action/approval chain) + retention policy enforced.
- [ ] **SOC 2 Type 1** complete or audit engaged; Type 2 observation window started.
- [ ] **Incident-response runbook** in place; one drill recorded.
- [ ] **Published pricing**.

## Sign-off

| Gate | Owner                      | Evidence link | Date | Signed |
| ---- | -------------------------- | ------------- | ---- | ------ |
| 0    | ENG-platform + Compliance  |               |      |        |
| 1    | ENG-integrations + ENG-web |               |      |        |
| 3    | Security + Product         |               |      |        |
