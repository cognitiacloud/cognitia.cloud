# Monitoring Rules (OBS-1)

> **STATUS: MOCK / SANDBOX.** Specifies the alert rules to implement. The
> dashboards and alert backend are **not** wired (control-matrix **MO-1 / OBS-1**
> = ⛔). This document is the spec to build against; it makes no claim that live
> monitoring exists. The mock-safe gate already models a `monitoringStatus`
> input (`packages/agents/src/closer/automationReleaseGate.ts`) that fails closed
> when monitoring is not `active`.

Source / ties:

- Event taxonomy: `docs/event-taxonomy.md`, `packages/core/src/schemas/event.ts`.
- Severities: `docs/runbooks/incident-response.md` (SEV-1/2/3).
- Gate input: `automationReleaseGate.ts` (`monitoringStatus: active|inactive`).

## Signals & rules

| Rule                       | Signal / source                                    | Condition (example threshold)             | Severity | Action                                         |
| -------------------------- | -------------------------------------------------- | ----------------------------------------- | -------- | ---------------------------------------------- |
| Cross-tenant / RLS anomaly | `*.bypass` usage, wrong-tenant write, auth anomaly | any occurrence                            | SEV-1    | Page IC; treat as breach until disproven       |
| Action/CRM failure spike   | `*.failed.v1` (e.g. `crm.push.failed.v1`)          | > N failures / 5 min, or > X% of attempts | SEV-2    | Investigate; consider connector kill-switch    |
| Worker heartbeat loss      | worker heartbeat / `sync_run` staleness            | no heartbeat for > 2 intervals            | SEV-2    | Restart worker; check queue                    |
| API health                 | `/health` endpoint                                 | non-200 or p95 latency breach             | SEV-2    | Check API + DB; roll back if deploy-correlated |
| Auth anomaly               | failed-auth / missing-`SESSION_SECRET` fail-close  | burst of denials / fail-closed startup    | SEV-2    | Verify config; investigate credential issues   |
| Rate-limit pressure        | 429 rate                                           | sustained elevated 429s                   | SEV-3    | Review limits; single-tenant throttle          |
| Secret-in-log canary       | log-redaction canary / scanner                     | any token-shaped string in logs           | SEV-1    | Rotate key, invalidate sessions, incident      |

Thresholds (`N`, `X%`) are placeholders to be tuned per environment before any
controlled-live step; do not hard-code production values in this repo.

## Dashboards to build (PLANNED)

- **Reliability**: `*.failed.v1` by type/tenant; worker heartbeat; `/health`;
  p50/p95 latency; 429 rate.
- **Security**: auth denials, fail-closed startups, RLS-bypass canary,
  secret-in-log canary.
- **Release readiness**: count of workspaces where `monitoringStatus=active`
  and `rollbackStatus=ready` (feeds the release gate).

## Definition of done for OBS-1

- [ ] Dashboards exist for every signal above.
- [ ] Alerts route to the on-call/IC with the severities above.
- [ ] A monitoring run is attached as evidence (control-matrix MO-1).
- [ ] `monitoringStatus=active` is only asserted to the release gate when these
      alerts are actually live.
