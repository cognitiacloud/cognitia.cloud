# Alta 80+ Readiness — Evidence & Honest Rescore

Date: 2026-06-22
Branch: `overnight/gtm-implementation` · PR #158 (draft) → consolidation candidate
stacked on PR #158 (consolidates PR #159 + PR #160).
Latest pass: a single visible **`/gtm-command-center`** route renders the whole
B1–B6 loop from the **real** `@cognitia/agents` modules through a server-only
adapter, plus PR #159's verified integrated run packet. `next build` now
succeeds. The structural mirror is removed (never imported).

> **Honesty contract.** Two distinct scores are reported and must not be
> conflated:
>
> - **Mock/dry-run capability-surface score: 100/100** (threshold 80) — _computed
>   and proven_ over real module output. This is the breadth of Alta's GTM
>   surface implemented as tested, visible, mock/dry-run code. It is **not** a
>   live-automation readiness claim.
> - **Official Alta implementation parity: 78/100** (threshold 80) — the honest
>   ceiling. Real modules + integrated packet + visible route + dry-run safety +
>   lane breadth + build provability are credited; **persistence, route-bound
>   enforcement, reachable deployment, and live readiness are zero** because they
>   do not yet exist. We do **not** claim 80+ here.
>
> Exact blockers to a confident 80+: **persistence** of runs/CRM/proofs (+8) and
> **route-bound enforcement** (+6) — either alone crosses the line. Deployment
> and live readiness are separate, intentionally out-of-scope axes.

---

## 0. Consolidation pass (latest) — one Alta candidate over PR #158

This pass consolidates the two follow-up explorations into one clean candidate
on top of PR #158's real-module adapter, and removes the structural mirror for
good.

| Brought in                                                                         | From    | How it is used now                                                                                                  |
| ---------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| Integrated run packet (`assembleIntegratedRunPacket`, `verifyIntegratedRunPacket`) | PR #159 | The data contract: one verified artifact composing B1–B6 for the headline lead. `verify…` reports **8/8** sections. |
| Visible Command Center UX + parity scorecard                                       | PR #160 | The investor-facing `/gtm-command-center` route — but fed by the **real** adapter, not the 1,197-line mirror.       |
| Server-only real-module adapter pattern                                            | PR #158 | `apps/web/src/lib/server/gtmCommandCenterData.ts` runs the real lanes + the integrated packet.                      |

What changed materially vs. the prior pass:

1. **A second, investor-ready visible route** (`/gtm-command-center`) renders all
   B1–B6 surfaces + the integrated packet on one screen, from real modules.
2. **`next build` is now proven green.** The pre-existing blocker (TS "Bundler"
   `.js` specifiers + TS-source workspace packages) is fixed in `next.config.mjs`
   via `transpilePackages` (all four `@cognitia/*` packages) + a webpack
   `extensionAlias` (`.js → .ts/.tsx`) + `serverExternalPackages: ['pg']`. Both
   `/gtm-command-center` and `/gtm-os-integrated-demo` now prerender as static
   content. This moves build-provability from PLANNED to **done**.
3. **The structural mirror is gone.** The command center never imports a
   hand-authored lane reproduction; the only web-side logic is the two pure,
   auditable scorecards computed _over_ real output, plus a shared PII guard.
4. **Two honest scores, never conflated** (see the honesty contract above).

### Verification (this candidate)

| Check                                    | Result                                                                                          |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `pnpm check` (format → typecheck → test) | ✅ **813 tests passed (108 files)** — 786 baseline + 8 integration + 13 adapter + 6 smoke       |
| `next build`                             | ✅ compiles; `/gtm-command-center` + `/gtm-os-integrated-demo` prerender as static content      |
| Real pipeline executes                   | ✅ adapter test runs the real lanes + integrated packet and asserts real-module provenance      |
| Integrated packet complete               | ✅ `verifyIntegratedRunPacket` → 8/8 sections; mode `mock`; `noLiveEgress: true`                |
| Dry-run channels                         | ✅ every action `sent:false`, live `BLOCKED`; `sendLive` proven to throw (fail-closed tripwire) |
| Release gates                            | ✅ `dry_run` open; `controlled_live` fails closed (7 conditions missing)                        |
| Live-egress / raw-PII scan (new code)    | ✅ no network/vendor imports, no `fetch(`, no off-list emails/phones, no live send call sites   |
| Capability-surface score                 | ✅ **100/100** (computed over real output; sum of earned == headline)                           |
| Official implementation parity           | ✅ **78/100** honest ceiling, pinned by test; threshold 80 **not** met (reported honestly)      |

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

