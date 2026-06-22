# 05 — Incident Response Runbook

**Scope:** Cognitia / Demandara mock-safe build. Most "incidents" here are
*doctrine breaches* (something tried to act live) rather than outages.

## Severity ladder

| Sev | Definition | Example |
|-----|------------|---------|
| SEV1 | Doctrine breach with potential real-world effect | a real CRM write, live outreach, or real secret detected |
| SEV2 | Blocked live attempt or auth control failure | `live-action-attempt` fires; cross-tenant access succeeded |
| SEV3 | Degraded monitoring / data quality | audit events failing validation; denial spike |

## Roles

- **Incident Commander (IC):** founder by default in this build.
- **Scribe:** records timeline; every action is an audit event.
- **Comms:** drafts client/legal notice **only after** IC approval (no
  automated external comms).

## Flow

1. **Declare.** Emit `incident.declared.v1` (#02). `incident-declared` rule
   pages (#04). Open the bridge.
2. **Contain.** Confirm mock-safe is ON; verify all connectors `dark`
   (`assertDarkMode`). If any connector is live or a real secret is present,
   **rotate/disable the credential and engage rollback (#06) immediately.**
3. **Assess blast radius.** Query the audit trail for the offending `trace_id`.
   Confirm whether any `action.*` had `sent !== false`. In mock-safe this must be
   impossible — if found, escalate to SEV1.
4. **Eradicate.** Revert the offending change; re-run `pnpm run check` and
   `pnpm run safety-scan` to prove clean.
5. **Recover.** Restore the prior known-good release per #06. Re-verify
   monitoring is firing.
6. **Resolve.** Emit `incident.resolved.v1`. IC closes the bridge.
7. **Post-incident review** within 3 business days (blameless): timeline, root
   cause, the control that should have caught it, and a new release-gate evidence
   item if a gap is found (#03).

## Hard stops

- No live outreach, vendor execution, or CRM write as part of remediation.
- No raw PII in the incident channel — reference hashes/refs only.
- Client/legal notification requires founder (#09) and legal (#10) sign-off.
