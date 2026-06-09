# Runbook — Incident response

> Supports Go-Live Gate 3 + SOC 2 (incident management). Keep this short and drillable.

## Severity

| Sev   | Definition                                                     | Examples                                          | Target ack        |
| ----- | -------------------------------------------------------------- | ------------------------------------------------- | ----------------- |
| SEV-1 | Confirmed/likely **cross-tenant data exposure** or secret leak | RLS bypass, token in logs, wrong-tenant write     | 15 min            |
| SEV-2 | Customer-impacting outage or repeated failed CRM writes        | API down, worker stuck, mass `crm.push.failed.v1` | 30 min            |
| SEV-3 | Degraded/non-urgent                                            | elevated 429s, single-tenant sync error           | next business day |

## Roles

- **Incident Commander (IC):** coordinates, declares severity, owns comms.
- **Ops:** containment/eradication.
- **Scribe:** timeline + evidence capture.

## Flow

1. **Detect** — alert from dashboards (`*.failed.v1` spike, worker heartbeat loss, auth anomalies) or report.
2. **Declare** — IC sets severity; open an incident channel + doc.
3. **Contain (fast levers):**
   - Tenant blast-radius: set `integration_connections.status='paused'` (kill switch).
   - Secret compromise: rotate the AES data key / revoke the HubSpot token; invalidate sessions.
   - Bad deploy: roll back to previous image; migrations are additive.
4. **Eradicate** — fix root cause; add/adjust a CI gate so it can't recur.
5. **Recover** — re-enable connections; verify with the idempotency + isolation tests; monitor.
6. **Comms** — notify affected tenants per contractual/regulatory timelines (GDPR 72h for personal-data breach).
7. **Postmortem (≤5 business days)** — blameless; timeline, root cause, corrective actions with owners/dates.

## SEV-1 specifics (tenant isolation / secret)

- Treat as breach until disproven. Preserve logs/audit_events (do not delete).
- Run `kysely.rls.pglite.test.ts` + isolation checks to scope exposure.
- Confirm `app_user` (non-superuser) was in effect; check for any `app.bypass_rls` usage.

## Evidence to capture (SOC 2)

- Incident timeline, severity, detection source.
- Containment actions + timestamps.
- Postmortem doc + corrective-action tracker.
- One **drill** record per quarter (tabletop is acceptable for Type 1).
