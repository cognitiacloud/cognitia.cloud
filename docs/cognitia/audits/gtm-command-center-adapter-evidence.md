# GTM Command Center — server-only adapter hardening (evidence)

**Scope.** Harden the server-only adapter that feeds `/gtm-command-center` so the
route is backed by **real `@cognitia/agents` module calls**, not a structural
mirror. Reconciles PR #158 (B1–B6 lanes), PR #159 (integration-hardening island),
and PR #160 (the visible route) onto the PR #158 / `overnight/gtm-implementation`
line.

> Honest framing. Everything here is `MOCK` / `SANDBOX` / `DRY-RUN-ONLY`. No live
> egress, no vendor SDK, no real CRM, no raw PII. Nothing here raises live
> readiness. Live paths fail closed and stay gated behind the B6 `controlled_live`
> release gate (7 sign-offs incl. counsel + founder).

## What changed and why

PR #160 shipped `/gtm-command-center` over a **structural mirror**
(`gtmCommandCenterViewModel.ts`, ~1200 lines) that re-implemented every B1–B6
semantic in `apps/web` because it assumed `apps/web` "can't depend on
`@cognitia/agents`". PR #159 similarly removed the real server adapter. The
`overnight/gtm-implementation` base disproves that assumption: a Next.js **server
component** can import a server-only module that calls `@cognitia/agents`
directly (see the pre-existing `/gtm-os-integrated-demo` route).

This change adopts the real-adapter architecture for the Command Center:

| Artifact                                                               | Role                                                                                                                                                                                                                               |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/agents/src/gtm-os/integration/runPacket.ts` (+`adapters.ts`) | PR #159's composing island — `assembleIntegratedRunPacket` calls B1–B6 and `verifyIntegratedRunPacket` proves completeness. The canonical real-module composer.                                                                    |
| `apps/web/src/lib/server/gtmCommandCenterData.ts`                      | **Server-only** adapter feeding the route. Runs the real B1–B6 modules + the integration packet. PII guard over serialized output. `source: 'real-agents-modules'`.                                                                |
| `apps/web/src/lib/gtmCommandCenterViewModel.ts`                        | **Pure presentation** only: banner/constants, PII guard, `canProceed`, and the auditable `computeParityScorecard` over real adapter output. **No** signal scoring / channel planner / CRM store / trust weighting / release rules. |
| `apps/web/src/app/gtm-command-center/page.tsx`                         | Async **server component**; awaits the adapter, renders real data.                                                                                                                                                                 |

The ~1200-line structural mirror is gone; no core B1–B6 semantics are reproduced
in `apps/web`.

## Provenance (real-module) proof

`apps/web/src/lib/server/gtmCommandCenterData.test.ts` calls each lane module
**directly** with the adapter's inputs and asserts the adapter output is
identical:

- B4 `buildAudience()` — ranked + rejected rows equal; scraped/`apify` sources
  really rejected by the module.
- B6 `evaluateReleaseGate()` — all three stages equal; `controlled_live` fails
  closed with 7 missing conditions.
- B5 `computeTrustOpsMetrics()` / `buildTrustOpsReport()` — metrics, trust score,
  and markdown equal over the real run summaries.
- B2 `planDryRunAction()` — channel plans equal; halted leads plan nothing.
- B1 `assembleGtmRunPacket()` — status / finalState / proof kinds equal.
- Integration: the route data is backed by a **complete** integrated run packet
  (PR #159).

## Verification

- `pnpm check` — **green**: format:check + typecheck (root `tsc` + `@cognitia/web`)
  - **809 tests (108 files)**, including 8 integration-island tests, 10
    Command-Center provenance/safety tests, and 5 route smoke tests.
- Safety scans over the changed sources — clean: no `fetch`/network/vendor SDK
  imports, no off-list emails, no off-range phones, Budget Wheels only as
  `budget_wheels_demo` / Tenant Zero sandbox.
- No client component imports `@cognitia/agents`; all such imports are confined to
  `apps/web/src/lib/server/` (the view-model uses a type-only, erased import).

### Known blocker (pre-existing, not introduced here)

`next build` fails to resolve the NodeNext `.js` import specifiers under its
default webpack resolver. This affects the **pre-existing** `/gtm-os-integrated-demo`
route identically (unchanged by this work), so it is a repo-wide condition, not a
regression. The project's canonical gate is `pnpm check` (tsc + vitest), which is
green; the route is proven to render via the `react-dom/server` smoke test.

## Out of scope (intentionally gated)

Live channel execution · real CRM connector wiring · licensed-provider audience ·
controlled-live release — all blocked until founder/counsel sign-off; not code
toggles.
