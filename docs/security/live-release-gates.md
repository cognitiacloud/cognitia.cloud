# Live Release Gates & Permission Model

> STATUS: MOCK / SANDBOX. This document describes LOCAL, in-memory primitives
> used for tests and demos only. Nothing here is a production
> enterprise-readiness claim. There is no auth provider, no live secret, no
> production RBAC, and no network call in any of the code described below.
> Going live in the real world remains **blocked** until legal, customer, and
> founder signoff land out-of-band.

Source:

- `packages/agents/src/security/permissionModel.ts`
- `packages/agents/src/security/releaseGate.ts`

## Capability labelling

| Capability                              | Label   | Notes                                                  |
| --------------------------------------- | ------- | ------------------------------------------------------ |
| Local `can()` / `assertCan()` checks    | REAL    | Pure functions; deterministic; real and tested.        |
| Local `evaluateReleaseGate()` decision  | REAL    | Pure decision function; real and tested.               |
| Role → permission mapping               | SANDBOX | Demo roles only; not bound to any real identity.       |
| Release condition booleans              | SANDBOX | Model that an attestation exists; do not read secrets. |
| Identity / session / token / RBAC claim | MOCK    | None exists. No auth provider integration.             |
| Live connector configuration            | PLANNED | Blocked behind release gate + signoffs.                |
| Performing a controlled-live release    | PLANNED | Blocked until legal + customer + founder signoff.      |

Demo tenant is `budget_wheels_demo` (Tenant Zero) only. No real data, no PII.

## Permission matrix

Permissions: `view_lead`, `approve_action`, `reject_action`, `view_proof`,
`configure_live_connector`.

| Role     | view_lead | view_proof | reject_action | approve_action | configure_live_connector |
| -------- | :-------: | :--------: | :-----------: | :------------: | :----------------------: |
| viewer   |     y     |     y      |       -       |       -        |            -             |
| operator |     y     |     y      |       y       |       -        |            -             |
| approver |     y     |     y      |       y       |       y        |            -             |
| admin    |     y     |     y      |       y       |       y        |            y             |

- `can(role, permission)` returns a boolean.
- `assertCan(role, permission)` throws `PermissionDeniedError` when denied.
- **Fail closed:** unknown role or unknown permission => `false` / throw.
- `configure_live_connector` is necessary but **not sufficient** to go live —
  the release gate below still applies.

## Release-gate conditions per stage

`evaluateReleaseGate(stage, conditions)` returns `{ passed, missing,
missingKeys, reason }`.

| Stage             | Required conditions                                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `dry_run`         | (none — cannot act on the real world)                                                                                               |
| `private_pilot`   | monitoring enabled, rollback ready                                                                                                  |
| `controlled_live` | signed customer scope, counsel signoff, founder signoff, monitoring enabled, rollback ready, secrets configured, connector approval |

`controlled_live` requires **ALL** of the seven conditions above.

## Fail-closed guarantee

- A condition that is absent is treated identically to `false`.
- Default / empty `conditions` => `controlled_live` **FAILS CLOSED** (all seven
  reported missing).
- Any single missing required condition fails the whole stage.
- An unknown stage fails closed with reason `unknown release stage "…"`.

## What remains blocked

Until the following land out-of-band, no progression to `controlled_live` is
permitted regardless of code state:

1. Signed customer scope (customer signoff).
2. Counsel signoff (legal).
3. Founder signoff.

In addition, monitoring, rollback, secrets configuration, and explicit
connector approval must all be in place. These primitives model the _gate_;
they do not and cannot perform a release. No production enterprise-readiness
claim is made.
