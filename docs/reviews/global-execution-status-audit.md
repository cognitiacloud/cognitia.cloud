# Cognitia / Demandara Global Execution Status Audit

> **Read-only audit.** No build, merge, undraft, close, retarget, archive, delete, outreach,
> vendor, or live-data action was taken to produce this report. This is a status snapshot only.
> Every claim is tagged **[VERIFIED]** (read this session via GitHub API),
> **[INFERRED]** (derived from PR bodies / branch names / prior artifacts, not line-audited),
> **[RECOMMENDED]** (auditor recommendation, pending founder ratification), or
> **[UNVERIFIED]** (not checkable this session).

## Source & verification

- **Current date:** 2026-06-21
- **GitHub API verification:** 2026-06-21, this session. PR list (`state=all`, 60 PRs) read once;
  each spine and queue PR re-read via single-PR / status / check-runs / reviews / files endpoints.
  Latest CI check observed completed `2026-06-21T07:07Z` (PR #117 `build-test`).
- **Repo inspected:** `cognitiacloud/cognitia.cloud`
- **`main` HEAD at audit:** `d3d198e75fe5b7b0b7cff61590e267fed200d3d7` (the #96 merge commit — confirmed as the base SHA of PR #99). **[VERIFIED]**
- **Audit branch:** `claude/cognitia-execution-audit-n2mzvi`
- **Checkout limitation:** the local working tree is a **sparse checkout** containing only
  `hermes/skills/vision-skill/**` (14 tracked files). `docs/`, `packages/`, `apps/`, `harness/`
  do **not** exist locally. **All repo-state claims below come from the GitHub API, not the local
  checkout.** File-content claims about merged code are [INFERRED] from PR bodies, review artifacts,
  and the execution-board PR — not from a local read of `main`. **[VERIFIED — limitation]**

---

## 1. Executive Verdict

- **Complete [VERIFIED]:** The six-PR canonical spine is merged on `main` — #91, #92, #93, #96,
  #97, #98 (each confirmed by `merged_at`). This is the only "done" product surface.
- **Pending [VERIFIED]:** No end-to-end Client Zero happy path is merged. Everything past the
  spine is an **open draft** — review artifacts, consolidation docs, the execution board, and three
  candidate build lanes (#99 Apify, #105 goal-loop, #106 Client Zero package). No operator console,
  compliance-gate wiring, CRM writeback, or proof harness is merged on the current thesis.
- **Stale [VERIFIED]:** The "retarget #99 → main" instruction is **moot** — GitHub already
  auto-retargeted #99 to `main` (base SHA `d3d198e`, `mergeable_state: clean`). The "#96 held for
  convergence" framing is also stale: **#96 is merged** (2026-06-20T23:42:20Z). #99's own PR body
  still says "Base: …-c3quih — not main", which is now stale text.
- **Blocked [VERIFIED/INFERRED]:** #105 is **NEEDS FIX** (missing slug validation lets the harness
  write outside `goals/`). Go-live of any outreach is blocked on an unnamed legal/compliance owner
  and an unconfirmed real consenting dealership.
- **Readiness call [RECOMMENDED]:** **Not yet ready for a build fanout.** The review gate is
  _substantively_ clean (spine merged; #99/#96 reviewed READY; #105 has one known required fix;
  #113 reconciliation exists), but it is **administratively open** — the execution board (#117) and
  every review artifact are still **draft and unmerged**. Recommended posture: land the docs/board
  review layer + lock the two founder decisions (legal owner, Client Zero consent) **before** any
  enforceable-spine build session. One small, controlled spine build can start once file ownership
  (#117 `WORKER-OWNERSHIP.md`) is ratified — not a 20-session fanout.

---

## 2. Current Canonical Spine

All six **[VERIFIED]** merged via `merged_at` read this session. This is the only merged surface on
the current Sales Closer × Client Zero thesis.

| PR      | Status | Evidence                                    | What it contributes                                                                                                                                  | Remaining risk                                                                              |
| ------- | ------ | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **#91** | MERGED | `merged_at 2026-06-20T10:26:14Z` [VERIFIED] | Data-source strategy memo (CASL/CRTC/PIPEDA guardrails; Apify actor test order; Google Maps/Places = legal-review).                                  | Docs-only; risk is drift if later code ignores the source-risk ordering. [INFERRED]         |
| **#92** | MERGED | `merged_at 2026-06-20T10:26:21Z` [VERIFIED] | Compliance system spec: `consent_basis`, append-only `compliance_log`, per-channel rules; **SMS/WhatsApp/AI-voice blocked at launch**.               | Spec, not runtime — no compliance gate is wired into an executable workflow yet. [INFERRED] |
| **#93** | MERGED | `merged_at 2026-06-20T10:31:30Z` [VERIFIED] | **Canonical Sales Closer data layer** — migrations `0020`/`0021`, `closer_*` tables, core schemas, db repo, RLS/containment guard tests.             | This is the contract everything stacks on; must stay append-only. [INFERRED]                |
| **#96** | MERGED | `merged_at 2026-06-20T23:42:20Z` [VERIFIED] | Compliance layer **web-local / helper / demo-only**, converged on #93/#97 with **zero `packages/core` diff** (no duplicate core compliance surface). | None structural; retrospective review (#116) says READY. [INFERRED]                         |
| **#97** | MERGED | `merged_at 2026-06-20T03:33:35Z` [VERIFIED] | `@cognitia/core` **PII-safe GTM primitives** (`GtmProspect`, `DataSource`, unions, guardrail helpers, tests).                                        | Type/primitive layer; risk only if consumers serialize raw PII against it. [INFERRED]       |
| **#98** | MERGED | `merged_at 2026-06-20T10:26:27Z` [VERIFIED] | Vendor integration **porting memo** — names #93 canonical; #94/#95 superseded.                                                                       | Docs-only; superseded greenfield (#94) must not be reopened. [INFERRED]                     |

**Spine integrity [INFERRED from #117 board + #99/#114/#116 artifacts]:** #96 removed its parallel
core compliance surface so `packages/core` matches `main`; compliance view-models are web-local and
import #97 unions type-only. PII is hash/mask/domain-only, asserted by guard tests in #93/#96/#97.
A full end-to-end **spine read-through has not been performed** this session (sparse checkout) —
recorded as pending in #117 (T6).

---

## 3. Active / Draft / Watch PR Queue

All rows **[VERIFIED]** for state/draft/base/CI via API this session. CI = the `build-test` GitHub
Actions check on the PR head SHA. Legacy commit-status API returns `total_count: 0` for every PR
(no statuses) — CI truth comes from **check-runs**, which are green across the queue.

| PR       | Title (abridged)                                           | Draft? | Base                                                | CI                            | Disposition                           | Next action                                                                                                                                                                                              |
| -------- | ---------------------------------------------------------- | ------ | --------------------------------------------------- | ----------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **#99**  | Sales Closer Phase 2 — governed Apify ingestion            | Yes    | `main` ✅ (sha `d3d198e`, `mergeable_state: clean`) | `build-test` success          | **READY DRAFT / WATCH ONLY**          | None now. Already on `main`, clean. Review says "do not merge yet." Queue until spine needs ingestion. **Do not** action the stale "retarget" instruction — already done by GitHub.                      |
| **#105** | File-based goal-loop harness (`hctl`)                      | Yes    | `main`                                              | `build-test` success          | **NEEDS FIX**                         | Add `slug` validation (`^[a-z0-9][a-z0-9-]*$`, reject abs/`..`/sep) **before** any non-interactive/agent use. Optional: `goals/` → `.prettierignore`. Only fix now if the harness will actually be used. |
| **#106** | Client Zero: Auto Growth OS proposal + discovery           | Yes    | `main`                                              | `build-test` success          | **SUPPORTING REFERENCE**              | Treat as sales/scoping collateral until wired into the enforceable spine. Keep draft. See #115 review artifact.                                                                                          |
| **#107** | GTM consolidation index + GTM pack                         | Yes    | `main`                                              | `build-test` success          | **SUPPORTING REFERENCE**              | Breadth/market reference only. Reconciled by #113. Keep draft.                                                                                                                                           |
| **#110** | Master consolidation status report                         | Yes    | `main`                                              | `build-test` success          | **SUPPORTING REFERENCE / SUPERSEDED** | Execution-canonical _intent_ but superseded/clarified by #113 + #117 (which use reliable `merged_at`). Keep draft.                                                                                       |
| **#112** | PR #99 Apify Phase 2 review — READY                        | Yes    | `main`                                              | `build-test` success          | **WATCH ONLY (review artifact)**      | Human-review then optionally land. Carries the #99 READY verdict.                                                                                                                                        |
| **#113** | Canonical consolidation reconciliation (#107 × #110)       | Yes    | `main`                                              | `build-test` success          | **WATCH ONLY (review artifact)**      | Reconciliation of #107/#110; treat as canonical over #110. Human-review then optionally land.                                                                                                            |
| **#114** | PR #105 goal-loop review                                   | Yes    | `main`                                              | `build-test` success          | **WATCH ONLY (review artifact)**      | Carries the **NEEDS FIX** verdict for #105.                                                                                                                                                              |
| **#115** | PR #106 Client Zero review — pilot artifact decision       | Yes    | `main`                                              | `build-test` success          | **WATCH ONLY (review artifact)**      | #106 review; routes #106 to sales/scoping-collateral.                                                                                                                                                    |
| **#116** | PR #96 compliance review — READY (retrospective)           | Yes    | `main`                                              | `build-test` success          | **WATCH ONLY (review artifact)**      | Post-merge retrospective of landed compliance layer. READY.                                                                                                                                              |
| **#117** | Execution board — verified PR ledger, decisions, ownership | Yes    | `main`                                              | `build-test` success (2 runs) | **READY DRAFT (execution board)**     | **Recommended first merge candidate** — docs-only (`docs/execution/**`), CI green. Human-review then land if desired.                                                                                    |

**Other open drafts (out of primary scope, [VERIFIED] open/draft):** #89 (investor audit — only open
**non-draft**, base `main`), #90, #88, #86, #78, #79, #100–#104, #108, #109, #111. Per the #117 board
these are watch-only / Day-6 triage. #109 (ads/media engine) and #111 (agent-economy sandbox) belong
to **parked** lanes (§8) and base off `claude/ep002-mission-run-pPoba`, not `main`.

---

## 4. Review Artifact Status

All **[VERIFIED]** draft + `build-test` success this session. Diff scope is single-doc unless noted
(#117 is the multi-file board). None merged.

| Artifact PR                  | File(s)                                                                           | CI               | Diff scope                               | Verdict it carries                                                                     | Action needed                                                       |
| ---------------------------- | --------------------------------------------------------------------------------- | ---------------- | ---------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **#112**                     | `docs/reviews/` PR-99 Apify review                                                | success          | 1 doc (review only)                      | **#99 = READY** (technically strong; keep draft; no code change needed)                | Optional human-review + land. No action on #99 itself.              |
| **#113**                     | `docs/reviews/` consolidation reconciliation                                      | success          | 1 doc                                    | **#107 × #110 reconciled**; reliable-`merged_at` truth supersedes #110                 | Optional land; use as canonical over #110.                          |
| **#114**                     | `docs/reviews/pr-105-goal-loop-review.md`                                         | success          | 1 doc (+163 lines)                       | **#105 = NEEDS FIX** — slug guard blocks merge/automation; manual founder use OK       | Drive #105 fix from this; optionally land artifact.                 |
| **#115**                     | `docs/reviews/` PR-106 Client Zero review                                         | success          | 1 doc                                    | **#106 = pilot/scoping artifact**, keep draft until wired to spine                     | Optional land; routes #106 disposition.                             |
| **#116**                     | `docs/reviews/` PR-96 compliance retrospective                                    | success          | 1 doc                                    | **#96 = READY** (landed compliance layer confirmed UI/demo-only, zero core diff)       | Optional land (retrospective).                                      |
| **PR #106 review**           | = **#115** above                                                                  | —                | —                                        | Exists. **[VERIFIED]** (#115 is the #106 review artifact).                             | —                                                                   |
| **Execution-board artifact** | **#117** — `docs/execution/{BOARD,ACTIVE-PR-QUEUE,DECISIONS,WORKER-OWNERSHIP}.md` | success (2 runs) | 4 docs (`docs/execution/**`, +315 lines) | Verified PR ledger through #110; locked decisions; parked register; file-ownership map | **Recommended first merge** if green-on-review; docs-only, no code. |

---

## 5. What Is Actually Done

- **Sales Closer data layer — VERIFIED done (merged).** #93 canonical data layer (migrations
  `0020`/`0021`, `closer_*` tables, schemas, db repo, RLS/guard tests) + #97 core GTM primitives are
  merged on `main`. **[VERIFIED merged; file-contents INFERRED]**
- **Compliance / spec layer — VERIFIED done (merged), spec + demo only.** #92 spec + #91 data-source
  strategy + #96 web-local compliance UI/helpers are merged. This is **specification and demo**, not a
  runtime gate inside an executable workflow. **[VERIFIED merged]**
- **GTM primitives — VERIFIED done (merged).** #97 PII-safe primitives in `@cognitia/core`.
  **[VERIFIED merged]**
- **Apify ingestion — NOT merged; READY DRAFT.** #99 is a fixture-first, network-contained scaffold;
  CI green; base already `main`; `mergeable_state: clean`; review = strong-but-keep-draft. **[VERIFIED
  state; INFERRED code quality from #112/#99 review]**
- **Client Zero Auto Growth OS — NOT merged; SUPPORTING REFERENCE.** #106 is sales/scoping collateral
  (proposal + discovery system); #115 review routes it to "keep draft until wired into enforceable
  spine." **[VERIFIED state]**
- **Goal-loop harness — NOT merged; NEEDS FIX.** #105 `hctl` is original, stdlib-only, useful as a
  ledger, but missing slug validation; manual founder use OK, automation not approved. **[VERIFIED
  via #114 review]**
- **Consolidation / execution board — NOT merged; drafts exist.** #107 (GTM index), #110 (master
  consolidation), #113 (reconciliation), #117 (execution board: ledger/decisions/ownership). All draft,
  CI green. **[VERIFIED state]**
- **Agent Economy sandbox / token-lab — PARKED.** Some lane code historically merged on `main`
  (#48–#55, #69 per #117 board) is **frozen**; #111 (offline sandbox, sim-only, base `ep002`) is open
  draft. No forward build. **[INFERRED from #117/DECISIONS]**
- **Hermes Vision — supporting artifact only.** Present in the local checkout
  (`hermes/skills/vision-skill/**`). One publish-safety/QC artifact. **Cognitia is not a video/avatar
  company.** **[VERIFIED present locally]**
- **MoverOS / Tenant Zero / Client One — no current-thesis merged surface.** Referenced historically
  (e.g. PILOT-001 Tenant Zero proof harness #82/#83, and #99 body explicitly excludes
  MoverOS/`lead_intakes`). Label is an **open founder decision** (§9). No MoverOS build is on the
  current spine. **[INFERRED]**

---

## 6. What Is Still Pending

Exact missing items for one provable Client Zero loop (none of these is merged):

- **One merged Client Zero happy path** — lead in → consent/compliance gate → human approval →
  appointment booking → CRM writeback → proof report. **MISSING.** [VERIFIED — no such merged PR]
- **Operator console** — not merged on current thesis (#78 operator UI is a draft off `ep002`).
  **MISSING.** [VERIFIED]
- **Compliance gate wired into the workflow** — #92 is spec, #96 is demo/UI; no enforced runtime gate
  in an executable path. **MISSING.** [INFERRED]
- **CRM writeback mock / adapter** — historical HubSpot lanes (#77/#86) are off the current spine; no
  current-thesis writeback adapter merged. **MISSING / not on spine.** [INFERRED]
- **Proof harness tied to acceptance criteria** — PILOT-001 harness (#83/#84) is historical; no proof
  harness tied to the Client Zero acceptance criteria is merged. **MISSING on current thesis.** [INFERRED]
- **Unit economics / runway model.** **MISSING.** [UNVERIFIED — not found this session]
- **Legal / compliance sign-off owner.** **UNNAMED.** Gates all live outreach/ads/vendor. [VERIFIED via #117 B3]
- **Real consenting dealership confirmation for Client Zero.** **UNCONFIRMED.** [VERIFIED via #117 B5]
- **MoverOS = Client One or Tenant Zero sandbox?** **UNDECIDED.** [VERIFIED open decision]
- **Unresolved PR review CI/comments:** #105 NEEDS FIX (slug guard) is the only open _blocking_ review
  item; #99 review is informational ("keep draft"). All queue CI is green. [VERIFIED]

---

## 7. Stale / Dangerous Instructions To Ignore

Do **not** let these drive current work:

- ❌ **"#96 held for convergence."** Stale — **#96 is merged** (`merged_at 2026-06-20T23:42:20Z`).
  [VERIFIED]
- ❌ **"Retarget #99 now."** Moot — GitHub **already** retargeted #99 base → `main`
  (base SHA `d3d198e`, `mergeable_state: clean`). No manager-approved retarget action is needed or
  outstanding. #99's PR-body text "Base: …-c3quih — not main" is stale; the live base is `main`.
  [VERIFIED]
- ❌ **Any 20-session / multi-worker build fanout.** No build fanout is authorized; #117
  `WORKER-OWNERSHIP.md` is an explicitly **parked** map, not a start signal. [VERIFIED intent]
- ❌ **Any public-token / coin / liquidity / presale / airdrop / yield / investment direction.**
  KILLED. [VERIFIED via #117 DECISIONS §4]
- ❌ **"MoverOS as Client Zero" naming.** Client Zero = the auto-dealership proof loop; MoverOS label
  is undecided (§9) and is **not** Client Zero. [VERIFIED guardrail]
- ❌ **"Cognitia as a video/avatar/media company" framing.** Hermes Vision is one supporting artifact.
  [VERIFIED guardrail]
- ❌ Old "merged/closed" claims from list-endpoint `merged` flags or pre-#113 consolidation docs —
  superseded by `merged_at`-based truth (#113/#117 and this audit). [VERIFIED]

---

## 8. Parking Lot

Parked = execution-paused, kept in place (not killed). Reactivation needs explicit founder
re-authorization **and** the stated condition.

| Parked lane                                   | Evidence                                                                           | Reactivation condition                                                                 |
| --------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Agent Economy**                             | #48–#55, #69 merged-but-frozen; #111 open sim-only draft (base `ep002`) [INFERRED] | Only after Client Zero spine is proven + explicit re-authorization (#19 scope rule).   |
| **Internal token sandbox / token-lab**        | #55 / token-lab, internal-ledger-only [INFERRED]                                   | Stays sandboxed; **no issuance/external token ever** without founder + legal sign-off. |
| **Crypto-visibility / trust-proof-feed**      | #58–#68 merged-but-frozen [INFERRED]                                               | Not part of trust-plane GA; no public-token/crypto tie-in. PARKED, not killed.         |
| **Public token language**                     | —                                                                                  | **KILLED separately** (not merely parked). Never message.                              |
| **Multi-vertical expansion**                  | gated expansions register [INFERRED]                                               | After Client Zero proof + legal sign-off.                                              |
| **Paid ads / live ad spend**                  | #109 ads/media engine draft (base `ep002`) [VERIFIED draft]                        | Spec/sim only; no live spend until legal owner named + founder go.                     |
| **Live WhatsApp / SMS / calls / vendor work** | #92 blocks at launch [VERIFIED]                                                    | Simulated only until named legal owner signs off + real consent confirmed.             |

---

## 9. Blockers / Founder Decisions

| Decision                                                               | Why it matters                                                                                | Current status                            | Recommended answer [RECOMMENDED]                                                                                                       |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Confirm a **real consenting dealership** for Client Zero               | Determines whether #106 is a live pilot or stays spec/scoping collateral; gates any real data | **Unconfirmed** [VERIFIED #117 B5]        | Until a signed, consenting dealership exists, keep #106 **spec-only**. Do not touch live prospect data.                                |
| Name the **legal / compliance sign-off owner**                         | Gates all live outreach, ads, vendor, SMS/WhatsApp/voice                                      | **Unnamed** [VERIFIED #117 B3]            | Name one accountable owner now; until then everything stays simulated.                                                                 |
| Confirm **pilot offer + price**                                        | Required to make #106 an actionable pilot rather than a deck                                  | **Undefined** [UNVERIFIED]                | Lock a single fixed-scope pilot offer + price before any outreach.                                                                     |
| Confirm **MoverOS label** (Client One if real, Tenant Zero if sandbox) | Prevents naming drift and accidental scope expansion                                          | **Undecided** [VERIFIED]                  | If a real paying mover exists → **Client One**; otherwise → **Tenant Zero sandbox**. Default to Tenant Zero until proven.              |
| Decide when/if **#99 Apify** enters the first Client Zero spine        | Avoids pulling live-scrape risk in before the spine needs it                                  | #99 READY DRAFT, clean, queued [VERIFIED] | **Queue it.** Bring in only when the spine actually needs governed ingestion + legal owner named.                                      |
| Decide whether **#105 slug guard** is fixed now or stays draft         | Determines if the goal-loop harness can be agent-driven                                       | **NEEDS FIX** [VERIFIED #114]             | Fix the ~3-line slug guard **only if** the harness will be used for tracking; otherwise leave draft. Manual founder use is fine today. |

---

## 10. Recommended Next 7 Days

**No blind build fanout.** Review/lock first; one controlled spine build only after ownership is locked.

1. **Land the execution board (#117)** if green-on-human-review — docs-only (`docs/execution/**`),
   CI green; gives one canonical ledger/decisions/ownership source.
2. **Human-review and (optionally) land the merge-safe review artifacts** #112, #113, #114, #115,
   #116 — all single-doc, CI green. Treat #113 as canonical over #110.
3. **Fix #105's slug guard** _only if_ the goal-loop harness will actually be used for tracking;
   otherwise leave it draft. Don't fix speculatively.
4. **Lock the two go-live gates:** name the legal/compliance owner and confirm (yes/no) a real
   consenting dealership + pilot offer/price for Client Zero.
5. **Ratify file ownership** (#117 `WORKER-OWNERSHIP.md`), then build the **enforceable Client Zero
   spine in controlled workers** — single small lane, not a fanout — once ownership is locked.
6. **Keep #99 (Apify) queued** until the spine actually needs governed ingestion (and legal owner is
   named). It's already clean on `main`; no retarget needed.
7. **Keep parked lanes parked** — Agent Economy, token-lab, crypto-visibility/trust-feed, paid ads,
   live WhatsApp/SMS/calls/vendor. No public-token language.

---

## 11. Exact Next Prompts

**Gate status [RECOMMENDED]:** The review gate is **substantively clean but administratively open** —
the board (#117) and all review artifacts are still unmerged drafts, and two founder decisions
(legal owner, Client Zero consent + pilot offer) are unresolved. Per the audit's own rule, paste-ready
build prompts should **not** be issued until the gate is closed.

**Must be resolved before issuing the build prompts below:**

1. Land or explicitly accept #117 (execution board) as canonical, and human-review #112–#116.
2. Name the legal/compliance sign-off owner. **(Blocks any live path.)**
3. Confirm Client Zero: real consenting dealership? pilot offer + price? (or declare spec-only).
4. Ratify the #117 `WORKER-OWNERSHIP.md` file boundaries so parallel workers can't collide on the
   merged spine.
5. Decide MoverOS label (Client One vs Tenant Zero).

Once **all five** are resolved, the next controlled sessions are (each scoped to its own file prefix
per #117 ownership map; spine schemas/migrations are **read-only / append-only**; all paths stay
**simulated** until the legal owner signs off):

- **Client Zero spine builder** — _"In a single controlled session, build the enforceable Client Zero
  happy-path skeleton on the merged spine (#93 `closer\__`+ #97 primitives), writing only under
[ratified prefix]. Wire: lead intake → compliance gate (enforced, not demo) → human-approval marker
→ appointment-booking stub → CRM-writeback mock → proof record. Read-only on`closer.ts`/migrations
`0020`/`0021`; new migration ≥`0022` only. No network, no live vendor, no real data. Full guard/PII
  test suite must pass. Draft PR, docs+diff confined to prefix."\*
- **Operator console builder** — _"Build the operator console surface (approval queue + run visibility)
  under `apps/web/src/app/(closer)/**` new routes only; consume web-local `complianceTypes.ts`
  type-only; touch no spine schema. Draft PR."_
- **Compliance gate integration** — _"Promote #92's spec into an enforced runtime gate in
  `apps/api/src/compliance_`(new files); consent-basis check + append-only`compliance_log` write +
  per-channel block (SMS/WhatsApp/AI-voice blocked at launch). Gated on the named legal owner. Draft
  PR, simulated only."\*
- **CRM writeback mock** — _"Add a CRM-writeback adapter mock (no live HubSpot/credentials) behind the
  governed `crm.note`/approval path; new files only; idempotent; no real network. Draft PR."_
- **Proof harness** — _"Add a proof harness asserting the Client Zero acceptance criteria end-to-end
  against the spine primitives (no live data); produce a sample proof report artifact. Draft PR."_

---

### Appendix — verification log (this session)

- PR list `state=all` (60 PRs) read once; spine `merged_at` confirmed for #91/#92/#93/#96/#97/#98. **[VERIFIED]**
- `get_status` for #99/#105/#106/#107/#110/#112/#113/#114/#115/#116/#117 → all `total_count: 0`
  (no legacy commit statuses). **[VERIFIED]**
- `get_check_runs` for the same set → `build-test` `conclusion: success` on every head SHA. **[VERIFIED]**
- #99 single-PR read → `base.ref = main`, base SHA `d3d198e`, `draft: true`, `mergeable_state: clean`,
  `merged: false`. **[VERIFIED]**
- #99 reviews → one `COMMENTED` owner review: "strong — NOT a merge approval. Keep draft." **[VERIFIED]**
- #105 reviews → none on the PR; verdict carried by #114 artifact = **NEEDS FIX** (slug guard). **[VERIFIED]**
- #114 + #117 file diffs read in full this session. **[VERIFIED]**
- Local checkout is sparse (`hermes/skills/vision-skill/**` only); no repo-wide local read possible. **[VERIFIED]**
