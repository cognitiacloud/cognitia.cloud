# PR #96 — Compliance-Layer Scaffold: Compliance Review

**Verdict: READY — retrospective confirmation; already merged to `main`.**

- **PR:** #96 — "Compliance-layer scaffold — converged on #93 canonical foundation"
- **State:** `merged` into `main` on 2026-06-20 (merge commit `d3d198e`).
- **Convergence base:** #93 (canonical platform-native Sales Closer data layer) and
  #97 (Demandara GTM PII-safe primitives + guardrail helpers) — both merged to `main`.
- **Reviewed at:** `origin/main` @ `d3d198e`.
- **Scope of review:** read-only verification against the five hard-rule checks. No PR
  state change, no source edits.

> **No merge action remains.** #96 is already merged. If this had still been open, the
> evidence below supports a READY verdict.

---

## Evidence

All evidence gathered read-only from `origin/main` (the merged state).

| # | Check | Result | Evidence |
|---|-------|--------|----------|
| 1 | No duplicate compliance/channel contract surface in `packages/core` | ✅ PASS | `packages/core/src/types/index.ts` contains **zero** of `Channel`, `ChannelStatus`, `ComplianceDecision`, `EvidenceField`, `ChannelEligibility`, `ComplianceLog`, `CompliancePolicy`, `ComplianceCheckResult`, `OutreachDraft`, `HumanApprovalGate`. Core matches `main`; no second compliance surface competes with #93/#97. |
| 2 | #96 reuses #97 GTM primitives **type-only** where appropriate | ✅ PASS | Every `@cognitia/core` import in the web compliance files is `import type` (no runtime import → web bundle stays free of core's zod/`node:crypto`): <br>• `apps/web/src/lib/complianceTypes.ts`: `import type { ConsentStatus, ContactBasis, IsoTimestamp, SourceRisk, Uuid } from '@cognitia/core'` <br>• `apps/web/src/lib/compliance.ts`: `import type { GtmProspect } from '@cognitia/core'` <br>• `apps/web/src/lib/complianceFixtures.ts`: `import type { GtmProspect } from '@cognitia/core'` <br>• `apps/web/src/lib/dataSources.ts`: `import type { DataSource } from '@cognitia/core'` |
| 3 | Web-local compliance view models stay in `apps/web` | ✅ PASS | `apps/web/src/lib/complianceTypes.ts` defines the demo presentation types (`Channel`, `ChannelStatus`, `ComplianceDecision`, `EvidenceField`, `ChannelEligibility`, …). Importers (`compliance.ts`, `complianceFixtures.ts`, `portal/settings/page.tsx`) point at `./complianceTypes`, not core. |
| 4 | #96 touched only `apps/web` + docs | ✅ PASS | `git show --stat d3d198e`: all changed files under `apps/web/src/**` plus `docs/`. No `packages/core`, DB, API, worker, vendor, outreach, config, or `pnpm-lock.yaml` changes. |
| 5 | Tests / typecheck / format green | ✅ PASS | CI `build-test` = **success** on the merged head (two runs completed 2026-06-20). PR body reports `pnpm test` **620/620**, `pnpm run typecheck` clean, `pnpm run format:check` clean, web build prerenders the compliance demo routes. |
| 6 | Clean against `main` | ✅ PASS (merged) | PR is `merged: true`; merge commit `d3d198e` is present on `origin/main`. No outstanding conflict. |
| 7 | PII doctrine | ✅ PASS | No raw `contactEmail` / `contactPhone` in the web compliance files — only hash / mask / domain and doctrine comments. Consistent with #97's PII-safe `GtmProspect`. |

---

## Residual risks (non-blocking)

1. **Web-local naming overlap (cosmetic).** The demo types `Channel` / `ComplianceDecision`
   / `EvidenceField` and helpers (`checkChannelCompliance`, `requiresHumanReviewForChannel`,
   `isSourceUsable`) echo core concepts (`canUseSourceForProspecting`, `canContactProspect`).
   They are *parallel-but-asserted* (parity asserted in tests), not duplicated contracts in
   shared core — acceptable for a demo layer. Worth noting only if the demo is ever promoted.

2. **Demo-only / presentation-only scope.** This layer has no DB / API / worker wiring; it is
   web governance-page presentation. It does not participate in the canonical data path.

3. **Future productionization must avoid drift from #93/#97.** If these compliance/channel
   view models are ever promoted to runtime, they must be re-homed into `@cognitia/core`
   (zod schemas mirroring `closer.ts` / the GTM unions) so they cannot drift from the
   canonical #93 data layer and #97 primitives.

---

## Recommendation

No merge action remains — #96 is already merged to `main` and CI was green on the merged
commit. All five hard-rule verification points (no duplicate core surface, type-only #97
reuse, web-local view models, scope confined to `apps/web` + docs, green CI) are satisfied.
The residual items above are non-blocking and tracked for any future promotion of the demo
layer to shared core. For the human record: the convergence onto #93/#97 was executed
correctly and the result is sound.
