# Runbook — Rollback

> **STATUS: MOCK / SANDBOX.** Short, drillable rollback procedure. Describes the
> levers modelled in the codebase; performing a real production rollback is a
> deploy-time operation gated by the usual sign-offs. Keep this drillable.

Supports Go-Live Gate + the release gate (`rollbackStatus` input of
`packages/agents/src/closer/automationReleaseGate.ts`, which fails closed unless
rollback is `ready`).

Source / ties:

- `apps/api/src/rollback.test.ts`; `apps/api/src/killSwitch.ts` (+ test).
- `packages/integrations/src/hubspot/rollback.ts` (+ test).
- `docs/runbooks/deploy-verification.md`, `docs/runbooks/incident-response.md`.

## Levers (fastest first)

1. **Connector kill-switch (per-tenant blast-radius).**
   Set `integration_connections.status = 'paused'` to halt a tenant's live path
   immediately. Tenant-scoped (ENF-1); does not affect other tenants.
2. **Bad deploy → roll back image.**
   Redeploy the previous known-good image. **Migrations are additive** — a code
   rollback does not require a schema down-migration; never destructively revert
   a migration to roll back code.
3. **Integration-level rollback.**
   Use `hubspot/rollback.ts` to undo the last integration push where supported
   (idempotent; verify with the integration tests).
4. **Secret compromise.**
   Rotate the AES data key / revoke the connector token, invalidate sessions
   (see `docs/runbooks/secret-rotation.md` + `secrets-policy.md`), then resume.

## Procedure

1. **Declare** — open an incident if customer-impacting (`incident-response.md`);
   set severity.
2. **Contain** — apply the narrowest effective lever above (prefer kill-switch
   over full redeploy when a single tenant is affected).
3. **Roll back** — redeploy previous image if the deploy is the root cause.
4. **Verify** — run idempotency + RLS isolation tests; confirm `*.failed.v1`
   returns to baseline (see `monitoring-rules.md`).
5. **Re-enable** — flip paused connections back to `active` once green.
6. **Record** — capture timeline + actions as evidence; feed corrective actions
   into the postmortem.

## Rollback readiness checklist (precondition for `rollbackStatus = ready`)

- [ ] Previous known-good image is identified and redeployable.
- [ ] Kill-switch path tested for the target tenant(s).
- [ ] Migrations confirmed additive (no destructive down-migration needed).
- [ ] Secret-rotation runbook reachable and current.
- [ ] Verification tests (RLS + idempotency) runnable against the environment.

Only assert `rollbackStatus=ready` to the release gate when every box is checked.
