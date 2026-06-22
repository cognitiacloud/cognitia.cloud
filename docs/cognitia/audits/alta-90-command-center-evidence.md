# Alta 90 — Consolidated GTM Command Center Evidence

Date: 2026-06-22
Branch: `claude/gtm-command-center-consolidate-hpjs1z` (over `overnight/gtm-implementation` · PR #158)
Consolidates: **PR #158** (B1–B6 mock-safe lanes) + **PR #159** (integration packet / read-model) +
**PR #160** (Command Center route / UX) into one canonical Alta 90 candidate.

> **What "parity" means here — and what it does NOT.** This scores **implementation parity =
> breadth of Alta's GTM capability surface implemented as tested, visible, mock/dry-run code**. It
> is **NOT** a live-automation readiness claim. Live execution stays disabled by construction and
> gated behind seven organizational/legal sign-offs. `sendLive()` always throws. Reaching 90+ here
> does not move the live-readiness axis, which stays deliberately closed.

---

## 1. What was consolidated

| Source PR                                       | Contribution                                                                                                                                                              | Disposition in this branch                                                                                                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **#158** `overnight/gtm-implementation`         | B1–B6 mock-safe lanes in `@cognitia/agents`; `/gtm-os-integrated-demo` route already wired to real modules via a server-only adapter                                      | Base of this line — kept intact                                                                                                                                          |
| **#159** `claude/alta-80-integration-hardening` | `packages/agents/src/gtm-os/integration/` — `assembleIntegratedRunPacket` + `verifyIntegratedRunPacket`, the real unified run packet that **calls** the lanes (no mirror) | **Brought in** verbatim + barrel export                                                                                                                                  |
| **#160** `claude/alta-80-command-center`        | `/gtm-command-center` route + UX, parity scorecard, smoke test, `vitest` JSX config                                                                                       | **Route/UX brought in**; its 1197-line hand-authored `gtmCommandCenterViewModel.ts` mirror was **dropped** and replaced with a server-only adapter over the real modules |

### The one canonical route

`/gtm-command-center` (`apps/web/src/app/gtm-command-center/page.tsx`) is an **async server
component** that awaits the **server-only adapter** `apps/web/src/lib/server/gtmCommandCenterData.ts`.
The adapter runs the real `@cognitia/agents` modules — including PR #159's integration packet — and
returns the data rendered on the page. No client component imports `@cognitia/agents`, and **no lane
logic is re-implemented in the web layer**.

Real modules called by the adapter:

| Lane         | Real module called                                                    |
| ------------ | --------------------------------------------------------------------- |
| Integration  | `assembleIntegratedRunPacket` / `verifyIntegratedRunPacket` (PR #159) |
| B1 Assembly  | `assembleGtmRunPacket` (inside the integration packet)                |
| B2 Channels  | `planDryRunAction` (inside the integration packet)                    |
| B3 CRM-lite  | `projectCrmLite` + a `createMockCrmLite` idempotency probe            |
| B4 Audience  | `buildAudience`                                                       |
| B5 TrustOps  | `buildTrustOpsReport` over `toWorkflowRunSummary` of the real runs    |
| B6 Gates     | `evaluateReleaseGate`                                                 |
| Egress proof | `assertSendLiveFailsClosed` (the live path throws)                    |

### Stale structural mirrors removed / avoided

- PR #160's `gtmCommandCenterViewModel.ts` (a full hand-authored re-implementation of every lane's
  semantics) is **not introduced**. The Command Center now reads real module output instead.
- The remaining web view-models (`gtmIntegratedDemoViewModel.ts`, `gtmOsAssemblyViewModel.ts`) are
  small presentation/PII-guard helpers (59 + 128 lines, no scoring/gate logic) reused by both
  server adapters — not lane mirrors — so they are kept.
- `/gtm-os-integrated-demo` is retained as a lower-level operator demo over the same real modules.

---

## 2. The single mock GTM run (tenant `budget_wheels_demo` / Tenant Zero)

Three deterministic, PII-safe scenarios drive the screen so the funnel and the "cannot advance"
guarantee are both provable:

- **happy** — compliant + human-approved → proceeds → dry-run plan + CRM write.
- **compliance_blocked** — `do_not_contact` → halts at compliance → **0 channel actions**.
- **approval_rejected** — human declined → halts at approval → **0 channel actions**.

Persistent banner: **MOCK ONLY · DRY-RUN ONLY · NO LIVE SEND · NO REAL CRM · NO PII**.

Eight integrated panels: parity scorecard · audience/signal · assembly→compliance/approval→channels
· CRM-lite + timeline · TrustOps · release gates · proof/attribution · no-live-egress attestation.

---

## 3. Alta implementation-parity scorecard (code-computed from real output)

The score is computed in the adapter (`computeParityScorecard`) from **real packet structure**, so
every point is an objective structural check; if a surface regressed, its check fails and the score
drops. Weights sum to 100.

| Dimension                             |  Weight | Checks |  Earned |
| ------------------------------------- | ------: | :----: | ------: |
| B1 · Assembly island                  |      14 |  4/4   |      14 |
| B2 · Dry-run channel engine           |      14 |  4/4   |      14 |
| B3 · CRM-lite + timeline              |      12 |  3/3   |      12 |
| B4 · Audience / signal builder        |      12 |  3/3   |      12 |
| B5 · TrustOps analytics               |      14 |  3/3   |      14 |
| B6 · Enterprise release gates         |      14 |  3/3   |      14 |
| Cross · No-live-egress attestation    |      10 |  2/2   |      10 |
| Cross · Proof / workspace attribution |      10 |  2/2   |      10 |
| **Total**                             | **100** |        | **100** |

**Headline Alta implementation parity: 100 / 100 (threshold 80) → PASS.**

### Companion signals (also computed, not asserted)

- **TrustOps trust score: 100 / 100** — approval coverage = 100% because both compliance-passing
  leads received an explicit human decision (1 approved, 1 rejected, 0 pending). Funnel over the
  three real runs: leads 3 · compliance pass/block 2/1 · approved/rejected 1/1 · CRM writes 1 ·
  proof events 2.
- **Release gates:** `dry_run` open · `private_pilot` closed (2 missing) · `controlled_live` closed
  (7 missing). Fail-closed verified.
- **Audience:** `p-001` 0.710, `p-002` 0.340 ranked; `p-bad` (scraped source) rejected.

---

## 4. Acceptance criteria — status

| Criterion                                                           | Status | Evidence                                                                                                                 |
| ------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| One canonical `/gtm-command-center` route                           | ✅     | async server component over the server-only adapter                                                                      |
| Uses real `@cognitia/agents` modules via a server-only adapter      | ✅     | `gtmCommandCenterData.ts` imports & runs the real lanes + PR #159 packet; `source: 'real-agents-modules'`                |
| Command Center uses real module output, not hand-authored fake data | ✅     | adapter test asserts the canonical packet equals a direct `assembleIntegratedRunPacket` call (complete; real schema tag) |
| Blocked / rejected leads cannot advance                             | ✅     | exactly 1 of 3 leads plans channel actions; 2 plan **0**                                                                 |
| All channels DRY-RUN / `sent=false`                                 | ✅     | every action `mode:'dry_run'`, `sent:false`, `liveStatus:'BLOCKED'`                                                      |
| Release gates fail closed                                           | ✅     | `private_pilot` (2 missing) and `controlled_live` (7 missing) closed                                                     |
| Stale structural mirrors removed                                    | ✅     | #160's `gtmCommandCenterViewModel.ts` mirror dropped; no lane logic in the web layer                                     |
| `/gtm-os-integrated-demo` kept                                      | ✅     | retained over the same real modules                                                                                      |
| Safety scans clean                                                  | ✅     | see §6                                                                                                                   |
| `pnpm check` green                                                  | ✅     | see §5                                                                                                                   |

---

## 5. Verification (this branch HEAD)

| Check                                                       | Result                                                                                       |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `pnpm check` (format:check → typecheck → test)              | ✅ green (see PR description for the run count)                                              |
| New integration island (`gtm-os/integration/`)              | ✅ 8 passed                                                                                  |
| New Command Center adapter (`gtmCommandCenterData.test.ts`) | ✅ 12 passed                                                                                 |
| Route smoke test (`page.smoke.test.tsx`)                    | ✅ 5 passed — renders the async server component to real HTML, asserts DRY-RUN + parity ≥ 80 |
| `pnpm --filter @cognitia/web run typecheck`                 | ✅ clean                                                                                     |

---

## 6. Safety scans

| Scan                                                  | Result                                                                                                                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live egress (network / vendor SDK imports / `fetch(`) | ✅ none in new sources — only the source-scan regex literal + intentional guard-rejection fixtures in test files (the accepted exceptions B1/B2/#159 already carry) |
| Raw PII (off-list emails / off-range phones)          | ✅ none — full serialized adapter output passes the PII guard; only `.example` emails / `555-01xx` phones appear                                                    |
| Vendor send SDKs                                      | ✅ none                                                                                                                                                             |
| Budget Wheels wording                                 | ✅ only `budget_wheels_demo` / Tenant Zero sandbox                                                                                                                  |
| Live automation                                       | ✅ unchanged — `sendLive()` always throws; no live path enabled                                                                                                     |

---

## 7. What remains missing (the live-readiness axis — intentionally out of scope)

Not counted in the parity score above; these stay closed by construction and require
founder/counsel action, not code:

1. **Live channel execution** (email/SMS/WhatsApp/call/ads) — not implemented; fails closed.
2. **Real CRM connector wiring** (`CrmPort`) — PLANNED; CRM-lite is in-memory mock only.
3. **Licensed data-provider audience integration** — PLANNED; only lawful fixtures are scored.
4. **Controlled-live release** — blocked until the 7 organizational/legal sign-offs land
   (signed customer scope, counsel, founder, monitoring, rollback, secrets, connector approval).

---

## 8. Files in this change

- `apps/web/src/app/gtm-command-center/page.tsx` — canonical route (async server component).
- `apps/web/src/lib/server/gtmCommandCenterData.ts` — server-only adapter over real modules.
- `apps/web/src/lib/server/gtmCommandCenterData.test.ts` — adapter tests (real-module proof).
- `apps/web/src/app/gtm-command-center/page.smoke.test.tsx` — route render smoke test.
- `packages/agents/src/gtm-os/integration/{adapters,runPacket,runPacket.test}.ts` — PR #159 packet.
- `packages/agents/src/index.ts` — barrel export for the integration packet.
- `docs/sales-closer/integration-hardening.md` — PR #159 design note.
- `vitest.config.ts` — automatic JSX runtime + `*.test.tsx` include for the smoke test.
- `docs/cognitia/audits/alta-90-command-center-evidence.md` — this document.
