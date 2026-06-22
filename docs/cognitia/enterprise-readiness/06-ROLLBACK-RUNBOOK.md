# 06 — Rollback Runbook

**Scope:** Reverting a release/change to the last known-good, mock-safe state.
Rollback rehearsal is `pilot-dark` release-gate evidence (#03,
`rollback_rehearsed`).

## Principles

- **Fail closed:** if rollback state is uncertain, return to the most recent
  fully-verified release, not a partial one.
- **Mock-safe is the floor:** every rollback target must itself be mock-safe
  (connectors dark, `sent: false`). You can never "roll back" into a live state.
- **Auditable:** every rollback emits `rollback.executed.v1` (#02).

## Triggers

- SEV1/SEV2 incident (#05).
- `live-action-attempt` or `connector-config-change` alert that can't be
  explained (#04).
- Failing `pnpm run check` or `pnpm run safety-scan` on a deployed release.

## Procedure

1. **Identify last known-good.** The most recent commit/tag whose release gate
   recorded all `mock-staging` evidence passing (#03).
2. **Freeze.** Stop further promotions; announce on the incident bridge.
3. **Revert.**
   - Code: `git revert` the offending commit(s) or redeploy the known-good tag.
     Do **not** force-push shared branches.
   - Config/connectors: restore placeholder credential refs; re-assert
     `assertDarkMode` for every connector.
   - Data: in mock-safe there are no real CRM writes to undo. If a dry-run record
     was persisted, mark it `rolled_back` (matches canonical `executionStatus`).
4. **Verify.** Run `pnpm run check` and `pnpm run safety-scan`; both must pass.
   Confirm monitoring rules fire on synthetic events.
5. **Record.** Emit `rollback.executed.v1` with the from/to release refs and the
   triggering incident id.
6. **Re-gate.** The rolled-back release must pass the release gate (#03) before
   any new promotion.

## Rehearsal (evidence for #03)

In `mock-staging`, deliberately deploy a bad change, trigger the rollback, and
capture: the `rollback.executed.v1` event, a green `pnpm run check`, and the
time-to-restore. Store the proof ref against `rollback_rehearsed`.
