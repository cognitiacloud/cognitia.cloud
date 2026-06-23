# GTM Command Center — Investor-Readiness Session Report

**Date:** 2026-06-22
**Branch:** `claude/gtm-command-center-investor-xztes9`
**Canonical base:** `origin/overnight/gtm-implementation` @ `45d0022` (includes PR #183 `next build`
fixes for `/gtm-os-integrated-demo`)
**Concept rebased:** PR #178 automation-readiness panel
(`claude/gtm-automation-readiness-panel-xmp4iu`)
**Target PR base:** `overnight/gtm-implementation` · **draft only**

## What this change is

A single **read-only, dry-run-only** automation-readiness panel on `/gtm-command-center` that
answers, auditably: _"could this system act on its own right now?"_ — and shows why the honest
answer is **no, by construction**. The #178 panel concept was rebased onto canonical overnight,
and the controlled-live **evidence modules** from #179 / #177 / #180 were integrated alongside it.

> **Honest framing.** This improves **investor/demo readiness** and **controlled-live evidence**
> (the system can _prove_ it fails closed). It does **not** raise **actual-live readiness** — no
> legal/client/connector/deployment/secrets approvals exist, and none are created here. Live
> execution stays disabled by construction (`sendLive()` always throws; `controlled_live` fails
> closed on 7 unmet conditions).

## Files changed (18 files, +5219 / −1 vs base)

**Command Center route + panel (web, `@cognitia/web` — mirrors `@cognitia/core`):**

- `apps/web/src/app/gtm-command-center/page.tsx` — route + readiness panel (read-only)
- `apps/web/src/app/gtm-command-center/page.smoke.test.tsx` — smoke tests
- `apps/web/src/lib/gtmCommandCenterViewModel.ts` — `buildCommandCenterView`,
  `buildAutomationReadiness`, `ROLLBACK_PLAN` (pure transform over computed lane mirror)
- `apps/web/src/lib/gtmCommandCenterViewModel.test.ts`
- `vitest.config.ts` — `esbuild.jsx:'automatic'` + `apps/**/*.test.tsx` include

**#159 integration packet (agents):**

- `packages/agents/src/gtm-os/integration/{runPacket,adapters,runPacket.test}.ts`
- `packages/agents/src/index.ts` — barrel export (integration run packet)

**#179 / #177 / #180 evidence modules (agents/closer):**

- `automationReleaseGate.ts` (+ `.test.ts`) — pure release-gate engine, kill-switch overrides all
- `automationApprovalQueue.ts` (+ `.test.ts`) — approval-queue read-model (`willSend:false`)
- `automationReadiness.e2e.test.ts` — 15-scenario fail-closed e2e matrix
- `packages/agents/src/closer/index.ts` — 2 hand-added barrel exports (no clobber of PR branches)

**Evidence docs:** `docs/cognitia/audits/alta-80-command-center-evidence.md`,
`alta-90-final-readiness-evidence.md`, `docs/sales-closer/integration-hardening.md`.

**Deliberately NOT overwritten** (preserve #183 / overnight behavior):
`apps/web/next.config.mjs`, `packages/agents/src/gtm-os/assembly/guards.ts`,
`apps/web/src/lib/gtmIntegratedDemoViewModel.ts`.

## Commands run

| Command                                                | Result                      |
| ------------------------------------------------------ | --------------------------- |
| `pnpm install --frozen-lockfile`                       | ✓ (244 resolved)            |
| `pnpm check` (format:check + typecheck + vitest)       | ✓ **912 tests / 111 files** |
| `pnpm --filter @cognitia/web run typecheck`            | ✓ clean                     |
| `pnpm --filter @cognitia/web run build` (`next build`) | ✓ 22/22 pages               |

Test-count delta: 840 → **912** (+72 = #177 18 + #179 19 + #180 35). Files 108 → 111 (+3).

## Build — both routes compile

`next build` route table includes both:

- `○ /gtm-command-center` (149 B)
- `○ /gtm-os-integrated-demo` (149 B)

## Safety scan result (clean)

- **No** `fetch`/network/vendor SDK (SendGrid/Twilio/nodemailer/WhatsApp/googleapis/child_process)
  in non-test source.
- **No** `sent:true` in non-test source. Dry-run rows are type-pinned `mode:'dry_run'`,
  `sent:false`, `liveStatus:'BLOCKED'`. The only `sent:true` is a **negative** test asserting
  `assertNoLiveSend` throws.
- **No** `<button>` / `onClick` / `<form>` in the rendered route — controls are three native
  `<details>` disclosures.
- **No** raw PII — synthetic `*.example` + reserved `555-01xx` placeholders only.
- Tenant scope: `budget_wheels_demo` / "Budget Wheels Demo" (Tenant Zero) sandbox label only.
- Fail-closed: `sendLive()` throws (`gtmCommandCenterViewModel.ts:328`); `evaluateReleaseGate`
  treats absent conditions as false (`:384`); `controlled_live` → 7 missing → blocked.

## Honest score impact

| Axis                      | Change                  | Rationale                                                                                                |
| ------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------- |
| Mock/dry-run capability   | **↑**                   | Auditable readiness panel + #159 integration packet + #177/#179/#180 evidence, all tested.               |
| Controlled-live readiness | unchanged (Low)         | Panel _describes_ the 7 unmet conditions; satisfies none.                                                |
| **Actual-live readiness** | **unchanged (Low)**     | No legal/client/connector/deployment/secrets approvals. `sendLive()` throws. Zero live capability added. |
| Enterprise readiness      | unchanged (Moderate)    | Governance shown, not provisioned (monitoring/rollback not armed).                                       |
| Alta parity               | unchanged (mirror axis) | Parity = mock/dry-run capability breadth, not live automation.                                           |
| Investor/demo readiness   | **↑**                   | One screen that auditably proves "cannot act on its own, by construction."                               |

## Statement

This change improves **investor/demo readiness** and strengthens **controlled-live evidence** (the
fail-closed posture is now provable and visible). It does **not** change **actual-live readiness**,
which remains **LOW** and gated behind the 7 controlled-live sign-offs. No live outreach, no vendor
API execution, no real CRM writes, no raw PII. Mock / sandbox / dry-run only.
