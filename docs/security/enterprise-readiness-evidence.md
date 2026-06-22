# Enterprise-Readiness Evidence — Mock-Safe Controls

Date: 2026-06-22
Branch: `claude/enterprise-readiness-controls-05auh2` (off `overnight/gtm-implementation` / PR #158)

> **Honesty contract.** This document records **real, tested, mock-safe**
> controls and is explicit about their boundaries. Nothing here is a
> production-readiness claim. There is **no live egress**, no auth provider, no
> production RBAC, no live secret, and no network/vendor SDK in any code
> referenced below. Every control is a pure decision/guard function used in
> tests and demos. Going live in the real world remains **blocked** until legal,
> customer, founder, monitoring, rollback, secrets, and connector-approval
> sign-offs land out-of-band.

This is the enterprise-controls counterpart to the broader run evidence in
`docs/cognitia/audits/alta-80-readiness-evidence.md`. It raises **implemented
mock-safe control surface**, not live-automation readiness.

---

## 1. Controls added this pass

| Control                              | Module                           | Label   | What it does                                                                                                               |
| ------------------------------------ | -------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| Local permission model               | `security/permissionModel.ts`    | REAL    | `can`/`assertCan`; fail-closed on unknown role/permission (pre-existing B6).                                               |
| Per-stage release gate               | `security/releaseGate.ts`        | REAL    | `evaluateReleaseGate`; `controlled_live` needs 7 conditions (pre-existing B6).                                             |
| **Workspace isolation guards**       | `security/workspaceIsolation.ts` | REAL    | `assertSandboxWorkspace` / `assertSameWorkspace` / `assertWorkspaceScoped`; fail-closed cross-tenant denial, sandbox-only. |
| **Composed release decision**        | `security/releaseDecision.ts`    | REAL    | `decideRelease` = permission ∧ gate ∧ sandbox; fails closed; reports all blockers.                                         |
| **Programmatic control matrix**      | `security/permissionMatrix.ts`   | REAL    | Renders the permission + release-gate matrices straight from code so docs cannot drift.                                    |
| Role→permission mapping              | `security/permissionModel.ts`    | SANDBOX | Demo roles; not bound to any real identity.                                                                                |
| Release condition booleans           | `security/releaseGate.ts`        | SANDBOX | Model that an attestation exists; no secret is read.                                                                       |
| Identity / session / token / RBAC    | —                                | MOCK    | None exists; no auth provider integration.                                                                                 |
| Route-level enforcement              | —                                | PLANNED | Permission model is **not** wired into route middleware (see `route-access-readiness.md`).                                 |
| Performing a controlled-live release | —                                | PLANNED | Blocked behind `decideRelease` + out-of-band sign-offs.                                                                    |

## 2. Permission / release-gate matrix

The matrices are generated from code by `renderMatrixMarkdown()` and asserted
against the live `can()` / `requiredConditions()` functions, so this table is
the enforced truth, not a hand-maintained copy.

### Role → permission

| Role     | view_lead | view_proof | reject_action | approve_action | configure_live_connector |
| -------- | :-------: | :--------: | :-----------: | :------------: | :----------------------: |
| viewer   |     y     |     y      |       -       |       -        |            -             |
| operator |     y     |     y      |       y       |       -        |            -             |
| approver |     y     |     y      |       y       |       y        |            -             |
| admin    |     y     |     y      |       y       |       y        |            y             |

Least-privilege monotone (viewer ⊆ operator ⊆ approver ⊆ admin), asserted in
`permissionMatrix.test.ts`. `configure_live_connector` is admin-only and is
**necessary but not sufficient** to go live.

### Stage → required conditions

| Stage             | Required conditions                                                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `dry_run`         | (none — cannot act on the real world)                                                                                               |
| `private_pilot`   | monitoring enabled, rollback ready                                                                                                  |
| `controlled_live` | signed customer scope, counsel signoff, founder signoff, monitoring enabled, rollback ready, secrets configured, connector approval |

## 3. Fail-closed proof (controlled-live)

`releaseDecision.test.ts` proves the controlled-live path is denied unless ALL
required conditions exist simultaneously:

- admin + sandbox but **no conditions** → denied (`gateOk:false`).
- all 7 conditions + sandbox but role **lacks** `configure_live_connector`
  (viewer/operator/approver) → denied (`permissionOk:false`).
- admin + all 7 conditions but **non-sandbox** workspace → denied
  (`workspaceOk:false`).
- admin + sandbox + 7 conditions with **any one** flipped false → denied.
- unknown stage with everything attested → denied.
- **Allowed only** when role ∧ all 7 conditions ∧ sandbox hold together.

Workspace isolation (`workspaceIsolation.test.ts`) additionally proves
cross-tenant access and spoofed sandbox flags are denied.

## 4. Verification (this branch)

| Check                                                | Result                                                            |
| ---------------------------------------------------- | ----------------------------------------------------------------- |
| `pnpm exec vitest run packages/agents/src/security/` | ✅ 58 tests passed (31 new across 3 new files)                    |
| `pnpm check` (format → typecheck → test)             | _see PR description / CI for the full-suite run_                  |
| Live-egress scan over new code                       | ✅ no `fetch`/network/vendor SDK imports; pure functions only     |
| PII scan over new code                               | ✅ no real emails/phones; sandbox ids only (`budget_wheels_demo`) |
| Budget Wheels wording                                | ✅ referenced only as `budget_wheels_demo` / Tenant Zero sandbox  |

## 5. Audit evidence pointers

For SOC-2-style evidence mapping, see `evidence-checklist.md` (the controls here
appear under "Automated/continuous" as CI-run fail-closed authorization tests)
and `control-matrix.md`. Route posture is documented honestly in
`route-access-readiness.md`.

## 6. What is explicitly NOT claimed

- Not production RBAC; the permission model is not enforced on any route.
- Not tenant isolation at the data layer; `workspaceIsolation` is in-memory and
  does not replace row-level security.
- Not live-ready; `controlled_live` cannot be reached without out-of-band legal,
  customer, founder, monitoring, rollback, secrets, and connector-approval
  sign-offs.
