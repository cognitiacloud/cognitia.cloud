# Ownership manifest — Proof-Governed GTM OS v0 (W lanes)

The machine-readable source of truth is `packages/gtm-os/src/ownership/manifest.ts`
(asserted by `ownership/manifest.test.ts`, which proves this lane's paths do not
overlap any externally-owned path). This document is the human-readable view.

## This PR's lane (the only paths it writes)

| Lane             | Paths                                  |
| ---------------- | -------------------------------------- |
| **W0-substrate** | `packages/gtm-os/**`, `docs/gtm-os/**` |

No shared/root files are modified — `pnpm-workspace.yaml`, root `tsconfig.json`,
`vitest.config.ts`, root `package.json`, and `packages/agents/src/index.ts` are
untouched. The new package is picked up by the existing `packages/*` workspace
glob, the `packages/**/*.test.ts` vitest include, and the `packages/*/src/**/*.ts`
tsconfig include.

## Boundaries owned by other lanes (do NOT edit here)

| PR   | Status                 | Paths                                                                | Note                                                                          |
| ---- | ---------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| #135 | canonical              | `packages/agents/src/closer/**`, `packages/agents/src/index.ts`      | Canonical W1 Sales Closer workflow core.                                      |
| #124 | parked                 | `packages/agents/src/closer/**`                                      | Parked. Only the idempotent-mock-CRM idea was salvaged (reimplemented in W0). |
| #138 | sequencing-held        | `apps/web/src/app/operator/**`, `apps/web/src/lib/operatorConsole.*` | Operator console (web). Green but held.                                       |
| #140 | spec                   | `docs/architecture/proof-receipt-spec.md`                            | W0 implements a compatible runtime receipt.                                   |
| #139 | spec                   | `docs/architecture/trustops-analytics.md`                            | Spec/artifact only.                                                           |
| #142 | spec                   | `docs/execution/client-zero-build-reconciliation.md`                 | Spec/artifact only.                                                           |
| #136 | needs base/CI decision | `docs/architecture/agent-action-passport.md`                         | Targets `claude/ep002-mission-run-pPoba`, not `main`.                         |
| #141 | needs base/CI decision | `docs/architecture/dispute-replay-pack.md`                           | Targets `claude/ep002-mission-run-pPoba`, not `main`.                         |

## Conceptual overlaps (coordination, not file collisions)

Several in-flight PRs implement substrate concepts in _different_ files/lanes.
W0 does **not** touch their paths; these are flagged for later reconciliation:

- Action ledger / event spine: **#125** (`hermes/skills/signal-bus/`), **#123**
  (`proof/`).
- Compliance gate: **#129** (`hermes/skills/w2-compliance-gate/`), **#120**
  (`apps/web/src/lib/clientZeroComplianceGate.*`).
- Mock CRM + appointment adapters: **#128** (`hermes/skills/crm-appointment-skill/`),
  **#121** (`apps/api/src/appointmentWriteback.*`, `packages/core/src/schemas/appointment.ts`).
- Proof harness / report: **#126** (`hermes/skills/proof-report/`), **#123**
  (`proof/`).
- Operator console: **#119** (`apps/web/operator-console/`), **#138**.

### Unresolved overlap to escalate

- **#123** adds a **root `package.json`** and a root `tsconfig.base.json`,
  scaffolding a parallel npm-workspaces + `node:test` repo root with its own
  `packages/core/*`. This conflicts at the top level with the current
  pnpm/vitest root and with **#121**'s `packages/core/src/schemas/*`. W0 does not
  touch these, but #123's base/root strategy needs a founder decision before it
  or #121 lands.

## Recommended next PR sequence

1. **This PR (W0 substrate)** → merge onto `main` first; it is additive, isolated,
   and green.
2. **#135** (canonical W1 core) → reconcile its `closer` workflow onto the W0
   ledger/receipt/approval primitives in a follow-up (no edits to either lane in
   this PR).
3. **#138** (operator console) → unhold and wire to the W0 proof report / timeline
   once #135 lands.
4. Fold the duplicate concept PRs (**#125/#129/#128/#121/#126/#119/#120**) into the
   W0 substrate or close as superseded, per founder review — do not merge in
   parallel (they re-implement the same primitives in divergent shapes).
5. Resolve **#123**'s root-config strategy (npm-workspaces vs pnpm) before any of
   its files or #121 land.
6. **#136 / #141** → make the base/CI decision (currently target `ep002`); do not
   retarget without founder approval.
