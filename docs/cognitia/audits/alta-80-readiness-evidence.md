# Alta 80+ Readiness — Evidence & Honest Rescore

Date: 2026-06-22
Branch: `overnight/gtm-implementation` · PR #158 (draft, kept draft)
Latest pass: `/gtm-os-integrated-demo` now renders from the **real** `@cognitia/agents`
modules through a server-only adapter (the structural mirror was removed).

> **Honesty contract.** This document still does **not** claim 80+. The route now
> consumes real module output (a genuine step up), but deployment, persistence,
> enterprise enforcement, and live-readiness sign-off do not yet exist. Per the
> overnight guardrails, 80+ requires evidence that is not yet present.

---

## 1. What changed this pass — real wiring (no more mirror)

`apps/web` now depends on `@cognitia/agents` (`workspace:*`). A **server-only**
adapter, `apps/web/src/lib/server/gtmIntegratedDemoData.ts`, runs the real
modules and feeds the route:

| Surface     | Real call                                                  | Evidence it is the real module                                                                                                |
| ----------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| B1 assembly | `assembleGtmRunPacket(...)` (×3 runs)                      | async run; packet → console view                                                                                              |
| B2 channels | `planDryRunAction(...)` + `evaluateChannelPolicy(...)`     | actions carry the real `planRef` + `wouldSendIfLive`; a test asserts the action's keys equal a direct `planDryRunAction` call |
| B3 CRM-lite | `createMockCrmLite(...)`                                   | idempotent double-upsert ⇒ one `Opportunity`; real timeline                                                                   |
| B4 audience | `buildAudience(...)`                                       | a test compares the adapter's rejection of a scraped row to a direct `buildAudience` call                                     |
| B5 TrustOps | `computeTrustOpsMetrics(...)` + `buildTrustOpsReport(...)` | funnel over the 3 real runs; report markdown carries the module's MOCK/SANDBOX banner                                         |
| B6 gates    | `evaluateReleaseGate(...)`                                 | `controlled_live` fails closed; matches a direct call                                                                         |

The previous hand-authored structural mirror in `gtmIntegratedDemoViewModel.ts`
was removed; that file now holds only the shared PII guard, banner constants,
and `canProceed`. The route is an **async server component**; no client
component imports `@cognitia/agents`.

### Verification (this branch HEAD)

| Check                                    | Result                                                                                                |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `pnpm check` (format → typecheck → test) | ✅ **786 tests passed (105 files)**                                                                   |
| Real pipeline executes                   | ✅ the adapter test calls `loadIntegratedDemoData()` (runs the real modules) and asserts on output    |
| Web ↔ agents resolution                  | ✅ web `tsc` + root `vitest` resolve `@cognitia/agents` (workspace symlink + vitest alias)            |
| Live-egress                              | ✅ no network/vendor imports; no `fetch(`; dry-run `sent` is the literal `false` type                 |
| Raw PII                                  | ✅ full serialized real output passes `assertNoRawPii`; off-list values only in guard-rejection tests |
| Live automation                          | ✅ unchanged — no live path enabled                                                                   |

---

## 2. Honest rescore — Alta **implementation** parity

| Stage                                    |      Score | Basis                                                                                                                 |
| ---------------------------------------- | ---------: | --------------------------------------------------------------------------------------------------------------------- |
| Before any overnight code                |        ~38 | closer + ledger + policy + DB base                                                                                    |
| After B1–B6 modules (PR #158)            |     ~50–55 | six tested mock-safe modules, latent                                                                                  |
| After the visible (mirror) demo          |     ~62–68 | full pipeline visible + tested, but web reproduced semantics                                                          |
| **After real-module wiring (this pass)** | **~68–74** | the route's data path now executes the real integrated modules, proven by tests; the structural-mirror caveat is gone |

**Why still not 80+ (honest ceiling):**

1. **No deployment / reachable environment.** Verified as source + typecheck +
   tests, not a running URL. A production `next build` additionally requires
   `transpilePackages: ['@cognitia/agents']` in `next.config.mjs` (the package
   ships TS source); that one-line config is **not** in this lane's owned files,
   so it is documented here rather than applied. `pnpm check` (and CI build-test)
   do not run `next build`, so this is not exercised yet.
2. **No persistence.** CRM-lite/timeline/proofs are in-memory per request; the
   TrustOps funnel is over a deterministic 3-run scenario, not stored runs.
3. **No enterprise enforcement bound to the route.** The B6 permission model is
   not yet gating route access or the approval path.
4. **Live automation readiness unchanged (~22)** — and must stay so.

Docs are **not** counted as implementation in these numbers.

---

## 3. Blockers to an honest 80+, classified

### A. In-scope-next (mock-safe, no forbidden deps)

- Add `transpilePackages: ['@cognitia/agents']` + a `next build` in CI so the
  route is proven to build, not just typecheck/test.
- Persist CRM-lite/timeline/proofs (e.g. via `@cognitia/db`) and compute
  TrustOps over stored runs instead of a fixed scenario.
- Bind the B6 permission model to the route and the approval/policy path.

### B. Infrastructure (not a code toggle)

- A deployed, reachable environment; observability/monitoring + rollback.

### C. Forbidden in any overnight lane (require external sign-off)

- Legal/counsel sign-off; signed customer scope; consent records.
- Live connector approvals; CRM credentials; channel/vendor approvals.
- Any live email/SMS/WhatsApp/call/LinkedIn/ad — `controlled_live` stays closed
  until all 7 conditions are recorded.

---

## 4. Loop decision

The constraint lift (allowing the `@cognitia/agents` dependency) was applied and
delivered: the route now renders from real module output, verified by tests that
execute the real pipeline. That removed the largest honesty caveat and moved the
honest implementation-parity estimate to **~68–74**.

Reaching a true 80+ now depends on class **A** (deployment/persistence/enforcement
— partly out of this lane's owned files, e.g. `next.config`, DB, route auth) and,
for live, class **C** (external sign-off, forbidden here). Stopping at this honest
ceiling rather than inflating the score. PR #158 remains a draft; no state change.
