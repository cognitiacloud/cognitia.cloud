# Consolidation Reconciliation — PR #107 × PR #110

**Date:** 2026-06-21
**Author scope:** Review / truth-check only. **No** merges, rebases, retargets,
undrafts, closes, deletes, or archives were performed in this session. The only
artifact this session creates is this file.
**Branch:** `claude/pr-consolidation-review-igg46n`
**Inputs reconciled:**
- **PR #107** — `docs/gtm/` @ ref `e3367ea` (head `claude/cognitia-gtm-competitor-research-fpxg4o`)
- **PR #110** — `docs/consolidation/` @ ref `e18c8c9` (head `claude/cognitia-master-consolidation-p8y421`)
- Both branched from `main` @ `623953e6`. Open-PR landscape pulled via GitHub API in this session (2026-06-21).

---

## 0. Hard rules honored in this document

- No PR/branch is merged, undrafted, closed, deleted, or archived. Every "action"
  below is a **recommendation for a manager-authorized session**, not an executed step.
- **Agent Economy, internal token-lab/sandbox, and crypto-visibility/trust-feed remain
  PARKED strategic R&D — not killed.** (See §7. Only the *public* token/coin program is
  killed; that does not touch the parked R&D lanes.)
- **Cognitia is not redefined as a video/avatar company.** The Hermes Vision Skill is one
  supporting artifact (publish-safety / photo-QC), not the thesis.
- Only `docs/reviews/consolidation-reconciliation.md` is written.

---

## 1. Canonical verdict

| Question | Answer |
|---|---|
| **Which report is canonical for execution?** | **PR #110 (`docs/consolidation/`).** |
| **Which report is canonical for breadth / inventory / market context?** | **PR #107 (`docs/gtm/`)** — kept as a supporting reference, not the execution driver. |

**Why #110 is the execution source of truth:**

1. **PR-anchored.** #110 reasons in PR numbers (#10–#109) — the unit you actually
   merge and review. #107 references **zero** PR numbers; it is a branch-name index.
2. **Verification posture.** #110 separates `[VERIFIED]` / `[INFERRED]` / `[RECOMMENDED]`
   and (per its own docs) confirmed the merged foundation via the single-PR API with
   `merged_at` timestamps. #107 self-describes as *"inferred from branch names + commit
   dates — not a content audit"* and treats everything below `main` as unverified.
3. **Newer + self-superseding.** #110 was created after #107 and explicitly states this
   folder *"supersedes/updates"* #107 (its WS7 entry).
