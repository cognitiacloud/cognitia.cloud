# Cognitia — 36-Hour GTM Improvement Report

**Date:** 2026-06-20
**Prepared for:** Cognitia / Demandara (founder)
**Scope:** Final report for the 36-hour GTM improvement loop
**Branch:** `claude/cognitia-36h-gtm-report-trwx36`

---

## Reading Contract (read this first)

- **Verified, directly audited artifact:** the **Hermes Vision Skill** only
  (`hermes/skills/vision-skill/`). It is **one** capability, **not** the whole
  company. It does **not** redefine Cognitia as a video/avatar business.
- **The rest of the 36-hour / multi-agent work exists** — spread across **~105
  unmerged `claude/*` branches** plus `main`. These were **inventoried by branch
  name, not deep-audited** in this pass.
- **Status convention:** every workstream below is **EXISTS BUT UNMERGED /
  UNCENTRALIZED** unless it was directly audited. "Exists" means there is a
  branch; it does **not** mean production-ready, reviewed, or merged.
- No artifacts or citations were fabricated. Branch names are real (from the
  remote). Their *contents* were not opened in this pass.

---

## Brutal Verdict (up front)

The earlier read of "almost nothing shipped" was wrong — it came from a shallow
local clone. The truth is the opposite problem:

1. **The work exists.** Proof registry, sales closer, agent economy, token lab,
   demandara, goal-loop, compliance/SOC, business-plan audit — all have
   branches.
