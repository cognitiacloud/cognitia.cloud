# Workstream Map — 12 GTM Workstreams

> Scope statements below describe what each workstream **appears to cover** (name inference). Critical-path notes flag what blocks the Client Zero pilot. Not a content audit.

## Critical path (Tier 1)

### WS1 — Sales Closer Engine (product core) · 6 branches · T1

The AI sales agent itself: voice + text engagement, qualification, booking. Includes architecture, engine plan, vendor readiness/porting (voice/text infra — Vapi/Retell-class), data sourcing (Apify).

- **Critical-path note:** `sales-closer-architecture-989w7r` and `sales-closer-engine-plan-c3quih` are competing designs of record — pick canonical first. Vendor-readiness branches decide build-vs-buy for telephony.

### WS6 — Data Foundation & Schema · 6 branches · T1

The data spine everything writes to: schema foundation, proof registry, field provenance, managed Postgres + RLS (multi-tenant).

- **Critical-path note:** `cog-002-schema-foundation` is the merge-blocker for WS3/4/5 — merge first.

### WS7 — Compliance & Governance · 7 branches · T1

TCPA/consent/recording posture, AI drafting governance, enforced governance, typed write preview (human-in-loop), scope guardrails.

- **Critical-path note:** `feat/cognitia-compliance-layer-scaffold` + `cognitia-compliance-design-xpzaj3` are **non-negotiable before any dealership outbound calling/texting**. Legal gate, not a nice-to-have.

### WS4 — CRM Integration (HubSpot) · 7 branches · T1

Lead/meeting/opportunity round-trip with HubSpot: write-back, provenance, grounded notes, sync, pilot readiness.

- **Critical-path note:** `meeting-notes-hubspot-writeback` + chosen `hubspot-pilot-readiness-*` = the Client Zero proof ("booked appt lands in the dealer's CRM").

### WS3 — Client Zero / Pilot Enablement · 6 branches · T1

Pilot proof harness, AI front desk (receptionist), connection + live readiness.

- **Critical-path note:** pick one proof harness; `cog-005-006-skillproof-ai-front-desk` is the inbound-handling surface.

## Needed for a usable pilot (Tier 2)

### WS5 — Lead & Operator Console UI · 8 branches · T2

The human operator surface: lead-detail console, operator UI shell, approval workflow, batch/history, accessibility.

- **Note:** three competing `cog-011-lead-detail*` lanes — reconcile to one.

### WS2 — Demandara GTM & Positioning · 9 branches · T2

Brand/offer/onboarding: Demandara GTM scaffold, dealership proposal (Client Zero wedge), GTM platform MVP, onboarding, business-plan audit, strategy/summary docs, this competitor-research pack.

- **Note:** `auto-growth-dealership-proposal-22ntav` is the concrete Client Zero offer.

### WS8 — Security & Trust / SOC Readiness · 9 branches · T2

Hardening audits/packages, SOC readiness, command-audit proof pack, reputation v0, trust packets, machine-readable reporting, credits-wallet placeholder.

- **Note:** needed for dealer/enterprise trust, but after the functional spine.

## Keep the best, park/mark superseded (Tier 3)

### WS9 — Eval / QA / Decision Quality · 11 branches · T3

Golden-gate eval, preflight sim, trust metrics, scorecards, rejection flywheel, decision reasons/rationale, rollback, run plans/timeline/lineage.

- **Note:** strong agent-quality scaffolding; not on the revenue path this week.

### WS10 — Orchestration & Multi-Agent Loop (meta) · 12 branches · T3

How the 36h loop runs: loop harness/sprint, checkpoints, PR execution order, parallel-build-merge, integrator, orchestrator status, system booklet, README coherence.

- **Note:** `pr-execution-order-oce1w6`, `parallel-build-merge-ob37sg`, `code-28-50-integrator-qo4x4b` are **directly useful for the consolidation effort itself** — mine them for merge ordering.

### WS11 — Hermes Runtime & Vision (verified lineage) · 6 branches · T3

The one artifact lineage actually reflected on `main`: vision QC skill, Hermes bridge (stdio/Windows mesh), episode rebuilds/mission runs, v1.1 discovery, plot-sessions audit.

- **Note:** keep; it's the proven substrate, but it is **one component**, not the company.

## Parked Strategic R&D (PARK)

### WS12 — Agent Economy + Crypto Visibility · ~22 branches · PARK

Agent economy (lab, dispute resolution, agent actions, marketplace/matching, settlement, passports, token lab, smoke test, agent-fabric lab/reconcile) + crypto visibility / public trust-proof feed (`crypto-visibility-001`, `12h-…`, `visibility-002/003/004`, `v4/v4b/v4c/v5-*`).

- **Decision:** strategically relevant, **execution-paused**. Tag + freeze, keep branches in place (no archive, no delete). Revisit after Client Zero pilot ships.
