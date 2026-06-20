# WORKSTREAM MAP

**Compiled:** 2026-06-20 · **Legend:** `[VERIFIED]` read this session · `[INFERRED]` from PR bodies/branch names (not a content audit). Branch→workstream mapping is INFERRED unless a file was read.

> Cognitia is **not** a video/media company. The Hermes Vision Skill is one supporting artifact. The thesis spine is **Demandara (GTM brand) → Sales Closer (AI voice+text sales agent) → Client Zero (auto dealership proof loop)**, on the Cognitia trust/control plane.

---

## WS1 — Sales Closer (core engine) · CRITICAL PATH

- **Canonical & merged `[VERIFIED]`:** #93 (closer data layer: migrations 0020/0021, `packages/core/src/schemas/closer.ts`, `packages/db` repo + RLS/guard tests) + #97 (PII-safe GTM primitives in `@cognitia/core`).
- **Supporting merged docs `[VERIFIED]`:** #91 (data-source strategy), #92 (compliance spec), #98 (vendor porting memo).
- **Superseded `[INFERRED]`:** #94 greenfield prototype (closed; #98 names it reference-only, not for merge), #95 vendor-readiness memo (superseded by #98), #108/#101 doc-sync lanes, `sales-closer-architecture-989w7r`.
- **Canonical pick:** **#93 + #97 (landed).** Everything else stacks on these or is reference-only.

## WS2 — Client Zero / Auto Growth OS · CRITICAL PATH (proof artifact)

- **Primary `[VERIFIED state]`:** #106 — `clients/client-zero-auto-growth/` proposal + discovery + static-HTML console; reuses `hermes/skills/vision-skill/` as the pre-publish photo gate. Draft, watch-only, keep ready.
- **Overlapping lanes `[INFERRED]`:** #90 (Auto Growth OS demo _app_, `exciting-shannon`), #109 (Demandara ads/media engine). These are **duplicate/adjacent** dealership-GTM lanes.
- **Canonical pick `[RECOMMENDED]`:** **#106** as the client-facing package/proof artifact; #90 only if a working demo app is explicitly wanted; treat #109 as Demandara-media (WS8), not Client Zero.

## WS3 — Compliance layer · CRITICAL PATH

- **Spec merged `[VERIFIED]`:** #92.
- **Implementation `[VERIFIED]`:** #96 — **MERGED to `main` 2026-06-20T23:42:20Z** (merge commit `d3d198e7`), UI/helper/demo-only: `apps/web/**` + one docs file, **zero `packages/core` diff**, no DB/API/worker/vendor/outreach. Compliance view-models web-local in `apps/web/src/lib/complianceTypes.ts` (reuse #97 unions type-only); core has no duplicate compliance surface.
- **Canonical pick:** **#96 (landed).**

## WS4 — Vendor readiness

- **Merged memo `[VERIFIED]`:** #98 (platform-native porting map; Apify + voice adapters as future, simulation-first).
- **Prototype memos `[INFERRED]`:** #95 (draft, superseded by #98).
- **Canonical pick:** **#98 (landed).** No live vendor integration this cycle (hard rule).

## WS5 — Apify ingestion

- **Primary `[VERIFIED]`:** #99 — governed, fixture-first scaffold (`packages/integrations/src/apify/*`), network-off by default, 35 tests. Draft, base = merged #93 branch → **retarget to `main` + rebase**.
- **Canonical pick:** **#99**, after retarget/rebase + review. Validate against the now-landed #96/#93 surface on `main`.

## WS6 — Goal-loop harness

- **Primary `[VERIFIED]`:** #105 — `harness/hctl.py` stdlib-only CLI; writes only under `goals/`; schemas + worked example. Sandboxed, watch-only.
- **Spec sibling `[INFERRED]`:** #100's `goal-loop-harness-mvp-spec.md`.
- **Canonical pick:** **#105** (implementation) informed by #100 (spec). Watch-only.

## WS7 — GTM consolidation / strategy

- **Primary `[VERIFIED]`:** #107 — `docs/gtm/` index + ~110-branch inventory + 7-day merge plan (mapping self-declared inference).
- **Strategy siblings `[INFERRED]`:** #100 (Goal Loop Sprint), #103 (36h GTM report), #102 (36h loop checkpoint), #101 (execution-order record), #89 (investor-grade audit/wedge — open non-draft), #88 (cross-session audit).
- **Canonical pick:** **#107** as the branch-selection map; this `docs/consolidation/` set supersedes/updates it with verified PR states.

## WS8 — Demandara media / ads

- **Primary `[INFERRED]`:** #109 (Demandara ads + media house engine, Worker C, base ep002), `demandara-ads-engine` branch.
- **Posture:** spec/scaffold only. **No paid ads, no live media spend** (hard rule). Ads readiness = NOT READY per #100.

## WS9 — Hermes Vision QC

- **Primary `[VERIFIED state]`:** #104 (`CHECKPOINT-6H.md`, ep002 scoped, docs-only) + the `hermes/skills/vision-skill/` artifact on the working branch + #61 (Hermes bridge stdio loop fix).
- **Role:** supporting publish-safety/photo-QC gate for Client Zero inventory (WS2). **Not** the company. Watch-only.

## WS10 — Agent Economy / token sandbox · PARKED (strategic R&D)

- **Branches/PRs `[INFERRED]`:** #48/#49/#51 (economy lab, dispute, agent actions), #50 (passports), #52/#54 (marketplace), #53 (settlement), #55 (TOKEN-LAB-002 token architecture), #18 (2-week spec), #69 (Agent Fabric Lab), plus `agent-economy-*`, `token-lab-*` branches.
- **Posture:** **execution-paused, internal-ledger-only.** No public token, no liquidity, no coin. Kept in place (no archive/delete). See PARKED-AND-KILLED.md.

## WS11 — Crypto visibility / public trust feed · PARKED (strategic R&D)

- **Branches/PRs `[INFERRED]`:** #58 (CRYPTO-VISIBILITY-001), #64 (12h crypto-visibility sprint), #59/#60/#62/#63 (trust/proof feed), #65–#68 (VISIBILITY pack), `crypto-visibility-001`.
- **Posture:** parked strategic R&D; diligence-readiness research only. No public token tie-in.

## Parked / background governance wave (history)

- The large governance/trust/hardening cluster (#10–#47, mostly stacked on `gtm-platform-mvp-setup-vYLBG`) — kill-switch, audit explorer, rollback, scorecards, readiness gates, COG-002…010 trust core. `[INFERRED]` Mostly closed (merge-UNVERIFIED). Off the current critical path; mine for reusable primitives, do not re-run.

---

## Duplicate-lane summary (for manager pick — see BLOCKERS.md)

| Theme                      | Lanes                                          | Recommended canonical                        |
| -------------------------- | ---------------------------------------------- | -------------------------------------------- |
| Sales Closer foundation    | #93/#97 (merged) vs #94 (greenfield)           | **#93 + #97**                                |
| Vendor memo                | #98 (merged) vs #95 (draft)                    | **#98**                                      |
| Dealership/Client Zero     | #106 (package) vs #90 (demo app) vs #109 (ads) | **#106** (package); #90/#109 distinct roles  |
| Lead Detail console        | #44 vs #45 vs #79 vs #46 (COG-011/012/014)     | **pick one** via #107 — needs manager review |
| Goal-loop                  | #105 (impl) vs #100 (spec)                     | **#105** + #100 spec                         |
| GTM strategy/consolidation | #107 vs #100/#101/#102/#103/#88                | **#107** + this folder                       |
