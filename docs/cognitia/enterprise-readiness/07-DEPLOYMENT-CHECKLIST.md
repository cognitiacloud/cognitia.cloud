# 07 — Deployment Checklist

**Scope:** Promoting a change in mock-safe mode. `live` promotion is out of scope
here — it requires #09 + #10 and an explicit, audited decision to disable
mock-safe (which this build does not do).

## Pre-deploy (must all be ✅)

- [ ] `pnpm run check` green (typecheck + tests).
- [ ] `pnpm run safety-scan` green (no live egress, no secrets, no live sends).
- [ ] Release-gate evidence for the target stage recorded and passing (#03).
- [ ] All connectors confirmed `dark` with placeholder credential refs (#08,
      `assertDarkMode`).
- [ ] No `sent: true` anywhere; dry-run actions verified `sent: false` (#08).
- [ ] Audit events emitted by changed paths validate and carry no raw PII (#02).
- [ ] Monitoring rules deployed and firing on synthetic events (#04) — required
      from `pilot-dark`.
- [ ] Rollback target identified and rollback rehearsed (#06) — required from
      `pilot-dark`.
- [ ] Scope is limited to the intended change (diff reviewed).

## Deploy

- [ ] Promote only to the next stage in order
      (`dev → mock-staging → pilot-dark`). Never skip a stage.
- [ ] Emit `release.gate.evaluated.v1` with the evidence snapshot.
- [ ] Tag the release for known-good tracking (#06).

## Post-deploy

- [ ] Smoke-check protected routes return expected allow/deny (#01).
- [ ] Confirm no `live-action-attempt` alerts fired (#04).
- [ ] Confirm audit trail shows the deployment and no PII leakage.
- [ ] Update the release log with evidence refs.

## Abort conditions (roll back via #06)

- any check or safety-scan failure post-deploy;
- an unexplained `connector-config-change` or `live-action-attempt` alert;
- any connector found not `dark`, or any real secret detected.
