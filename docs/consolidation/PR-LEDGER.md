# PR LEDGER — full inventory (PRs #10–#109)

**Compiled:** 2026-06-20 · 100 PRs parsed from the GitHub list endpoint.

**Legend:** `[VERIFIED]` = single-PR endpoint / file read this session · `merge-UNVERIFIED` = the list endpoint's `merged` field is unreliable (returns `false` for all), so a *closed* PR may have been merged **or** closed-without-merge — not distinguishable without a per-PR read. CI status is shown only where read this session; otherwise `not-checked`.

**Aggregate (all 100):** 2 open non-draft (#89, #96) · 22 open draft · 59 closed non-draft · 17 closed draft.

---

## A. Decision-critical PRs — `[VERIFIED]` this session

| PR | Title / branch | State | Merge | CI | Contains | Action | Risk |
|----|----------------|-------|-------|----|----------|--------|------|
| **#93** | canonical Sales Closer data layer · `claude/sales-closer-engine-plan-c3quih` | closed | **MERGED 10:31:30Z** `[V]` | green (PR body) | migrations 0020/0021, core closer schemas, db repo + RLS/guard tests | none — landed | low |
| **#97** | Demandara GTM core types · `claude/demandara-gtm-scaffold` | closed | **MERGED 03:33:35Z** `[V]` | green (PR body) | PII-safe `GtmProspect`, `DataSource`, GTM unions + helpers, 22 tests | none — landed | low |
| **#91** | data-source strategy memo · `claude/sales-closer-datasource-strategy-ory6db` | closed | **MERGED 10:26:14Z** `[V]` | not-checked | data-source decision record, compliance guardrails | none — landed | low |
| **#92** | compliance system spec · `claude/cognitia-compliance-design-xpzaj3` | closed | **MERGED 10:26:21Z** `[V]` | not-checked | `consent_basis`, `compliance_log`, per-channel rules, approval gates | none — landed | low |
| **#98** | vendor integration porting memo · `claude/sales-closer-vendor-integration-porting` | closed | **MERGED 10:26:27Z** `[V]` | not-checked | names #93 canonical, #94/#95 superseded; porting map | none — landed | low |
| **#96** | Compliance-layer scaffold, converged on #93 · `feat/cognitia-compliance-layer-scaffold` | **open** | not merged `[V]` | **green 22:04Z** `[V]` | compliance demo converged onto #93/#97; view-models web-local; claims 620/620 tests | **human review + merge decision** (don't merge now) | medium — needs sign-off |
| **#99** | Sales Closer Phase-2 Apify scaffold · `claude/sales-closer-phase2-apify` | open · draft | not merged `[V]` | green on **merged base** `[V]` | fixture-first Apify ingestion, network-off default, 35 tests | **retarget base→`main` + rebase**, re-CI, review | medium — stacked on merged branch |
| **#100** | Goal Loop Sprint research/specs · `claude/cognitia-goal-loop-sprint-0dl803` | open · draft | not merged `[V]` | not-checked | 9 research/spec artifacts; KILL/PARK/BUILD; 5 founder decisions | watch-only | low (docs) |
| **#104** | 6-hour checkpoint ep002/Hermes QC · `claude/6-hour-checkpoint-3m29tz` | open · draft | not merged `[V]` | not-checked | `CHECKPOINT-6H.md`, 1 file, docs-only | watch-only | low (docs) |
| **#105** | file-based goal loop harness · `claude/cognitia-goal-loop-harness-xd6laa` | open · draft | not merged `[V]` | not-checked | `harness/hctl.py` + schemas/templates; writes only `goals/` | watch-only | low (sandboxed) |
| **#106** | Client Zero Auto Growth OS · `claude/auto-growth-dealership-proposal-22ntav` | open · draft | not merged `[V]` | not-checked | proposal + discovery + console (static HTML) under `clients/client-zero-auto-growth/` | watch-only; keep ready as proof artifact | low (docs/specs) |
| **#107** | GTM branch-level consolidation index · `claude/cognitia-gtm-competitor-research-fpxg4o` | open · draft | not merged `[V]` | not-checked | `docs/gtm/` index + ~110-branch inventory + 7-day plan | watch-only; use to select canonical branches | low (docs) |

---

## B. Other open PRs — `[INFERRED]` from list (state/draft verified; content from titles)

| PR | Title (abbrev) | Head branch | Base | Draft |
|----|----------------|-------------|------|-------|
| #109 | Demandara ads + media house engine (Worker C) | `demandara-ads-engine-gktfc5` | ep002 | draft |
| #108 | docs: sync Sales Closer impl plan to shipped Phase-1 schema | `closer-plan-doc-accuracy` | main | draft |
| #103 | Cognitia 36-Hour GTM Improvement Report | `cognitia-36h-gtm-report-trwx36` | ep002 | draft |
| #102 | Cognitia 36h Loop — Checkpoint 0 | `cognitia-36hr-loop-blh9oe` | ep002 | draft |
| #101 | docs: execution-order status + #94 design-lesson | `pr-execution-order-oce1w6` | main | draft |
| #95 | vendor-readiness memo + 2 safety gaps | `sales-closer-vendor-readiness-u847qr` | `sales-closer-architecture-989w7r` | draft |
| #90 | Cognitia Auto Growth OS — dealership growth demo app | `exciting-shannon-tzei5l` | main | draft |
| #89 | Investor-grade audit + "become their need" wedge | `business-plan-audit-rz5k5d` | main | **non-draft** |
| #88 | cross-session project audit (SESSION_AUDIT.md) | `plot-sessions-audit-g5skwx` | main | draft |
| #86 | Meeting-notes writeback via governed crm.note | `meeting-notes-hubspot-writeback` | main | draft |
| #79 | COG-011 Lead Detail Console page | `cog-011-lead-detail-console` | main | draft |
| #78 | operator Approval Queue + Run visibility (Lane B) | `approval-workflow-operator-ui-a2fh6h` | `gtm-platform-mvp-setup-vYLBG` | draft |
| #61 | Fix Hermes bridge MCP stdio restart loop | `fix-hermes-bridge-stdio-loop` | `cognitia-episode-002-rebuild-5ffai` | draft |
| #54 | AGENT-ECONOMY-004 marketplace + matching | `agent-economy-004-marketplace-matching` | `agent-economy-003-agent-actions` | draft |
| #46 | COG-014 Demandara onboarding mission loop | `cog-014-demandara-onboarding` | `cog-011-012-…` | draft |
| #45 | COG-011+012 Lead detail console + tenant provisioning | `cog-011-012-lead-detail-tenant-provisioning` | main | draft |
| #44 | COG-011 Lead detail aggregated endpoint + console | `cog-011-lead-detail` | main | draft |

---

## C. Closed PRs — `merge-UNVERIFIED` (closed may = merged or closed-without-merge)

> Per-PR confirmation needed before claiming any of these merged. Grouped by theme for the workstream map. None were read this session beyond the list payload.

**Sales Closer / GTM foundation (closed):** #94 (greenfield prototype — #98 names it reference-only, will NOT merge; closed-draft), #87, #85, #84, #83, #81, #80, #77, #76, #75.

**Agent Economy / Token / Crypto-visibility cluster (closed — PARK):** #55 (TOKEN-LAB-002 token architecture, draft), #53 (settlement design, draft), #52 (marketplace skeleton, draft), #51 (agent actions/ledger), #50 (agent passports), #49 (dispute resolution), #48 (Agent Economy Lab), #47 (SEC-1), #18 (agent-economy 2-week spec, draft), #69 (LEGEND-001 Agent Fabric Lab), #68/#67/#66/#65/#64 (VISIBILITY / crypto-visibility research), #63/#62/#60/#59 (public trust/proof feed), #58 (CRYPTO-VISIBILITY-001), #56 (economy smoke), #57 (mainline runtime status).

**Governance / trust / hardening wave (closed — mostly stacked on `gtm-platform-mvp-setup-vYLBG`):** #43, #42, #41, #40, #39, #38, #37, #36, #35, #34, #33, #32, #31, #30, #29, #28, #27, #26, #25, #24, #23, #22, #21, #20, #19, #17, #16, #15, #14, #13, #12, #11, #10.

**Lane / pilot / audit (closed):** #82 (PILOT-001 proof harness, draft), #74/#73/#72/#71/#70.

> Full per-PR rows (titles/branches) for #10–#109 were parsed and are available in the session record. The closed governance/economy wave is **not on the critical path** for the Client Zero × Sales Closer spine and is treated as history + parked R&D unless a manager re-opens a specific lane.

---

## D. Notes on verification integrity

- Every `MERGED` claim above (#91/#92/#93/#97/#98) was confirmed via the single-PR endpoint with a `merged_at` timestamp this session.
- `main` HEAD at compile time: `623953e6…` (base sha of #96/#105/#106/#107).
- No CI status is asserted for any PR not explicitly marked with a time-stamped check this session.
- Closed ≠ merged. The 76 closed PRs are `merge-UNVERIFIED` by deliberate caution.
