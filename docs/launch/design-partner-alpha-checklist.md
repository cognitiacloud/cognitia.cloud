# Design-Partner Alpha Checklist

> The minimal bar to put V1 in front of ONE friendly design partner (e.g. MoverOS).
> Subset of the full go-live gates — deliberately not the paid-customer bar. CRM
> write-back only. Pair with `go-live-checklist.md` (Gate 0/1) and `operator-handoff.md`.

## Must be TRUE for alpha (needed)

**Code (all green at HEAD):**

- [ ] API-1 auth-derived tenant + RBAC (no `x-tenant-id` trust) — DONE.
- [ ] B-1 fence in code (CRM-only; FEN-1..3) — DONE.
- [ ] CRM-1 execute path injects the real client + idempotent — DONE (code).
- [ ] CI green; isolation + idempotency + fence tests are required checks.

**Deploy / operator (per `operator-handoff.md`):**

- [ ] Postgres provisioned; app runs as `app_user`; backups + PITR on.
- [ ] Secrets set (`SESSION_SECRET`, `CREDENTIAL_SECRET_KEY_BASE64`, `HUBSPOT_WEBHOOK_SECRET`).
- [ ] HubSpot private app (least-priv) + `cognitia_idempotency_key` property on Tasks/Notes.
- [ ] One tenant seeded + credential stored; first live approve→execute verified; idempotent re-run verified.
- [ ] Kill switch verified (paused connection halts execution).
- [ ] `deploy-verification.md` all 9 checks pass.

**Product surface:**

- [ ] UI-1 approval console OR a documented API-driven approval path the partner can use.
- [ ] Operator can run Mira → review evidence → approve → execute → see audit trail.

**Safety / comms:**

- [ ] Incident runbook in place + a contact path; kill switch known to the operator.
- [ ] DPA (even lightweight) with the design partner.
- [ ] Clear scope note to the partner: "CRM tasks/notes only; no emails are sent."

## Explicitly NOT required for alpha (defer to paid)

- SSO/SAML (signed-session is fine for a single operator), SOC 2 Type 1 letter,
  pen test, pgBouncer validation (run before scaling/concurrency), multi-tenant onboarding,
  CRM stage-update depth (CRM-2), monitoring dashboards polish.

## Alpha exit (success)

The partner's operator, on their own HubSpot, runs Mira and approves a task that
appears in HubSpot exactly once, with a full audit trail — and nothing sends email.
Collect: one end-to-end demo recording + the verify checklist as the first evidence artifact.
