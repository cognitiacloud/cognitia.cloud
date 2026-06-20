# NEXT 7 DAYS — execution order

**Compiled:** 2026-06-20 · **Goal of the week:** reach **one green Client Zero × Sales Closer spine on `main`** by _converging_ existing lanes — not by building new features.

**Legend:** `[RECOMMENDED]` actions for the team. This session does not merge/undraft/close anything. Hard rules apply (no real outreach/ads/vendor/token/mobile).

---

## Day 1 — Review #96 (compliance convergence)

- **Why first:** #96 is open, non-draft, mergeable-clean, **CI green** `[VERIFIED]`, and has already converged onto the merged #93/#97 foundation. The expensive part (rework) is done; what remains is judgment.
- **Do:** human-read the #96 diff. Confirm (a) `packages/core` carries **no** second compliance surface (already `[VERIFIED]` clean on `main`), (b) compliance view-models live in `apps/web/src/lib/complianceTypes.ts` and import #97 unions **type-only**, (c) the 620/620 test claim reproduces locally.
- **Decision:** name a merge owner. If the review passes → schedule merge (a later session, with permission). If not → file the specific deltas. **Do not rework blindly — it may already be correct.**

## Day 2 — Retarget + rebase #99 (Apify Phase-2)

- **Why:** #99's base (`claude/sales-closer-engine-plan-c3quih`) has **merged**, so its current green CI is against a base that no longer exists as an open lane. `[VERIFIED]`
- **Do:** retarget #99 base → `main`; rebase; re-run CI. Re-read against #93's _landed_ schema (the `closer_*` tables) and #97's GTM unions to confirm no drift. Keep it draft, fixture-first, network-off.
- **Gate:** do **not** review-for-merge until Day 1's #96/#93 alignment is understood (they share `packages/core`/`packages/integrations` surface area).

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
2. **#96** — only if Day-1 review finds a real delta (it may need none).
3. **Lead-Detail duplicate cluster** — collapse #44/#45/#79/#46 to one canonical lane.

## What to LEAVE ALONE this week

- Mobile apps · public token / liquidity / coin · paid ads / live media spend · real outreach / live vendor calls / credential testing · agent-economy & crypto-visibility lanes (#48–#69) · the closed governance wave (#10–#47).
- **Do not** merge, undraft, close, or delete any branch/PR in this session's scope without explicit manager permission.
