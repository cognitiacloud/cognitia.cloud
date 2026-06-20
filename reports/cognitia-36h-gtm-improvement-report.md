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
2. **The work is not centralized.** ~105 feature branches, essentially none
   consolidated onto `main`. The 36-hour loop's output is fragmented, not
   missing.
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

**First thing tomorrow:** stop opening lanes. Choose a consolidation target on
`main`, then merge/review the 3–5 branches that constitute the Client Zero +
Sales Closer + compliance foundation. Consolidate before you build.

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

Six sales-closer branches exist (`architecture`, `engine-plan`,
`datasource-strategy`, `phase2-apify`, `vendor-integration-porting`,
`vendor-readiness`) — and **none merged**. This is the clearest example of lane
sprawl. v1 recommendation:

1. **Consolidate the 6 branches into one.** Pick `sales-closer-architecture` +
   `engine-plan` as the spine; fold in `datasource-strategy` and
   `vendor-readiness`; defer `phase2-apify`.
2. Ship a single qualify → book → demo → offer → follow-up path tied to Client
   Zero.
3. Only automate after one manual close validates the offer.

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
- **BUILD / LAND FIRST (consolidate, don't create):**
  1. Client Zero path (`cog-005-006-front-desk` + `cog-011-lead-detail` +
     `hubspot-pilot-readiness`).
  2. Sales Closer v1 (collapse the 6 branches into 1).
  3. Compliance foundation (`cognitia-compliance-design` / `feat/cognitia-
     compliance-layer-scaffold` + `sec-1-hardening-audit`).
  4. Proof registry MVP (`cog-003-proof-registry`).

---

## 11. Security / Compliance Gaps

| # | Gap | Trigger / where it lives |
|---|---|---|
| 1 | Hermes sends images to external LLM providers — confirm no PII egress | Before real customer content runs through it |
| 2 | Avatar/likeness consent tracking absent | Before any commercial avatar media |
| 3 | Compliance layer exists only as **unmerged scaffold** (`feat/cognitia-compliance-layer-scaffold`, `cognitia-compliance-design`) | Land before first paid Client Zero |
| 4 | SOC/hardening packages unmerged (`soc-1-readiness-package`, `sec-1-hardening-audit`, `hard-1/4`) | Before diligence / pilot |
| 5 | Proof-registry integrity/audit trail unmerged — undercuts the trust-layer claim | Before marketing the Agent Economy proof layer |
| 6 | No privacy policy / ToS for a commercial offer | Before first paid engagement |

The biggest compliance risk is not a missing control — it's that the controls
are **built but unmerged**, so they protect nothing in their current state.

---

## 12. Next 7-Day Execution Plan (consolidation-first)

**Guardrail: open zero new feature lanes this week. Only merge, review, delete.**

- **Day 1 (tomorrow):**
  - Declare `main` the single consolidation target.
  - Open draft PRs for the 4 "land first" lanes (Client Zero, Sales Closer
    spine, compliance scaffold, proof-registry).
  - Read prior summary branches (`next-phase-summary`, `wave-2-summary`,
    `business-plan-audit`) to confirm canonical framing.
- **Day 2–3:**
  - Review + merge the Client Zero path and the compliance foundation.
  - Collapse the 6 sales-closer branches into one; merge.
- **Day 4–5:**
  - Merge proof-registry MVP; wire Hermes `publish_safe` as first proof entry.
  - Define Client Zero dealership ICP + one-page offer + booking link.
- **Day 6–7:**
  - First concierge Client Zero proof run on the now-consolidated trunk.
  - Delete or archive dead/duplicate branches; write the convergence summary.

### Top branches to deep-dive next (recommended order)
1. `cog-003-proof-registry`
2. `sales-closer-architecture` + `sales-closer-engine-plan`
3. `feat/cognitia-compliance-layer-scaffold` + `cognitia-compliance-design`
4. `cog-005-006-skillproof-ai-front-desk` + `hubspot-pilot-readiness`
5. `next-phase-summary` / `wave-2-summary` / `business-plan-audit` (anchoring)

---

## One-Line Answer

The work **exists but is fragmented across ~105 unmerged branches** — we're
**overbuilding lanes, underbuilding convergence, and drifting on
centralization**, while the **Cognitia / Demandara / Client Zero** strategy
stays intact. **First thing tomorrow: stop opening lanes and consolidate the
Client Zero + Sales Closer + compliance + proof-registry branches onto `main`.**

---

*Verified/audited artifact this pass: Hermes Vision Skill only. All other
workstreams are branch-level inventory — EXISTS BUT UNMERGED, not production-
ready, not individually audited. No artifacts or citations were fabricated.*
