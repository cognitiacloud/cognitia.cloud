# EXECUTION BOARD — Cognitia / Demandara

**Compiled:** 2026-06-21 · **Branch:** `claude/execution-board-setup-eb7nqr` · **Mode:** execution controller (truth-check + board; **NOT a build session**).

**This session takes NO action on any existing PR** — no merge, undraft, close, delete, archive, retarget, or branch update. It only reads/verifies PRs and writes new docs under `docs/execution/`. `main` HEAD at compile = `d3d198e` (the #96 merge commit).

**Legend:** `[VERIFIED]` = read this session via GitHub API (`merged_at` / single-PR endpoint / file read) · `[INFERRED]` = derived from PR bodies / branch names, not a line-by-line audit · `[RECOMMENDED]` = controller recommendation, pending manager ratification · `[UNVERIFIED]` = not checked this session.

**Positioning guardrail (do not redefine):** Cognitia = agent trust/control plane + compliance + Sales Closer/GTM OS. Demandara = GTM/growth/operator brand. Sales Closer = voice+text lead-qualification product. Client Zero = auto-dealership proof loop. **Hermes Vision Skill = one supporting publish-safety artifact — Cognitia is _not_ a video/avatar company.**

---

## 0. Ledger summary — `[VERIFIED]` snapshot **through PR #110** (`merged_at` read this session)

**Scope of this ledger:** Verified ledger snapshot **through PR #110** (#11–#110, 100 PRs). This is **not** a "current live all-PR state" — later review-artifact PRs (#112–#116) landed after the snapshot and are **tracked separately** in §4a (review docs / watch-only), not re-counted in the buckets below.

| Bucket (through #110)                               | Count          | PRs                                    |
| --------------------------------------------------- | -------------- | -------------------------------------- |
| **Total in snapshot**                               | 100 (#11–#110) | —                                      |
| **Merged** (`merged_at` present)                    | 68             | see §1 + §2                            |
| **Closed-unmerged** (abandoned/superseded)          | 8              | #18, #31, #71, #72, #73, #74, #82, #94 |
| **Open — draft**                                    | 23             | see ACTIVE-PR-QUEUE.md                 |
| **Open — non-draft**                                | 1              | **#89**                                |
| **Post-snapshot review artifacts** (not re-counted) | 4 tracked      | #112, #113, #114, #116 — see §4a       |

> **Verification upgrade over `docs/consolidation/` (PR #110):** that pass marked most _closed_ PRs `merge-UNVERIFIED` because the list endpoint's `merged` flag is unreliable. This board reads **`merged_at`** (reliable) for the snapshot through #110, so merge status is VERIFIED end-to-end for that range. The six-PR spine below was additionally re-read via the single-PR endpoint this session. PRs after #110 are review/retrospective artifacts (§4a), not product-build lanes, and are tracked rather than re-bucketed.

---

## 1. Merged canonical spine — the only "done" surface · `[VERIFIED]`

The current-thesis (Sales Closer × Client Zero) spine on `main`. Each `merged_at` confirmed this session.

| PR      | Merged (UTC)         | Verified via                                              | What landed                                                                                                                        | Key paths on `main`                                                               |
| ------- | -------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **#97** | 2026-06-20T03:33:35Z | single-PR read                                            | `@cognitia/core` PII-safe GTM primitives (`GtmProspect`, `DataSource`, unions, guardrail helpers, 22 tests)                        | `packages/core/src/types/index.ts`, `packages/core/src/gtm/`                      |
| **#91** | 2026-06-20T10:26:14Z | list `merged_at`                                          | Data-source strategy memo (CASL/CRTC/PIPEDA guardrails, Apify actor test order)                                                    | `docs/sales-closer/data-source-strategy.md`                                       |
| **#92** | 2026-06-20T10:26:21Z | list `merged_at`                                          | Compliance system spec (`consent_basis`, append-only `compliance_log`, per-channel rules; SMS/WhatsApp/AI-voice blocked at launch) | `docs/compliance/compliance-system-spec.md`                                       |
| **#98** | 2026-06-20T10:26:27Z | list `merged_at`                                          | Vendor integration porting memo (names #93 canonical; #94/#95 superseded)                                                          | `docs/sales-closer-engine/VENDOR_INTEGRATION_PORTING.md`                          |
| **#93** | 2026-06-20T10:31:30Z | single-PR read                                            | **Canonical Sales Closer data layer** — migrations 0020/0021 (`closer_*` tables), core schemas, db repo + RLS/guard tests          | `packages/core/src/schemas/closer.ts`, `packages/db/**`, migrations `0020`/`0021` |
| **#96** | 2026-06-20T23:42:20Z | single-PR read (`merged:true`, `merged_by` cognitiacloud) | Compliance layer **UI/helper/demo-only**, converged on #93/#97, **zero `packages/core` diff**                                      | `apps/web/**`, `apps/web/src/lib/complianceTypes.ts`                              |

**Spine integrity:** #96 removed its parallel core compliance surface so `packages/core` matches `main` exactly; compliance view-models are web-local and import #97 unions type-only. No raw PII (hash/mask/domain only) — asserted by tests in #93/#96/#97.

---

## 2. Merged-but-frozen history — on `main`, OFF the current critical path · `[VERIFIED]` merged / `[INFERRED]` clustering

These merged historically. They are **not reactivated and get no further build**. Mine for reusable primitives only.

- **Governance / SOC / trust core wave** (#11–#47 ready PRs; COG-002…010 = #32–#38): kill-switch, audit explorer, rollback, scorecards, readiness gates, proof registry, ATC, reputation, credits placeholder.
- **Pilot / RLS / lanes** (#75 meeting, #76 drafting-governance, #77 HubSpot, #83/#84/#85 pilot+RLS harness, #80/#81/#87 audit/orchestrator/docs).
- **Agent Economy** (#48, #49, #51, #52, #53, #55, #69) — **PARKED** (see DECISIONS.md). Merged code is frozen; no further build.
- **Crypto-visibility / public trust feed** (#58, #59, #60, #62, #63, #64, #65, #66, #67, #68) — **PARKED**. Frozen.

> Some parked-lane code is _already merged_ on `main`. "Parked" governs **forward** work: no new build, no extension, no public-token/crypto tie-in, regardless of historical merges.

---

## 3. Critical path — next moves (no execution this session)

| #   | Task                                                  | Owner            | Status                                          | Acceptance criteria                                                                                                                                   | Next action                                |
| --- | ----------------------------------------------------- | ---------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| T1  | Publish this execution board (docs-only)              | Eng (controller) | In progress                                     | `docs/execution/**` only; clean diff vs `main`; draft PR                                                                                              | Open draft PR                              |
| T2  | **#99 review + retarget _recommendation_**            | Mgr + Eng        | Pending — **recommendation only, no execution** | A written, reviewed plan: retarget #99 base→`main`, rebase, re-run CI, re-validate vs landed `closer_*`/#97. **No retarget performed by controller.** | Authorized eng session executes later      |
| T3  | Reconcile #107 + #110 → ratify canonical picks        | Mgr              | Pending                                         | Each duplicate cluster has one canonical pick; losers marked "superseded pending manager review" (no close/delete)                                    | Use §Duplicate table in ACTIVE-PR-QUEUE.md |
| T4  | Resolve Lead-Detail duplicate lanes (#44/#45/#79/#46) | Mgr + Eng        | Pending                                         | Exactly one COG-011/012/014 lead-detail lane chosen canonical                                                                                         | Compare the four; pick one                 |
| T5  | Review #106 Client Zero package as proof artifact     | Mgr              | Ready (draft)                                   | Guardrails verified (no guaranteed sales/ROI; finance/trade-in = handoff + approval marker); Hermes Vision gate referenced, not rebuilt               | Day-4 review; keep ready                   |
| T6  | Spine read-through (#97→#91→#92→#93→#96)              | Eng              | Not started                                     | End-to-end contract trace passes with no gap; produce spine gap list                                                                                  | Day-5 read-through                         |

---

## 4. Watch-only PRs (no action unless CI/review demands) · `[VERIFIED]` state

| PR              | Item                                         | Status             | Note                                                   |
| --------------- | -------------------------------------------- | ------------------ | ------------------------------------------------------ |
| #100            | Goal Loop Sprint research/specs              | draft              | informs strategy; base `ep002`                         |
| #104            | ep002 / Hermes Vision QC checkpoint          | draft              | docs-only                                              |
| #105            | Goal-loop harness (`harness/hctl.py`)        | draft              | sandboxed to `goals/`; first-wave **review** target    |
| #106            | Client Zero Auto Growth OS package           | draft              | proof artifact; first-wave **review** target           |
| #107            | GTM consolidation index (`docs/gtm/`)        | draft              | branch-selection input for T3                          |
| #110            | Master consolidation (`docs/consolidation/`) | draft              | prior truth-check; reconcile with this board in T3     |
| #90             | Auto Growth OS demo app                      | draft              | dealership-GTM duplicate-adjacent (see queue)          |
| #101 / #108     | Sales-closer doc-sync lanes                  | draft              | low-risk docs                                          |
| #102 / #103     | 36h loop / GTM report                        | draft              | strategy docs; base `ep002`                            |
| #88             | cross-session audit (`SESSION_AUDIT.md`)     | draft              | triage Day-6                                           |
| #86 / #78 / #79 | meeting-notes / operator UI / lead-detail UI | draft              | triage Day-6                                           |
| #89             | Investor audit + wedge                       | **open non-draft** | only open non-draft; triage as docs/GTM                |
| #109            | Demandara ads + media house engine           | draft              | **no paid ads / live spend** (hard rule); base `ep002` |

---

## 4a. Post-snapshot review artifacts (after #110) — **review docs / watch-only, NOT build lanes**

These PRs landed after the §0 ledger snapshot. They are **review/retrospective documentation**, not product-build lanes — included here so the board doesn't claim the snapshot is the current all-PR state. No action unless review demands.

| PR       | Item                                 | Type       | Note                                                                        |
| -------- | ------------------------------------ | ---------- | --------------------------------------------------------------------------- |
| **#112** | PR #99 review artifact               | review doc | feeds the #99 retarget/rebase **recommendation** (T2); no execution implied |
| **#113** | #107 / #110 reconciliation artifact  | review doc | input to canonical-pick reconciliation (T3)                                 |
| **#114** | PR #105 review artifact              | review doc | input to goal-loop harness sandbox review (Day-5)                           |
| **#116** | PR #96 retrospective review artifact | review doc | post-merge retrospective of the landed compliance layer                     |

> These are **watch-only**. They do not change the spine, do not open a build lane, and are tracked separately from the verified-through-#110 buckets in §0.

---

## 5. Blockers (severity = impact on one green Client Zero × Sales Closer spine)

| #   | Blocker                                                                               | Severity                             | Owner | Unblock action                                                                |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------ | ----- | ----------------------------------------------------------------------------- |
| B2  | **#99 stacked on a merged base** (`sales-closer-engine-plan-c3quih` merged 10:31:30Z) | Medium                               | Eng   | Retarget→`main` + rebase + re-CI — **recommendation only; not executed here** |
| B3  | **Legal/compliance sign-off owner unnamed** (gates go-live)                           | High (go-live) / Low (spec-only now) | Mgr   | Name the owner; until then all outreach/ads/vendor stays simulated            |
| B4  | **Canonical-branch selection** among duplicate lanes                                  | Medium                               | Mgr   | Ratify picks via #107 + #110 (T3)                                             |
| B5  | **Client Zero consent unknown** (real dealership or spec-only?)                       | High (execution) / None (artifact)   | Mgr   | Confirm yes/no; if no, keep #106 spec-only                                    |
| B6  | Local working branch lacked monorepo (process)                                        | Low                                  | —     | Resolved this session: branch fast-forwarded to `main` for accurate paths     |

---

## 6. Parked / killed (pointer — full register in DECISIONS.md)

- **PARKED (execution-paused, kept in place):** Agent Economy (#48–#55, #69, #18), internal token sandbox (#55/token-lab — **internal-ledger-only, no issuance**), crypto-visibility / public trust feed (#58–#68), gated expansions (multi-vertical, self-serve, **mobile**, paid-media, performance-share).
- **KILLED (do not build/message):** public token / liquidity / coin, investor-token promises, "replace your sales team" messaging, guaranteed ROI/SEO/ranking claims, voice/SMS/WhatsApp-as-wedge, paid ads / live spend, real outreach / live vendor calls / credential testing.
- **Scope guardrail (#19):** no agent-economy/token thesis pivots without explicit re-authorization.

---

## 7. Exact next-7-day execution order — first wave (review + reconcile, **no new build**)

> First-wave model is **locked**: Controller + #96 review + #99 review + #106 review + #105 review + #107/#110 reconciliation. **No build workers are launched from this board.**

| Day       | Action                                                                                                                                                                                       | Output                                 | Guardrail                                    |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------- |
| **Day 1** | Publish this controller board (this PR). Verify the landed #96 surface on `main` (read-through).                                                                                             | `docs/execution/**` live as draft PR   | docs-only; no PR actions                     |
| **Day 2** | **#99 review and retarget _recommendation_** — write the exact retarget/rebase/CI steps for an authorized eng session. **No execution.**                                                     | #99 review note (RECOMMENDED) appended | controller does not retarget/rebase/push #99 |
| **Day 3** | Reconcile #107 (branch index) + #110 (consolidation) against verified PR states → record canonical picks; mark losers "superseded pending manager review".                                   | canonical-pick list (RECOMMENDED)      | no close/delete/retarget                     |
| **Day 4** | Review #106 Client Zero package — guardrails (no guaranteed sales/ROI; finance/trade-in = handoff + approval marker); Hermes Vision gate referenced, not rebuilt.                            | #106 readiness note                    | keep #106 draft                              |
| **Day 5** | Review #105 goal-loop harness (sandboxed to `goals/`) + spine read-through (#97→#91→#92→#93→#96).                                                                                            | spine gap list                         | no merges                                    |
| **Day 6** | Triage open non-critical PRs (#89 non-draft, #88, #90, #101, #102, #103, #104, #108, #109) → watch-only vs manager-decision; flag duplicate lanes (#44/#45/#79/#46; #54 vs #52; #95 vs #98). | triage table                           | leave parked lanes parked                    |
| **Day 7** | Checkpoint — update `docs/execution/`, confirm nothing parked was reactivated without authorization, write one-paragraph founder update.                                                     | refreshed board + founder note         | —                                            |

---

## 8. PRs that MUST be reviewed before ANY new build (review-gate)

No new feature build begins until these are reviewed and the spine read-through is gap-free:

1. **#96** — confirm the landed compliance layer (UI/helper/demo-only; zero `packages/core` diff). `[VERIFIED merged]`
2. **#99** — review + produce retarget recommendation (do **not** merge or retarget here).
3. **#106** — Client Zero guardrail review (proof artifact readiness).
4. **#105** — goal-loop harness review (sandbox boundary `goals/`).
5. **#107 + #110** — reconcile into a single canonical-branch picks list.
6. **Spine read-through** of #91 / #92 / #93 / #97 / #98 — end-to-end contract trace.

Everything in §2 (frozen history) and §6 (parked/killed) is **out of scope** for new build.
