# Alta 80+ Readiness — Evidence & Honest Rescore

Date: 2026-06-22
Branch: `overnight/gtm-implementation` · PR #158 (draft, kept draft)
Scope of this pass: the visible integrated operator demo route over B1–B6.

> **Honesty contract.** This document does **not** claim 80+. Per the overnight
> guardrails, a score above 80 requires evidence that does not yet exist
> (runtime-wired breadth, deployment, enterprise enforcement, live-readiness
> sign-off). This records what is now demonstrable, the honest score, and the
> exact blockers — several of which are **out of scope or forbidden** for this
> lane, which is why the honest ceiling is reached here rather than 80+.

---

## 1. What is now demonstrable (new this pass)

A single visible route — `/gtm-os-integrated-demo` — renders the integrated mock
GTM system end-to-end and is backed by unit tests:

| Surface                                              | Lane    | Evidence                                                      |
| ---------------------------------------------------- | ------- | ------------------------------------------------------------- |
| Audience & signal ranking                            | B4      | ranked lawful prospects + rejected scraped sources            |
| Assembly packet → compliance/approval → dry-run plan | B1 + B2 | per-lead timeline/proofs; dry-run actions all `sent:false`    |
| CRM-lite records                                     | B3      | mock, idempotent (one record on double-upsert)                |
| TrustOps metrics & report                            | B5      | funnel, approval coverage, bounded trust score, no-egress     |
| Release gates                                        | B6      | `controlled_live` fails closed with missing conditions listed |
| Why-live-blocked + controlled-live requirements      | —       | single block reason + the 7 sign-offs                         |

Persistent banner on the route: **MOCK ONLY / DRY-RUN ONLY / NO LIVE SEND / NO REAL CRM**.

### Verification (this branch HEAD)

| Check                                                 | Result                                                                                                       |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `pnpm check` (format → typecheck → test)              | ✅ **786 tests passed (104 files)**                                                                          |
| New demo tests (`gtmIntegratedDemoViewModel.test.ts`) | ✅ **15 passed**                                                                                             |
| Live-egress                                           | ✅ none — no network/vendor imports; dry-run `sent` is the literal `false` type                              |
| Raw PII                                               | ✅ none — full serialized view passes `assertNoRawPii`; off-list values appear only in guard-rejection tests |
| Live automation                                       | ✅ unchanged — no live path enabled                                                                          |

---

## 2. Honest rescore — Alta **implementation** parity

| Stage                                  |      Score | Basis                                                                                                         |
| -------------------------------------- | ---------: | ------------------------------------------------------------------------------------------------------------- |
| Before any overnight code              |        ~38 | closer workflow + ledger + policy + DB base only                                                              |
| After B1–B6 modules (PR #158)          |     ~50–55 | six tested mock-safe capability modules, but latent/self-contained                                            |
| **After this visible integrated demo** | **~62–68** | the full pipeline is now visible, integrated on one screen, and test-backed; this is a real demo/breadth gain |

**Why not higher (the honest ceiling):**

1. The web demo **reproduces** the lane semantics structurally; it does not
   runtime-import `@cognitia/agents`. The agents modules are independently
   tested and real, and the web route is real and tested — but they are not
   wired by import. True wiring needs a package/tsconfig dependency change,
   which is **out of scope** for this lane.
2. **No deployment** — there is no running, reachable environment; this is
   source + tests only.
3. **No enterprise enforcement on the route** — the B6 permission model is not
   bound to the route's access (binding it would require editing files outside
   the owned set).
4. **No persistence / no analytics over real runs** — the funnel is computed
   from a deterministic mock scenario, not stored workflow runs.
5. **Live automation readiness unchanged (~22)** — and must stay so.

Docs are **not** counted as implementation in these numbers.

---

## 3. Blockers to an honest 80+, classified

### A. Out of scope for this lane (would need files/changes not owned here)

- Runtime-wire `apps/web` → `@cognitia/agents` (package dependency + tsconfig
  path) so the route renders real packet/metric objects, not structural mirrors.
- Bind the B6 permission model to the route and to the approval/policy path so
  permissions actually gate actions.
- Map real `WorkflowRun` records into the TrustOps input (B5 adapter).
- Implement the closer `CrmPort` against B3 so writeback is exercised by the
  workflow rather than reproduced in the view-model.

### B. Infrastructure (not a code toggle)

- A deployed, reachable environment (the demo currently proves out as source +
  unit tests, not a live URL).
- Persistence for CRM-lite/timeline/proofs.
- Observability/monitoring + rollback wired into a real runtime.

### C. Forbidden in any overnight lane (require external sign-off)

- Legal/counsel sign-off owner; signed customer scope; consent records.
- Live connector approvals; CRM credentials; channel/vendor approvals.
- Any live email/SMS/WhatsApp/call/LinkedIn/ad — the `controlled_live` gate
  stays closed until **all 7** conditions are recorded.

---

## 4. Loop decision

The loop rule is "continue until evidence honestly scores 80+, or until blocked
by a real missing dependency." Within the owned-file scope and the hard rules
(no package/tsconfig/live changes), the highest-impact remaining gaps are all in
classes **A–C above** — i.e. real missing dependencies and forbidden scope. The
in-scope, mock-safe work that raises _implementation parity_ without those
dependencies has been delivered (the visible, tested, integrated demo).

**Conclusion:** honest implementation parity is **~62–68**, not 80+. Stopping at
this honest ceiling rather than inflating the score. The next true step-changes
require the out-of-scope wiring (A), infrastructure (B), and — for live —
external sign-off (C). PR #158 remains a draft; no state change made.