| Stage                                        |  Score | Basis                                                                                                                 |
| -------------------------------------------- | -----: | --------------------------------------------------------------------------------------------------------------------- |
| Before any overnight code                    |    ~38 | closer + ledger + policy + DB base                                                                                    |
| After B1–B6 modules (PR #158)                | ~50–55 | six tested mock-safe modules, latent                                                                                  |
| After the visible (mirror) demo              | ~62–68 | full pipeline visible + tested, but web reproduced semantics                                                          |
| After real-module wiring (PR #158 `407a724`) | ~68–74 | the route's data path executes the real integrated modules, proven by tests; the structural-mirror caveat is gone     |
| **After consolidation (this candidate)**     | **78** | + integrated verified packet (#159) + second visible route (#160 UX) + **`next build` proven green**; computed/pinned |

The 78 is now a **computed, test-pinned** figure (`computeImplementationParity`),
not a hand-waved band. Its ten weighted axes sum to 100; six are credited
(real-module integration 18, integrated packet 12, visible route 10, dry-run
safety 14, lane breadth 16, build provability 8 = **78**) and four are zero
(persistence 8, route-bound enforcement 6, reachable deployment 4, live
readiness 4).

**Why still not a confident 80+ (honest ceiling):**

1. ~~No production `next build`~~ — **fixed this pass.** `transpilePackages` (all
   four `@cognitia/*`) + a webpack `extensionAlias` + `serverExternalPackages:
['pg']` make `next build` succeed; both integrated routes prerender. This is
   the +8 build-provability axis, now earned.
2. **No persistence (+8, still zero).** CRM-lite/timeline/proofs are in-memory
   per request; the TrustOps funnel is over a deterministic 3-run scenario, not
   stored runs. **This is the single biggest remaining lever.**
3. **No enterprise enforcement bound to the route (+6, still zero).** The B6
   permission model is not yet gating route access or the approval path.
4. **Live automation readiness unchanged (~22)** — and must stay so; it is a
   separate axis, deliberately at zero.

Either (2) or (3) alone would carry the official figure past 80; both are
in-scope-next and mock-safe, but were left out of this consolidation to keep it
a clean, low-risk merge of the existing pieces rather than new feature surface.

Docs are **not** counted as implementation in these numbers.

---

## 3. Blockers to an honest 80+, classified

### A. In-scope-next (mock-safe, no forbidden deps)

- ~~Add `transpilePackages` + a `next build` so the route is proven to build~~ —
  **done this pass.** `next build` compiles and prerenders both integrated routes
  (run it locally with `pnpm --filter @cognitia/web run build`). Wiring it into
  CI is the only remaining step and is a workflow change, not product code.
- Persist CRM-lite/timeline/proofs (e.g. via `@cognitia/db`) and compute
  TrustOps over stored runs instead of a fixed scenario. **(+8 — biggest lever.)**
- Bind the B6 permission model to the route and the approval/policy path.
  **(+6.)**

### B. Infrastructure (not a code toggle)

- A deployed, reachable environment; observability/monitoring + rollback.

### C. Forbidden in any overnight lane (require external sign-off)

- Legal/counsel sign-off; signed customer scope; consent records.
- Live connector approvals; CRM credentials; channel/vendor approvals.
- Any live email/SMS/WhatsApp/call/LinkedIn/ad — `controlled_live` stays closed
  until all 7 conditions are recorded.

---

## 4. Loop decision

The consolidation delivered one clean Alta candidate over PR #158: a single
visible `/gtm-command-center` route rendering the whole B1–B6 loop from real
modules + PR #159's verified integrated packet, with `next build` now proven
green and the structural mirror removed. The honest, test-pinned official
implementation-parity figure is **78/100**; the mock/dry-run capability-surface
score is a proven **100/100**.

Per the scoring rule, **80+ is not claimed as the official figure** — the honest
ceiling is 78, with the exact, in-scope-next blockers named: persistence (+8) and
route-bound enforcement (+6), either of which crosses 80. They were deliberately
left out to keep this a low-risk consolidation of existing pieces rather than new
feature surface; they are the obvious next lane. Live readiness stays at zero
(class **C**, external sign-off, forbidden here) and must. No PR state change is
made without founder approval; PRs remain drafts.
