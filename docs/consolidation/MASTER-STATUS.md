# MASTER STATUS — Cognitia / Demandara Consolidation

**Compiled:** 2026-06-20 · **Branch:** `claude/cognitia-master-consolidation-p8y421` · **Mode:** consolidation / truth-check (NOT a build session)

**Legend:** `[VERIFIED]` = read this session via GitHub API / file read · `[INFERRED]` = derived from PR bodies / branch names, not a content audit · `[RECOMMENDED]` = manager recommendation, not yet decided.

**Guardrails honored:** no features built; no branches closed/deleted, no invented artifacts, no raw PII, agent-economy/crypto stay parked, no public token, no real outreach/ads/vendor calls. _Update 2026-06-20: #96 (compliance layer) was subsequently merged to `main` under explicit manager authorization — see §2. No other merges/undrafts._

**Positioning (do not redefine):** Cognitia = agent trust/control plane, proof registry, compliance layer, Sales Closer/GTM OS, agent-economy infrastructure. Demandara = GTM/growth/operator brand. Sales Closer = Demandara product for voice+text lead qualification & booking. Client Zero = auto dealership / Auto Growth OS proof loop. Hermes Vision Skill = one supporting media/publish-safety artifact, **not** the company.

---

## 1. Executive summary

The parallel-session work is **real, recent, on-thesis, and now partially landed on `main`**. The canonical Sales Closer spine is merged; the remaining critical-path work is **convergence and review, not new building**.

Two facts materially differ from the original brief and reset the priority order:

1. **#96 (Compliance layer) is MERGED.** `[VERIFIED]` After converging onto the merged #93/#97 foundation (CI green, build-test success), it was merged to `main` on **2026-06-20T23:42:20Z** (merge commit `d3d198e75fe5b7b0b7cff61590e267fed200d3d7`) under explicit manager authorization. It landed **UI/helper/demo-only** — `apps/web/**` + one docs file, **zero `packages/core` diff**, no DB/API/worker/vendor/outreach changes. `main`'s `packages/core/src/types/index.ts` carries only the #97 GTM primitives (no parallel compliance surface). The brief's "#1 task: rework #96 convergence" is **done and landed**.

2. **#99 (Apify Phase-2) is stacked on a branch that has now merged.** `[VERIFIED]` Its base is `claude/sales-closer-engine-plan-c3quih` (the #93 branch), which merged at 10:31:30Z. → #99 needs **retarget to `main` + rebase** before review. CI is green but only against the now-merged stacked base.

