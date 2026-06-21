# Sales Closer — Execution-Order Status

> Tracking record for the manager-approved execution order across the Sales Closer
> PR stack. Updated as steps are settled. Source of truth for "what landed, what's
> held, and why."

**Last updated:** 2026-06-20

## Hard guardrail (in force)

No new vendor implementation, real outreach, voice/SMS, scraping, persistence
expansion, or adapter work until **#93 is stable**. Not started: zod/persistence
follow-up, vendor adapter scaffold, Apify continuation beyond review, voice/SMS/
WhatsApp/outbound, new DB/API/worker work, Client Zero implementation inside core.

Allowed parallel work only: review/merge doctrine, review/merge foundation,
monitor existing PRs, extract UI lessons from #94, prepare post-#93 specs/tests
without code expansion.

## Step status

| #   | Item                                   | Action                                                       | State                                                                                                                                                                                                                                                                                                                                                                          |
| --- | -------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **#91** data-source strategy           | Review/settle                                                | ✅ **Merged** to `main` (squash `ea8de64`). Docs-only.                                                                                                                                                                                                                                                                                                                         |
| 2   | **#92** compliance spec                | Review/settle                                                | ✅ **Merged** to `main` (squash `9a3325e`). Docs-only.                                                                                                                                                                                                                                                                                                                         |
| 3   | **#98** vendor porting memo            | Quick-review vs #91/#92, then merge                          | ✅ **Merged** to `main` (squash `fd0d3f0`). Docs-only vendor doctrine.                                                                                                                                                                                                                                                                                                         |
| 4   | **#93** platform-native foundation     | Force canonical, land                                        | ✅ **Merged** to `main` (squash `623953e`). Title/body corrected; CI green; doctrine verified.                                                                                                                                                                                                                                                                                 |
| 5   | **#96** compliance-layer scaffold (UI) | Merge **iff** UI/helper/demo only                            | ⏸️ **Held for convergence** (manager decision). Marked back to draft. Keep the UI + `lib/compliance`/`dataSources` + 29 safety tests; re-cut against current `main` and **consume #93's `schemas/closer.ts` + #92's `consent_basis`** instead of adding parallel compliance/channel types to `packages/core/src/types/index.ts`; keep any demo-only types local to `apps/web`. |
| 6   | **#99** Phase-2 Apify scaffold         | Technical review while stacked; **no merge until #93 lands** | ✅ **Reviewed** (strong; fixture-first, doctrine-faithful). Kept **draft**, **not merged**. #93 has now landed → only mechanical step left (retarget base→`main` + re-CI) is deferred under the hold.                                                                                                                                                                          |
| 7   | **#94** greenfield prototype           | Archive/close after extracting design lessons                | ✅ **Closed** as reference; design lessons extracted → `PROTOTYPE_94_DESIGN_LESSONS.md` (branch retained so **#95** stays stacked). Live screenshots not captured (would require running the greenfield app).                                                                                                                                                                  |

## Doctrine layer now on `main`

- `docs/sales-closer/data-source-strategy.md` (#91)
- `docs/compliance/compliance-system-spec.md` (#92)
- `docs/sales-closer/vendor-readiness-platform-port.md` (#98)
- `docs/sales-closer-engine/IMPLEMENTATION_PLAN.md` + closer data layer (#93)

## #96 decision note (for the manager)

#96 is mostly UI (`apps/web` pages + `lib/compliance`/`dataSources` + tests) and is
CI-green (601/601 local). The one thing that pushes it past a strict reading of
"UI/helper/demo only" is **+112 lines of new compliance/channel types in
`packages/core/src/types/index.ts`** (`Channel`, `ChannelStatus`,
`ComplianceLog`, `CompliancePolicy`, `OutreachDraft`, etc.). These are **type-only**
(no runtime, no zod, no persistence) and the web app imports them type-only, but
they (a) extend the shared core type surface and (b) conceptually overlap with the
canonical persisted contract just landed in `packages/core/src/schemas/closer.ts`
(#93). **Decision: HOLD for convergence.** #96 is marked back to draft; the path to
unblock is to re-cut against current `main` and have the demo consume #93's
canonical `schemas/closer.ts` contracts + #92's `consent_basis` model rather than
adding a parallel compliance/channel type block to core, keeping any demo-only types
local to `apps/web`. The UI, helpers, and safety tests are kept; only the type
home/convergence changes.

## Branch/stacking notes

- **#95** (vendor-readiness memo) — remains **draft**, superseded by #98; do not merge
  as-is. Its base is #94's branch, which is **retained on close** so #95 is not orphaned.
- **#99** base is still #93's pre-merge branch tip; GitHub did not auto-delete it on
  merge, so #99 stays open and stacked. Retarget to `main` only when un-held.