2. **The work is not centralized.** ~105 feature branches, the large majority
   still unmerged. The 36-hour loop's output is fragmented, not missing.
   (Consolidation has since started — the canonical Sales Closer foundation #93
   and doctrine #91/#92/#98 are now on `main`; see Section 0 for verified state.)
3. **The repo is carrying too many parallel unmerged lanes.** This is the real
   failure mode: lane sprawl with no convergence. Velocity is high; convergence
   is near zero.
4. **The immediate priority is consolidation, not more net-new build.** Another
   feature branch makes this worse, not better.
5. **Pick the few branches that map to Client Zero / Sales Closer / compliance
   foundation and review those first.** Everything else waits.

**Are we aligned, overbuilding, underbuilding, or drifting?**
- **Overbuilding** breadth (105 lanes) — yes, severely.
- **Underbuilding** convergence, proof, and the Client Zero close path — yes.
- **Drifting** on artifact centralization — yes, this is the headline.
- **Aligned** on *strategy* (Cognitia control plane / Demandara growth / Client
  Zero proof) — yes; the thesis is intact. The execution model is the problem.

**First thing tomorrow:** stop opening lanes. Follow the **Manager-Approved
Sequencing Overlay** below — it is authoritative and supersedes any looser
"start with branch X" phrasing elsewhere in this report.

---

## 0. Manager-Approved Sequencing Overlay (AUTHORITATIVE)

This overlay is the canonical consolidation doctrine. Where any other section of
this report names a different "first branch," **this overlay wins.**

**Doctrine (non-negotiable):**

1. **Do not start new implementation lanes.** Consolidation and canonical
   sequencing are the priority — not more branches.
2. **Do not treat the Sales Closer architecture/UI demo branch (#94 /
   `sales-closer-architecture`) as canonical.** It is a greenfield prototype,
   not the platform-native foundation.
3. **#94 is design reference only** — extract its design lessons / screenshots,
   then keep it closed/archived as demo reference (it must not be merged).
4. **#96 compliance layer stays draft until convergence with the #93 / #92
   canonical contracts.** Do **not** merge #96 as-is if it still adds parallel
   shared-core compliance/channel types.
5. **#99 Apify intelligence stays draft / stacked.** Technical review may
   happen, but **no merge** until the #93 foundation is stable on `main`.
6. **#98 vendor readiness is docs-only doctrine.** It may merge after quick
   alignment against #91 / #92 — but must **not** become implementation work.
7. **The next priority is consolidation and canonical sequencing, not more
   branches.**

**Recommended canonical order:**

> **#91 / data-source strategy → #92 / compliance spec → #98 / vendor-readiness
> doctrine → #93 / canonical Sales Closer foundation → #96 convergence rework →
> #99 rebase/review after #93 → #94 archive as demo reference**

**Verified PR state — read-only truth check (2026-06-20):**

> Verified live via the GitHub API on 2026-06-20. Per the no-unverified-merge
> rule, no branch below is asserted as "should merge" unless its state was
> confirmed. **Much of the canonical order has already been executed since the
> earlier draft of this report was written.**

| PR | Branch | Doctrine intent | **Verified current state** |
|---|---|---|---|
| **#91** | `sales-closer-datasource-strategy` | docs, sequence first | ✅ **MERGED to `main`** (docs-only). Step complete. |
| **#92** | `cognitia-compliance-design` | compliance spec, second | ✅ **MERGED to `main`** (docs-only). Step complete. |
| **#98** | `sales-closer-vendor-integration-porting` | docs doctrine, may merge after #91/#92 alignment | ✅ **MERGED to `main`** (docs-only). Condition already satisfied — no action. |
| **#93** | `sales-closer-engine-plan` | **canonical** foundation | ✅ **MERGED to `main`** (real code, 13 files; CI `build-test` green at merge). Canonical foundation is now on `main`. |
| **#96** | `feat/cognitia-compliance-layer-scaffold` | hold draft until convergence with #93/#92 | ⚠️ **OPEN / DRAFT** (mergeable_state clean). Per its own description still carries net-new compliance/channel types → **do not merge as-is**; needs #93/#92 convergence rework first. |
| **#99** | `sales-closer-phase2-apify` | draft/stacked; no merge until #93 stable | ⚠️ **OPEN / DRAFT**, based on the #93 branch (stacked, not `main`). #93 has now landed on `main`, so it is eligible for **rebase + technical review** — but still **no merge** per doctrine. |
| **#94** | `sales-closer-architecture` | extract design lessons, then archive | 🗄️ **CLOSED, not merged** (mergeable_state dirty). Archive step already done. Remaining: extract design lessons/screenshots for reference; keep closed. |

**Net consequence:** steps 1–4 of the canonical order (#91 → #92 → #98 → #93)
are **already on `main`**, and #94 is **already closed**. The remaining live work
is narrow and doctrine-bounded:
- **#96** — convergence rework against #93/#92 before it leaves draft.
- **#99** — rebase onto `main` (now that #93 landed) + technical review only; no merge.
- **#94** — harvest design lessons/screenshots, leave archived.

Do **not** open new implementation lanes to do any of the above.

---

## 1. Verified Artifact Inventory (directly audited)

| Artifact | Location | Status |
|---|---|---|
| Hermes Vision Skill (4 tools, 13 tests, MCP+CLI, PII/publish-safety) | `hermes/skills/vision-skill/` | **Verified, audited.** Read-only support capability for publish-safe media. Not the company. |

Everything else in this report is **branch-level inventory**, not audited code.

---

## 2. Branch Inventory & Workstream Mapping (EXISTS BUT UNMERGED)

~105 `claude/*` feature branches + `main`. Grouped into the 12 GTM workstreams.
Status for all rows: **EXISTS BUT UNMERGED / UNCENTRALIZED — not production-ready
until reviewed.**

| Workstream | Representative branches | Count (approx) |
|---|---|---|
| **Proof registry / trust layer** | `cog-003-proof-registry`, `trust-2-packet`, `truth-1-machine-readable-report`, `v4-trust-proof-explorer`, `v4b-public-proof-feed`, `v4c-curated-trust-proofs`, `v5-public-trust-feed-hardening`, `pilot-001-proof-harness`, `pilot-001-mainline-proof-harness`, `met-1-trust-metrics` | ~10 |
| **Agent Economy** | `agent-economy-001-lab` → `005-settlement-design`, `agent-economy-2week-spec`, `economy-smoke-001`, `legend-001-agent-fabric-lab`, `pass-1-agent-passports`, `cog-008-reputation-v0` | ~11 |
| **Sales Closer** | `sales-closer-architecture`, `-engine-plan`, `-datasource-strategy`, `-phase2-apify`, `-vendor-integration-porting`, `-vendor-readiness` | 6 |
| **Client Zero / CRM / front desk / HubSpot** | `cog-005-006-skillproof-ai-front-desk`, `cog-011-lead-detail(+console/+tenant)`, `crm-note-1-grounded-context-note`, `hubspot-pilot-readiness` (x2), `meeting-notes-hubspot-writeback`, `prov-1-hubspot-provenance`, `lane-e-meeting-workflow`, `cog-016-field-provenance` | ~11 |
| **Demandara / GTM strategy** | `demandara-gtm-scaffold`, `cog-014-demandara-onboarding`, `gtm-platform-mvp-setup`, `next-phase-strategy`, `next-phase-summary`, `wave-2-summary`, `cognitia-v1-1-discovery`, `business-plan-audit` | ~8 |
| **Token / credit sandbox** | `token-lab-002-architecture`, `cog-009-credits-wallet-placeholder` | 2 |
| **Goal-loop / harness / orchestration** | `cognitia-goal-loop-sprint`, `overnight-orchestrator-status`, `parallel-build-merge`, `mainline-runtime-status`, `pr-execution-order`, `windows-hermes-mesh-bridge`, `fix-hermes-bridge-stdio-loop`, `cognitia-episode-002-rebuild`, `ep002-mission-run`, `cognitia-36hr-loop`, `12h-crypto-visibility-agent-fabric` | ~11 |
| **Security / compliance / governance** | `sec-1-hardening-audit`, `soc-1-readiness-package`, `hard-1-hardening-package`, `hard-4-reanchor-security-docs`, `enf-1-enforced-governance`, `gov-1-typed-write-preview`, `cognitia-compliance-design`, `feat/cognitia-compliance-layer-scaffold`, `visibility-005-threat-governance`, `ai-drafting-governance`, `approval-workflow-operator-ui`, `undo-1-rollback` | ~12 |
| **Ads / media (Hermes-adjacent)** | Hermes Vision Skill (audited), `windows-hermes-mesh-bridge`, `fix-hermes-bridge-stdio-loop`. No dedicated ad-creative/landing-page branch found. | ~3 |
| **Audit / reporting / docs** | `audit-booklet-001-system-booklet`, `audit-booklet-001b-agent-fabric-reconcile`, `why-1-decision-rationale`, `fly-1-decision-reasons`, `rdm-1-readme-coherence`, `rdy-1-connection-readiness`, `v6a-docs-reconcile`, `plot-sessions-audit` | ~8 |
| **Operator UI / frontend / UX / a11y** | `operator-ui-shell`, `ux-2-batch-and-history`, `a11y-1-route-accessibility`, `a11y-2-authenticated-queue`, `run-1-run-plans`, `run-2-run-detail-timeline`, `run-3-run-lineage` | ~7 |
| **Platform / data / infra / eval** | `cog-002-schema-foundation`, `cog-004-atc`, `v6-managed-postgres-rls`, `code-28-50-integrator`, `sim-1-preflight`, `eval-1-golden-gate`, `learn-1-scorecards`, `regr-1-rejection-flywheel`, `alpha-1-live-readiness`, `crypto-visibility-001`, `visibility-002/003/004` | ~14 |

> Note: a few branches are ambiguous (`exciting-shannon`, `scope-guardrail-no-thesis-pivots`) and not deep-audited. `scope-guardrail-no-thesis-pivots` is itself a useful signal — someone already flagged thesis-drift risk.

---

## 3. Corrected Cognitia / Demandara Positioning

- **Cognitia** = the agent **trust / control plane** — proof registry,
  compliance layer, Sales Closer / GTM OS, agent-economy infrastructure. The
  branch sprawl above is *consistent* with this: trust, proof, governance,
  economy, and closer lanes dominate. The vision is real and broad.
- **Demandara** = the **growth / operator** layer running motions on top.
- **Hermes Vision Skill** = one publish-safety capability inside this. Useful,
  audited, but **not** the company.

The strategy is **not** the problem. The problem is that ~105 lanes prove the
strategy without ever **landing** it on a trunk.

---

## 4. Client Zero — Direction & Branches to Land First

Client Zero is the dealership growth proof workflow. The relevant lanes already
exist (`cog-005-006-skillproof-ai-front-desk`, `cog-011-lead-detail*`,
`hubspot-pilot-readiness`, `demandara-gtm-scaffold`, `cog-014-demandara-
onboarding`). **Do not build a new Client Zero lane.** Instead:

1. Review and merge the front-desk + lead-detail + hubspot-pilot branches into
   one coherent Client Zero path on `main`.
2. Define the one dealership ICP + one proof metric.
3. Concierge-deliver once; capture the outcome as the first proof-registry entry.

---

## 5. Sales Closer v1 — Recommendation

> **Defer to Section 0 (Manager-Approved Sequencing Overlay) for canonical
> sequencing and verified PR state.** The text below is corrected to match it.

Six sales-closer branches were opened. Per the truth check (2026-06-20), the
canonical foundation has **already landed**: **#93 / `sales-closer-engine-plan`
is the canonical platform-native foundation and is MERGED to `main`** (with
#91 data-source and #92/#98 doctrine also merged). v1 recommendation:

1. **#93 is the spine — it is canonical and already on `main`.** Do **not** treat
   `sales-closer-architecture` (#94) as canonical; #94 is a greenfield prototype,
   now **closed/archived** — harvest its design lessons/screenshots only.
2. Bring remaining work onto the #93 foundation per doctrine: **#96** compliance
   layer stays draft until it converges with #93/#92 (no parallel shared-core
   types); **#99** Apify scaffold stays draft/stacked — rebase + technical review
   now that #93 has landed, but **no merge** yet.
3. Ship a single qualify → book → demo → offer → follow-up path tied to Client
   Zero on top of #93. Only automate after one manual close validates the offer.

---

## 6. Agent Economy Proof-Layer — Recommendation

Strong lane coverage (`agent-economy-001..005`, `2week-spec`, `pass-1-agent-
passports`, `cog-008-reputation-v0`, plus the whole proof-registry cluster).
This is core Cognitia infra — keep it — but **sequence after Client Zero**.

- Near-term concrete proof: use Hermes `publish_safe` output + `cog-003-proof-
  registry` as the **first real proof artifact**.
- Review order: `cog-003-proof-registry` → `pass-1-agent-passports` →
  `cog-008-reputation-v0` → settlement/marketplace lanes (defer).

---

## 7. Internal Token / Credit Sandbox — PARK

Lanes exist (`token-lab-002-architecture`, `cog-009-credits-wallet-
placeholder`). **Park both.** No metering need before paying usage. Keep the
placeholder; do not invest further until Client Zero generates real usage.

---

## 8. Ads / Media Launch Readiness — NOT READY

No dedicated ad-creative or landing-page branch exists. Hermes can QC media,
but there is no offer page, pixel, or creative. **Prereqs before paid:** one
Client Zero proof outcome + a one-page offer + 2–3 organic proof clips.
Sequence: proof → one manual close → small paid test.

---

## 9. Goal-Loop Harness — Recommendation

The harness lanes (`cognitia-goal-loop-sprint`, `overnight-orchestrator-status`,
`parallel-build-merge`, `pr-execution-order`, `mainline-runtime-status`) are the
mechanism that *produced* the sprawl. Fix the goal function:

- Change the loop objective from "open a lane / ship a feature" to **"converge a
  lane onto `main` + advance one Client Zero deal."**
- Add a mandatory **merge/centralization step** to every loop so output lands in
  one place. Note `parallel-build-merge` and `pr-execution-order` already exist —
  **use them**; this is a solved-on-paper problem that was never run.
- Do **not** generalize the harness into a platform yet.

---

## 10. Kill / Park / Build Queue

- **KILL (stop opening):** any net-new feature lane not tied to consolidation;
  duplicate lanes (`sales-closer` x6, `cog-011-lead-detail` x3, `hubspot-pilot-
  readiness` x2, `agent-economy-004-marketplace` x2, `pilot-001-proof-harness`
  x2/x3).
- **PARK:** token/credit sandbox; agent-economy settlement/marketplace; ads;
  harness generalization; most platform/infra lanes.
- **BUILD / CONVERGE (consolidate, don't create — see Section 0 for canonical order & verified state):**
  1. **Sales Closer:** #93 canonical foundation is **already merged to `main`**;
     converge **#96** (compliance layer — rework off #93/#92, keep draft) and
     **#99** (Apify — rebase/review only, no merge). Harvest #94 design lessons,
     keep it archived.
  2. Client Zero path (`cog-005-006-front-desk` + `cog-011-lead-detail` +
     `hubspot-pilot-readiness`) onto the #93 foundation.
  3. Proof registry MVP (`cog-003-proof-registry`).

---

## 11. Security / Compliance Gaps

| # | Gap | Trigger / where it lives |
|---|---|---|
| 1 | Hermes sends images to external LLM providers — confirm no PII egress | Before real customer content runs through it |
| 2 | Avatar/likeness consent tracking absent | Before any commercial avatar media |
| 3 | Compliance **spec/doctrine merged** (#92, #98 on `main`); compliance **layer scaffold still draft** (#96 / `feat/cognitia-compliance-layer-scaffold`) pending #93/#92 convergence | Converge #96 before first paid Client Zero |
| 4 | SOC/hardening packages unmerged (`soc-1-readiness-package`, `sec-1-hardening-audit`, `hard-1/4`) | Before diligence / pilot |
| 5 | Proof-registry integrity/audit trail unmerged — undercuts the trust-layer claim | Before marketing the Agent Economy proof layer |
| 6 | No privacy policy / ToS for a commercial offer | Before first paid engagement |

The biggest compliance risk is not a missing control — it's that the controls
are **built but unmerged**, so they protect nothing in their current state.

---

## 12. Next 7-Day Execution Plan (consolidation-first)

**Guardrail: open zero new feature lanes this week. Only merge, review, delete.**
**Follow the Section 0 canonical order; respect verified PR state (much of it is
already merged).**

- **Day 1 (tomorrow):**
  - Confirm `main` as the single consolidation target (canonical foundation #93
    is already merged there).
  - Rebase **#99** onto `main` (now that #93 has landed) and request technical
    review only — **no merge**.
  - Read prior summary branches (`next-phase-summary`, `wave-2-summary`,
    `business-plan-audit`) to confirm canonical framing.
- **Day 2–3:**
  - Rework **#96** off #93/#92 to drop parallel shared-core compliance/channel
    types; keep it draft until convergence is clean.
  - Harvest #94 design lessons/screenshots; leave it closed/archived.
- **Day 4–5:**
  - Stand up the Client Zero path (`cog-005-006-front-desk` + `cog-011-lead-
    detail` + `hubspot-pilot-readiness`) on the #93 foundation.
  - Define Client Zero dealership ICP + one-page offer + booking link.
- **Day 6–7:**
  - Proof-registry MVP (`cog-003-proof-registry`); wire Hermes `publish_safe` as
    first proof entry.
  - First concierge Client Zero proof run on the consolidated trunk.
  - Delete or archive dead/duplicate branches; write the convergence summary.

### Top branches to deep-dive next (recommended order — aligned to Section 0)
1. **#96** `feat/cognitia-compliance-layer-scaffold` — convergence rework off the
   merged #93/#92 contracts (keep draft).
2. **#99** `sales-closer-phase2-apify` — rebase onto `main` + technical review
   (no merge).
3. **#94** `sales-closer-architecture` — extract design lessons/screenshots only
   (already closed/archived).
4. `cog-005-006-skillproof-ai-front-desk` + `hubspot-pilot-readiness` (Client
   Zero path on the #93 foundation).
5. `cog-003-proof-registry`, then `next-phase-summary` / `wave-2-summary` /
   `business-plan-audit` (anchoring).

> #93 `sales-closer-engine-plan` is intentionally **not** in this list — it is
> the canonical foundation and is **already merged to `main`**.

---

## One-Line Answer

The work **exists but is fragmented across ~105 branches** — we're
**overbuilding lanes, underbuilding convergence, and drifting on
centralization**, while the **Cognitia / Demandara / Client Zero** strategy
stays intact. Consolidation has **begun** (canonical Sales Closer foundation #93
plus doctrine #91/#92/#98 are now merged to `main`; demo #94 is closed).
**First thing tomorrow: open zero new lanes and follow the Section 0
Manager-Approved Sequencing Overlay — converge #96, rebase/review #99, harvest
#94 — respecting verified PR state.**

---

*Verified/audited artifact this pass: Hermes Vision Skill only. All other
workstreams are branch-level inventory — EXISTS BUT UNMERGED, not production-
ready, not individually audited. No artifacts or citations were fabricated.*
