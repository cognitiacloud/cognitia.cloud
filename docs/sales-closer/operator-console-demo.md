# GTM-OS Operator Console — demo (mock-only)

A founder-facing demo surface for the **Client Zero Sales Closer** workflow,
mounted at the temporary route **`/gtm-os-demo`**.

## What it demonstrates

For each synthetic lead the console shows:

- **Lead detail** — PII-safe projection (masked contact, email domain, source,
  consent/contact basis, fit score).
- **Compliance state** — `Blocked` vs `Human review required` (outreach is never
  auto-allowed).
- **Blocked reasons** — a prominent red panel when a run is held at the
  compliance gate.
- **Approve / reject controls** — the only action surface. A **blocked lead can
  never be approved** (the Approve button is disabled and explains why).
- **Mock appointment status** and **mock CRM writeback status** — simulated
  markers only; no calendar provider or CRM is contacted.
- **Proof receipt / report** — the run's proof events and final-state summary.
- **Run timeline** — the ordered states the run visited
  (`received → awaiting_human_approval → approved → appointment_ready →
  crm_written → proof_ready`, or the `compliance_blocked` / `rejected` branches).

## How it relates to the canonical mock spine

The console is **type-aligned to the canonical Sales Closer mock spine** at
`packages/agents/src/closer` (public barrel `index.ts`). The view-model
(`apps/web/src/lib/gtmOsConsoleViewModel.ts`) imports the spine's public types
**type-only** (`CloserWorkflowRun`, `CloserWorkflowState`,
`CloserComplianceDecision`, `CloserAppointment`, `CloserCrmRecord`,
`CloserStateTransition`, `CloserWorkflowEventType`) and exposes synthetic,
**pre-authored** `CloserWorkflowRun` fixtures shaped exactly to that schema.

Precise scope of the wiring:

- It does **not** execute the workflow runtime (`runCloserWorkflow`) in the
  browser. Approve / reject simply select between pre-authored outcome runs.
- It makes **no value import** from `packages/agents/src/closer/**` — type-only
  imports only. That directory's runtime is network-free, but it is not run by
  this demo.

> Fallback note: the type-only import of the closer barrel resolves under the
> web app's existing `tsconfig` (`moduleResolution: "Bundler"`; `@cognitia/core`
> aliased; `node:crypto` via `@types/node`). If a future config change breaks
> that cross-package type import, mirror the minimal spine display types locally
> in the view-model instead — do not edit `tsconfig`.

## Mock-safe contract

- Persistent banner: **`MOCK ONLY · NO LIVE SEND · NO REAL CRM`**.
- No send / dial / SMS / WhatsApp / email / post / publish control exists, and no
  copy implies a live external action.
- Synthetic, PII-safe fixtures only (`example.com`, masked contact). No network,
  no persistence, no live CRM write.

## Canonical target

**PR #138 (`/operator`, branch `claude/w4-operator-console-sales-closer-i66m4r`)
remains the canonical operator console target.** It owns
`apps/web/src/app/operator/**` and `apps/web/src/lib/operatorConsole.ts` and is
built on the web-local compliance engine. To avoid conflicting with that
ownership, this demo lives at the clearly temporary `/gtm-os-demo` route with a
separate view-model file (`gtmOsConsoleViewModel.ts`) and is wired to the closer
spine schema. It should be retired or folded into `/operator` once #138 lands.

## Run it

```sh
pnpm --filter @cognitia/web run dev
# open http://localhost:3000/gtm-os-demo
```

### Verify

```sh
pnpm --filter @cognitia/web run typecheck
pnpm vitest run apps/web/src/lib/gtmOsConsoleViewModel.test.ts
```