**Bottom line:** the canonical foundation (#91/#92/#93/#97/#98) **plus the #96 compliance layer** is on `main`. #99 needs a retarget. Everything else is watch-only or parked. The 7-day goal is **one green Client Zero × Sales Closer spine on `main`** — reached by _converging_ existing lanes, not adding more.

---

## 2. Merged work (on `main`) — `[VERIFIED]`

| PR      | Merged (UTC)         | What landed                                                                                                                                                                                                                                                                            |
| ------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **#91** | 2026-06-20T10:26:14Z | `docs/sales-closer/data-source-strategy.md` — registry-anchored data-source decision record; CASL/CRTC/PIPEDA guardrails; Apify actor test order.                                                                                                                                      |
| **#92** | 2026-06-20T10:26:21Z | `docs/compliance/compliance-system-spec.md` — `consent_basis` enum, append-only `compliance_log`, per-channel rules (SMS/WhatsApp/AI-voice blocked at launch), human approval gates.                                                                                                   |
| **#97** | 2026-06-20T03:33:35Z | `@cognitia/core` GTM primitives — `GtmProspect` (PII-safe), `DataSource`, unions `SourceRisk`/`ContactBasis`/`ConsentStatus`/…, pure guardrail helpers, 22 tests. **Canonical PII-safe GTM types.**                                                                                    |
| **#98** | 2026-06-20T10:26:27Z | `docs/sales-closer-engine/VENDOR_INTEGRATION_PORTING.md` — names #93 canonical, #94 prototype-only, #95 superseded; platform-native porting map.                                                                                                                                       |
| **#93** | 2026-06-20T10:31:30Z | **Canonical platform-native Sales Closer data layer** — migrations 0020/0021 (`closer_sources`, `closer_scrape_runs`, `closer_raw_records`, `closer_account_profiles`, `closer_briefs`), `packages/core/src/schemas/closer.ts`, `packages/db` repo + RLS/guard tests.                  |
| **#96** | 2026-06-20T23:42:20Z | **Compliance layer (UI/helper/demo-only)** — `apps/web/**` compliance/channel view-models + helpers + fixtures/tests reusing #97 unions (type-only) on the #93 foundation, plus build notes. Merge commit `d3d198e7`. **Zero `packages/core` diff**; no DB/API/worker/vendor/outreach. |

Merge order on record: #97 first (03:33Z), then #91/#92/#98 (~10:26Z), then #93 (10:31Z), then **#96 (23:42Z, manager-authorized)**. All merged by `cognitiacloud`.

---

## 3. Draft / open PRs that need action

| PR      | State                             | CI                     | What it is                                                                                                      | Action needed                                                                                               |
| ------- | --------------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **#96** | **MERGED** 23:42:20Z (`d3d198e7`) | green                  | Compliance layer, converged on #93/#97; view-models web-local (`apps/web/src/lib/complianceTypes.ts`).          | ✅ Done — merged to `main` (UI/helper/demo-only; zero `packages/core` diff). No further action.             |
| **#99** | open · draft · mergeable-clean    | green (on merged base) | Governed, fixture-first Apify ingestion scaffold (`packages/integrations/src/apify/*`), network-off by default. | **Retarget base `main` + rebase**, re-run CI, then review. Do NOT merge until #96/#93 alignment understood. |
| **#89** | open · **non-draft**              | not verified           | "Investor-grade audit + 'become their need' wedge strategy." Now the only open non-draft (since #96 merged).    | Triage: confirm it is docs-only and on-thesis; classify in GTM workstream.                                  |

---

## 4. Watch-only PRs (no action unless CI/review demands) — `[VERIFIED]` states

| PR       | Base                | What it is                                                                                                                        |
| -------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **#100** | `ep002-mission-run` | Goal Loop Sprint — research + spec artifacts (KILL/PARK/BUILD list, 5 founder decisions).                                         |
| **#104** | `ep002-mission-run` | `CHECKPOINT-6H.md` — scoped ep002 / Hermes Vision QC checkpoint, 1 file, docs-only.                                               |
| **#105** | `main`              | File-based goal-loop harness (`harness/hctl.py`, stdlib-only, writes only under `goals/`).                                        |
| **#106** | `main`              | Client Zero Auto Growth OS proposal + discovery system under `clients/client-zero-auto-growth/` (incl. static HTML console).      |
| **#107** | `main`              | `docs/gtm/` branch-level consolidation index + ~110-branch inventory (prior consolidation pass; mapping self-declared inference). |

These remain **draft, untouched**. #106/#107 are the most strategically useful (Client Zero proof artifact; canonical-branch selection input).

---

## 5. Open blockers (see BLOCKERS.md for detail)

1. ~~#96 merge sign-off owner unnamed~~ **RESOLVED** — #96 merged to `main` 2026-06-20T23:42:20Z (`d3d198e7`) under manager authorization. _No longer a blocker._
2. **#99 base branch merged** — must retarget to `main` + rebase before it can be reviewed/merged. _Severity: medium._
3. **Legal/compliance sign-off owner unnamed** — gates ANY real outreach/ads/vendor calls (surfaced by #92 + #100). _Severity: high (for go-live), low (for current spec-only work)._
4. **Canonical-branch selection among duplicate lanes** — #90 vs #106 vs #109 (dealership/GTM); multiple cog-011 lead-detail lanes. Needs manager pick using #107. _Severity: medium._
5. **Client Zero consent unknown** — is there a real consenting dealership, or is this spec-only? Blocks any baseline/discovery execution. _Severity: high (for execution), none (for artifact readiness)._

---

## 6. Next priority (7-day; see NEXT-7-DAYS.md)

1. ✅ **#96 merged** to `main` (`d3d198e7`, 23:42:20Z) — compliance layer landed.
2. **Retarget/rebase #99** onto `main`; re-run CI; review.
3. **Use #107** to select canonical branches and mark duplicates superseded (no closing).
4. **Keep #106 Client Zero** ready as the proposal/proof artifact.
5. Converge toward **one green Client Zero × Sales Closer spine on `main`**.

**Leave alone:** mobile apps, public token, paid ads, real outreach, new vendor integrations, agent-economy/crypto lanes.
