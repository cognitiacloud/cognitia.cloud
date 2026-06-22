# 04 — Monitoring Rule Definitions

**Model:** `packages/enterprise-readiness/src/monitoring.ts`
**Tests:** `src/monitoring.test.ts`

## Goal

Declarative, side-effect-free rules evaluated against the audit event stream
(#02). A rule fires when `threshold` matching events fall inside any sliding
`windowMs`. Alerts are handed to an external sink (paging/dashboard); the engine
itself performs no network I/O.

## Rules (`MONITORING_RULES`)

| Rule | Severity | Match | Threshold / Window |
|------|----------|-------|--------------------|
| `live-action-attempt` | **critical** | `action.live.blocked.v1` | 1 / 60s |
| `release-gate-override` | warning | `release.gate.overridden.v1` | 1 / 60s |
| `authz-denial-spike` | warning | `authz.access.denied.v1` | 20 / 5m |
| `connector-config-change` | warning | `connector.config.changed.v1` | 1 / 60s |
| `incident-declared` | **critical** | `incident.declared.v1` | 1 / 60s |

## Semantics (`evaluateRule`, `evaluateAll`)

- Matching events are sorted by `occurred_at`; if any window of `threshold`
  consecutive events spans `≤ windowMs`, the rule fires.
- `evaluateAll` returns one `MonitoringAlert` per fired rule (ruleId, severity,
  count, first/last timestamp).

## Alert routing (operational)

- **critical** → page on-call immediately; open incident bridge (#05).
- **warning** → notify channel; triage within the business day.
- `live-action-attempt` firing is a doctrine breach (something tried to send
  while dark). Treat as a security incident even if blocked.

## Deployment requirement

`monitoring_active` is a `pilot-dark` release-gate evidence item (#03): rules
must be deployed and demonstrably firing on synthetic events before any
pilot-dark promotion.