4. **Reflects already-merged state.** #110 accounts for the merged foundation
   (#91/#92/#93/#97/#98) that #107 missed entirely (see §3, contradiction C1).

**Why #107 is still worth keeping:** it carries the full ~110-branch breadth table, the
12-workstream decomposition, the competitor teardown, and the parity analysis — context
#110 does not reproduce. Use #107 to *locate* branches and market framing; use #110 to
*decide and sequence* execution.

---

## 2. Positioning (do not redefine)

Both reports agree, and this is the canonical framing:

> **Cognitia** = agent trust/control plane, proof registry, compliance layer, Sales
> Closer/GTM OS. **Demandara** = GTM/growth/operator brand. **Sales Closer** = Demandara's
> AI voice+text lead-qualification & booking product. **Client Zero** = auto dealership /
> Auto Growth OS proof loop. **Hermes Vision Skill** = one supporting publish-safety/photo-QC
> artifact — **not** the company.

Cognitia is **not** a video/avatar/media company. Nothing in this reconciliation changes that.

---

## 3. Contradictions & resolutions

| # | Topic | PR #107 says | PR #110 says | Resolution / canonical |
|---|---|---|---|---|
| C1 | **State of `main`** | `main` = only the Hermes Vision Skill; *"no GTM docs existed in repo before this pack"* (evidence-ledger A4/A5). | Five foundation PRs **#91/#92/#93/#97/#98** already **merged** to the same `main`, plus `packages/core` closer schema + `packages/db`. | **#110.** #107's claim is an artifact of an **incomplete local checkout** (only `hermes/` present — exactly #110's blocker B6). The foundation existed; #107 couldn't see it. |
| C2 | **Unit of analysis** | Branches (~110), no PR numbers. | PRs (#10–#109). | Use **#110 (PRs)** for execution; use **#107 (branches)** as the lookup index. |
| C3 | **Workstream count** | **12** workstreams; WS12 = "Agent Economy + Crypto Visibility" (combined). | **11** workstreams; the same parked scope is split into **WS10 (Agent Economy / token sandbox)** + **WS11 (Crypto visibility / trust feed)**. | Same scope, different decomposition. Crosswalk in §4. No real conflict. |
| C4 | **7-day plan currency** | Days 3–7 propose **merging the spine** (schema foundation, compliance scaffold, Sales Closer architecture). | Those are **already merged** (#91/#92/#93/#96/#97/#98); only mechanical action is a #99 retarget/rebase, the rest is convergence review. | **#110.** #107's "build the spine" plan is largely **obsolete** — the spine is mostly landed. Reconciled plan in §10. |
| C5 | **Verification of merges** | N/A — treats all sub-`main` work as claimed. | Claims foundation merges `[VERIFIED]`; marks closed PRs `merge-UNVERIFIED` by caution. | **#110**, with the caveat in §8 (this session did not independently re-run those merge checks except the open-PR list). |
| — | **Agreements (not contradictions)** | Positioning, Client-Zero-first priority, "consolidate don't build net-new", keep parked lanes in place, no auto-close of duplicates. | Same. | Both aligned; carried forward. |

---

## 4. Unified branch / workstream map

PR-anchored (from #110) as the spine; #107's WS numbering shown for cross-reference.
"Status" reflects each source report's claims, not an independent re-verification this session.

| Unified WS | #110 WS | #107 WS | Tier | Canonical PR(s) / branch | Status (per source) |
|---|---|---|---|---|---|
| Sales Closer core engine | WS1 | WS1 | Critical path | **#93** (closer data layer) + **#97** (PII-safe GTM primitives) | Merged foundation (per #110) |
| Client Zero / Auto Growth OS | WS2 | WS3 + WS2 | Critical path (proof) | **#106** (proposal + discovery + static console) | Open draft — proof artifact |
| Compliance layer | WS3 | WS7 | Critical path | spec **#92** (merged per #110); impl **#96** | See §3/§8 — #96 status disputed within #110; treat as **claimed merged, not re-verified** |
| Vendor readiness | WS4 | WS1 | Supporting | **#98** (merged per #110); #95 superseded; #94 reference-only | No live vendor integration this cycle |
| Apify ingestion | WS5 | WS1 | Build (next) | **#99** (governed, fixture-first, network-off) | Open draft; **base branch already merged** → see §6/§9 |
| Goal-loop harness | WS6 | WS10 | Watch-only | **#105** (`harness/hctl.py`), informed by #100 spec | Open draft, sandboxed |
| GTM consolidation / strategy | WS7 | WS2 | Meta | **#107** (`docs/gtm/`); **this folder + #110 supersede/update it** | Open draft |
| Demandara media / ads | WS8 | WS2 | Gated | #109 (ads/media engine) | Spec/scaffold only — **no paid ads / live spend** |
| Hermes Vision QC | WS9 | WS11 | Watch-only | #104 checkpoint + `hermes/skills/vision-skill/` + #61 bridge fix | Supporting artifact, **not** the company |
| **Agent Economy / token sandbox** | WS10 | WS12 (part) | **PARKED R&D** | #48–#55, #69, #18; `agent-economy-001…005`, `token-lab-002`, `legend-001-agent-fabric-lab` | **Parked — internal-ledger-only; in place; no delete** |
| **Crypto visibility / trust feed** | WS11 | WS12 (part) | **PARKED R&D** | #58–#68; `crypto-visibility-001`, trust-proof explorer/feed | **Parked — research only; no public-token tie-in; in place; no delete** |
| Governance/trust history wave | (history) | WS8/WS9/WS10 | Off critical path | #10–#47 (closed; `merge-UNVERIFIED`) | Mine for reusable primitives; do not re-run |
| Lead-Detail console (duplicate cluster) | (WS in #107) | WS5 | Reconcile | #44 / #45 / #79 / #46 (COG-011/012/014) | **Pick exactly one** (manager-ratified); mark losers superseded — no close |

---

## 5. Active build queue (recommended; nothing executed this session)

> All items are **recommendations for a manager-authorized session.** This session
> performs none of them.

1. **#96 compliance layer** — per #110's docs, already merged (`d3d198e7`). **Verify
   independently before relying on it** (see §8). No action if confirmed merged.
2. **#99 Apify Phase-2** — **Recommend manager-approved retarget/rebase of #99 onto
   `main`; do not execute in this session.** Its base branch (the #93 lane) is reported
   merged, so #99 is stacked on a merged base. After an approved retarget + rebase + CI
   re-run, re-validate against #93's landed `closer_*` schema and #97 unions. Keep draft,
   fixture-first, network-off. **Do not merge** until #96/#93 alignment is confirmed.
3. **Lead-Detail duplicate cluster (#44/#45/#79/#46)** — recommend collapsing to one
   canonical via manager ratification; mark losers "superseded pending manager review."
   **No closing/deleting.**
4. **One green spine (read-through, not merges)** — trace the contract end-to-end:
   `#97 → #91 → #93 → #92/#96 → #99 → #106`. Produce a "spine gap list." This is a
   review artifact, not a build step.

---

## 6. Parked queue — strategic R&D (in place, not killed)

**These stay. Branches are not archived or deleted. Reactivation of any lane requires a
named manager decision (scope-guardrail #19).**

| Parked lane | Unified WS | PRs / branches | Posture | Revisit when |
|---|---|---|---|---|
| **Agent Economy** | WS10 | #48, #49, #50, #51, #52, #53, #54, #69, #18; `agent-economy-001…005`, `legend-001-agent-fabric-lab` | Execution-paused. **Internal double-entry ledger only — no externalized credits.** | Client Zero × Sales Closer spine green on `main` **AND** explicit manager re-authorization. |
| **Internal token-lab / sandbox** | WS10 | #55 (TOKEN-LAB-002), `token-lab-002-architecture`; #100's internal-token-sandbox memo | **Internal ledger / doc-sandbox thinking only. No token issuance of any kind.** | A concrete internal-accounting need the ledger cannot meet **AND** a named legal sign-off owner. Even then: internal-only. |
| **Crypto visibility / trust feed** | WS11 | #58–#68; `crypto-visibility-001`, trust-proof explorer + live feed | Parked R&D; diligence-readiness research only. **No public-token tie-in.** | Explicitly re-authorized as a separate initiative; not on the current thesis path. |

---

## 7. Killed queue — do not build, do not message (distinct from parked)

These are **killed**, and are kept strictly separate from the parked R&D above so the
distinction is unambiguous:

- **Public token / coin launch** (default stays killed)
- **Liquidity / market-making**
- **Presale**
- **Airdrop**
- **Yield / staking-rewards programs**
- **Investment-token / investor-token promises and language**
- (also off-thesis per #110: "replace your sales team" messaging; guaranteed
  ROI/SEO/sales/ranking claims; AI-voice/SMS/WhatsApp *as the wedge* at launch;
  paid ads / live media spend; real outreach / live vendor calls)

> **Boundary statement:** Killing the *public* token program does **not** kill the parked
> Agent Economy, internal token-lab/sandbox, or crypto-visibility R&D in §6. Those remain
> parked strategic R&D, in place.

Revisit condition for the killed token items: only via a deliberate, separately-authorized
strategic decision. Default: stays killed.

---

## 8. Watch-only queue

No action unless CI/review demands it.

- **#89** — the **only open non-draft PR** ("investor-grade audit + wedge strategy").
  Needs manager triage: confirm docs-only + on-thesis, then classify. (Note: per constraint,
  ensure no "investment-token" framing leaks in — that language is killed, §7.)
- **#100** (goal-loop sprint specs), **#104** (Hermes QC checkpoint), **#105** (goal-loop
  harness), **#106** (Client Zero proposal), **#107** (GTM index), **#108** (doc-sync),
  **#101/#102/#103** (loop/checkpoint/report), **#90** (dealership demo app), **#109**
  (Demandara ads), **#86/#78/#88** (misc).
- **#110** (self) and **this reconciliation** — documentation; watch-only.

---

## 9. Blockers (carried from #110, re-stated as recommendations)

| ID | Blocker | Severity | Unblock (manager-authorized) |
|---|---|---|---|
| B2 | #99 stacked on a now-merged base branch | Medium | Recommend approved retarget→`main` + rebase + CI re-run (§5.2). Not executed here. |
| B3 | Legal/compliance sign-off **owner unnamed** | High for go-live / Low for spec-only | Muhammad/Feroz name an owner before any outbound. |
| B4 | Canonical pick among duplicate lanes not ratified | Medium | Manager ratifies picks (Sales Closer #93+#97, vendor #98, Client Zero #106, Apify #99, goal-loop #105; Lead-Detail = one of #44/#45/#79/#46). |
| B5 | Real consenting Client Zero dealership unknown | High for execution / None for artifact | Muhammad/Feroz confirm a real, consenting dealership. |
| B6 | Local checkout missing the monorepo (only `hermes/`) | Low (process) | **Root cause of contradiction C1.** Verify against full `main`, not a partial clone, before trusting "what's on main" claims. |

---

## 10. Recommended next 7-day plan (reconciled)

Based on #110 (current) with #107's breadth/market context folded in. **All steps are
recommendations; none are executed in this session, and none modify any existing PR.**

- **Day 1 — Adopt canonical.** Treat #110 (`docs/consolidation/`) + this reconciliation as
  the execution source of truth; #107 (`docs/gtm/`) as the inventory/market reference.
  Communicate a freeze on net-new branch creation.
- **Day 2 — #99 (recommend only).** **Recommend manager-approved retarget/rebase of #99
  onto `main`; do not execute in this session.** Once approved in a build session: retarget,
  rebase, re-run CI, re-validate against #93 schema + #97 unions. Keep draft, network-off.
- **Day 3 — Ratify canonical picks.** Record one canonical per duplicate cluster; mark
  losers "superseded pending manager review." **No closing/deleting.** Collapse Lead-Detail
  (#44/#45/#79/#46) to one.
- **Day 4 — Client Zero readiness (#106).** Verify guardrails (no guaranteed
  sales/ROI/rankings; finance/trade-in = collect-and-handoff with approval marker); confirm
  Hermes Vision is *referenced, not rebuilt*. Decision: is there a real consenting dealership
  (B5)? No live vendor wiring this week.
- **Day 5 — Spine read-through (no merges).** Trace `#97 → #91 → #93 → #92/#96 → #99 → #106`
  on paper; output a spine gap list.
- **Day 6 — Triage non-critical PRs.** Classify **#89** and other drafts into workstreams
  (watch-only vs close-candidate — manager only). Leave §6 parked lanes (#48–#69) alone.
- **Day 7 — Checkpoint.** Update `docs/consolidation/` with the week's state; confirm nothing
  parked/killed was reactivated without authorization; one-paragraph founder update.

---

## 11. Appendix — provenance & caveats

- **Refs:** #107 `e3367ea`, #110 `e18c8c9`; both off `main` `623953e6`.
- **Open-PR count:** **25 open PRs** per this session's GitHub API list (2026-06-21),
  of which **24 draft + 1 non-draft (#89)**. Source reports may cite different totals
  (#110 reasons over PRs #10–#109 including closed).
- **#96 merge status — labeling per constraint:** #110's `MASTER-STATUS.md` claims #96 was
  merged (`d3d198e7`, 2026-06-20 23:42Z, manager-authorized). However, **#110's own PR body
  still describes #96 as "open / non-draft / mergeable-clean"** — an internal discrepancy
  within #110. This session **did not independently re-verify** #96's merge. Treat #96 as
  **"claimed merged per #110's docs, not re-verified here."** If a merge fact is later
  relied upon, it should be labeled **"VERIFIED by later execution-board/controller data,
  not by #110."**
- **Foundation merges (#91/#92/#93/#97/#98):** reported `[VERIFIED]` by #110 via the
  single-PR API with `merged_at` timestamps. This session did **not** re-run those checks
  (only the open-PR list was pulled here). Carried forward as #110's verified claim.
- **Verification legend:** `[VERIFIED]` = confirmed by API/file read in the cited source ·
  `[INFERRED]` = derived from branch names / PR bodies, not a content audit ·
  `[RECOMMENDED]` = manager recommendation, not a decision. All branch→workstream mappings
  are `[INFERRED]` unless a file was read. **Closed ≠ merged.** **Nothing is claimed
  production-ready** beyond what CI/tests verify.
