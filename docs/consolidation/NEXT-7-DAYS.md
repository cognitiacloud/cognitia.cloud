# NEXT 7 DAYS — execution order

**Compiled:** 2026-06-20 · **Goal of the week:** reach **one green Client Zero × Sales Closer spine on `main`** by _converging_ existing lanes — not by building new features.

**Legend:** `[RECOMMENDED]` actions for the team. This session does not merge/undraft/close anything. Hard rules apply (no real outreach/ads/vendor/token/mobile).

---

## Day 1 — Review #96 (compliance convergence) — ✅ DONE

- **Status:** **#96 merged to `main` 2026-06-20T23:42:20Z** (merge commit `d3d198e7`) under manager authorization, after the converged commit passed CI green. Landed **UI/helper/demo-only** — `apps/web/**` + one docs file, **zero `packages/core` diff**, no DB/API/worker/vendor/outreach changes.
- **Verified at merge:** core carries no second compliance surface; view-models web-local in `apps/web/src/lib/complianceTypes.ts` importing #97 unions type-only; fixtures/tests assert no raw PII.
- **Carry-forward:** Day-1 capacity now rolls to #99 (below).

## Day 2 — Retarget + rebase #99 (Apify Phase-2)

- **Why:** #99's base (`claude/sales-closer-engine-plan-c3quih`) has **merged**, so its current green CI is against a base that no longer exists as an open lane. `[VERIFIED]`
- **Do:** retarget #99 base → `main`; rebase; re-run CI. Re-read against #93's _landed_ schema (the `closer_*` tables) and #97's GTM unions to confirm no drift. Keep it draft, fixture-first, network-off.
- **Gate:** #96 has landed, so the #96/#93 alignment is now visible in `main`; validate #99 against that landed surface (`packages/core`/`packages/integrations`) before review.

## Day 3 — Canonical-branch selection (use #107)

- **Do:** open #107's `branch-inventory.md` + `workstream-map.md`; cross-check against this folder's verified PR states. For each duplicate cluster (see WORKSTREAM-MAP §Duplicate-lane summary), record a **canonical pick** and mark losers _"superseded pending manager review"_ — **no closing, no deleting** (hard rule).
- **Key picks to ratify:** Sales Closer = #93+#97; vendor = #98; Client Zero = #106; Apify = #99; goal-loop = #105.
- **Open question to resolve:** the COG-011/012/014 Lead-Detail lanes (#44/#45/#79/#46) — pick exactly one.

## Day 4 — Client Zero readiness (#106) as proof artifact

- **Do:** review #106 as the client-facing proposal/discovery package. Verify guardrails (no guaranteed sales/ROI/rankings; finance/trade-in = collect-and-handoff with approval marker). Confirm the Hermes Vision Skill integration point (photo privacy/quality gate) is referenced, not rebuilt.
- **Decision needed:** is there a **real consenting Client Zero dealership**? If yes → plan a baseline/discovery (no outreach yet). If no → keep #106 spec-only and ready. Either way, **no real vendor wiring** this week.

## Day 5 — Spine integration read-through (no merges)

- **Do:** trace the intended `main` spine end-to-end on paper: GTM prospect (`@cognitia/core` #97) → governed data source (#91 strategy) → closer data layer (#93 `closer_*`) → compliance gate (#92 spec + #96 impl) → Apify ingestion (#99) → Client Zero proposal (#106). Identify any contract gap _before_ code.
- **Output:** a short "spine gap list" appended to EXECUTION-BOARD.md. Still no merging.

## Day 6 — Triage the open non-critical PRs

- **Do:** classify #89 (investor audit — open non-draft), #88 (session audit), #101/#102/#103 (strategy reports), #108 (doc-sync), #86/#78/#79 (operator UI / meeting-notes) into workstreams. Decide watch-only vs. close-candidate (manager only). Leave agent-economy/crypto (#48–#69) **parked**.

## Day 7 — Consolidation checkpoint

- **Do:** update this `docs/consolidation/` set with any state changes from the week (merges, retargets, picks). Re-confirm: nothing in the parked/killed list was reactivated without authorization. Produce a one-paragraph founder update.

---

## What to rework FIRST (ranked)

1. **#99** — retarget/rebase (mechanical, unblocks the Apify lane). _Highest-value, lowest-risk._
2. ~~#96~~ — **DONE** (merged to `main` `d3d198e7`).
3. **Lead-Detail duplicate cluster** — collapse #44/#45/#79/#46 to one canonical lane.

## What to LEAVE ALONE this week

- Mobile apps · public token / liquidity / coin · paid ads / live media spend · real outreach / live vendor calls / credential testing · agent-economy & crypto-visibility lanes (#48–#69) · the closed governance wave (#10–#47).
- **Do not** merge, undraft, close, or delete any branch/PR in this session's scope without explicit manager permission.
