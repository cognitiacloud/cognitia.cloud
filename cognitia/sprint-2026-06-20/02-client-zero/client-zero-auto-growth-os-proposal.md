# Client Zero Auto Growth OS — Pilot Proposal (Outline)

**Prepared by:** Cognitia
**Pilot partner:** [Dealer] (single-rooftop automotive dealership, "Client Zero")
**Sponsor / decision-maker:** [GM Name]
**Date:** 2026-06-20
**Status:** Draft proposal outline (not a committed scope or sales deck)

---

## Executive Summary

Most dealerships lose qualified, in-market buyers not for lack of leads but because of slow and inconsistent follow-up. Industry benchmarks suggest the highest-performing stores respond to internet leads in under ~30 minutes, yet many take hours — and a large share of buyers who hit voicemail or silence simply contact a competitor (unverified estimate, sourced from public BDC benchmark commentary).

The **Auto Growth OS** is an AI-agent-driven layer that sits *on top of* the dealership's existing CRM/DMS and works the funnel — **web lead → BDC → appointment → showroom → sale** — by speeding lead response, nurturing patiently, assisting appointment-setting, helping merchandise inventory, reactivating dead leads, and prompting reviews. Humans stay in the loop; agents draft, prioritize, and surface, while the BDC and sales team decide and close.

This document is an **outline** covering the problem, the agent-level solution design, a four-phase pilot, **target** metrics (not guarantees), data/integration needs at a capability level, pricing **options** to decide later, risks, and an explicit out-of-scope boundary.

> **Hard constraints honored in this proposal:** No guaranteed ROI/sales/SEO claims — all numbers are *targets* or ranges. No raw PII (placeholders used). **No voice or SMS automation is designed or included** — flagged as future/out-of-scope. No real outreach to named individuals. Any future automated messaging is gated behind a documented consent/compliance checkpoint.

---

## 1. Problem Statement (Typical Dealership)

A typical single-rooftop store experiences some combination of:

- **Slow first response.** Internet leads arrive 24/7; staffed BDC hours don't match. First-touch can lag from minutes to hours, well past the point where buyer intent is highest.
- **Inconsistent nurture.** Leads that don't buy in week one are under-worked. Follow-up cadence depends on which rep owns the lead and how busy the day is.
- **Appointment friction.** Set rates and show rates swing widely; confirmations are manual and easy to drop.
- **Dead-lead graveyard.** Thousands of older CRM records (no-shows, "just looking," aged internet leads) sit untouched despite some still being in-market.
- **Thin merchandising.** New inventory can sit with weak or missing descriptions/photos sequencing, hurting marketplace performance.
- **Reviews left to chance.** Happy customers aren't reliably asked; reputation grows slowly and unevenly.

**Net effect:** leakage at every funnel stage. Small percentage-point gains in response, set, show, and reactivation compound into meaningful unit volume.

### Reference funnel & public benchmarks (context, not promises)

| Funnel stage | Common public benchmark (unverified estimate) | Notes |
|---|---|---|
| Lead response time | Top performers < ~30 min on internet leads | First minutes drive contact rate |
| Appointment set rate (internet leads) | ~25–40% = strong | Phone leads typically set much higher |
| Appointment set rate (inbound calls) | ~55–65% for a trained BDC | Call handling quality dependent |
| Show rate (internet appointments) | ~40%+; well-run stores aim ~70% | Confirmation + specific time helps |
| Reactivation of aged leads | Highly variable | Large untapped CRM base |

*Sources for context appear at the bottom of this file. Treat all figures as directional, not commitments.*

---

## 2. Proposed Solution — Agent-Driven Design (Capability Level)

The Auto Growth OS is a set of cooperating AI agents orchestrated over the dealer's data. Design principle: **human-in-the-loop by default**; agents propose, staff approve/send; escalation paths are explicit.

| Agent | What it does (design level) | Human checkpoint |
|---|---|---|
| **Lead Response agent** | Detects new leads across sources, classifies intent, drafts a fast, personalized first-touch reply, routes to the right rep/queue. | Rep approves/sends draft; auto-send only if/when consent + compliance gate is cleared (future). |
| **Lead Nurture agent** | Maintains a structured multi-touch cadence for un-closed leads; tailors content to vehicle interest and stage; flags re-engaged leads as "hot." | BDC reviews queued touches; tone/cadence governed by playbook. |
| **Appointment-Setting assist** | Proposes times, drafts confirmations/reminders, surfaces no-show risk, helps reschedule. | Staff confirm; calendar writes are reviewed. |
| **Inventory / Merchandising assist** | Drafts/improves VDP descriptions, flags units with thin photos/specs, suggests merchandising priority. | Merchandiser approves before publish. |
| **Dead-Lead Reactivation agent** | Scores aged CRM records for likelihood-to-reengage, drafts win-back outreach for *consented* contacts, segments the backlog. | Mandatory consent/DNC screen before any contact; staff approve. |
| **Review-Generation assist** | Identifies satisfied post-sale/service customers and drafts review-request prompts (via compliant, consented channels). | Staff send; channel governed by compliance. |

**Orchestration layer:** a shared lead/contact model, an event queue (new lead, status change, no-show, delivery), a policy/guardrail layer (consent state, quiet hours, opt-out), and an audit log for every agent action.

> **Channel note:** All agent "outreach" in the pilot is **draft-and-assist** through existing human-operated channels and the CRM. **Automated voice and SMS sending are explicitly NOT part of this design** (see Section 8 and Out-of-Scope).

---

## 3. Phased Pilot Plan

| Phase | Goal | Key activities | Exit criteria |
|---|---|---|---|
| **1. Discovery** (Wk 1–2) | Understand the store | Run discovery questionnaire; map funnel, tools, SLAs, compliance posture; baseline current metrics | Signed-off baseline + agreed target ranges |
| **2. Instrument** (Wk 2–4) | Wire up data + guardrails | Establish read access to CRM/DMS at capability level; define lead/contact schema; stand up consent/opt-out/quiet-hours guardrails; configure audit logging; staff playbooks | Data flowing; guardrails verified; dry-run drafts reviewed |
| **3. Pilot** (Wk 4–10) | Run agents in assist mode | Lead Response + Nurture + Appointment assist live (human-approved); start Reactivation on consented segments; Merchandising + Review assist | Agents operating daily; weekly review cadence held |
| **4. Measure** (Wk 10–12) | Evaluate vs. targets | Compare to baseline; isolate agent-attributable lift; document learnings; scope decision (expand / adjust / stop) | Readout deck + go/no-go recommendation |

*Timeline is indicative and adjusts to data-access lead times and dealer staffing.*

---

## 4. Success Metrics (TARGETS, not guarantees)

All metrics are measured **against the store's own Phase-1 baseline** and expressed as target *ranges* or *directional improvements*. No absolute sales or revenue figure is promised.

| Metric | Definition | Target (directional) | Feeds from |
|---|---|---|---|
| **Lead response time** | Median time to first meaningful touch on a new lead | Move toward < ~30 min during covered hours | Discovery baseline + event logs |
| **Appointment set rate** | % of worked leads that become a set appointment | Improvement over baseline; aim toward upper benchmark range | CRM appointment data |
| **Show rate** | % of set appointments that show | Improvement over baseline | CRM/showroom logs |
| **Reactivation rate** | % of *consented* aged leads re-engaged | Establish a baseline-to-target lift (new motion) | Reactivation agent + CRM |
| **Review volume (secondary)** | Net new reviews via consented requests | Directional increase | Review assist logs |
| **Operational** | Draft acceptance rate, time saved per rep | Tracked for adoption, not as a sales claim | Audit log |

> Targets are commitments to *effort and method*, not to outcomes. Attribution caveats (seasonality, inventory, ad spend) are documented in the Phase-4 readout.

---

## 5. Data & Integration Requirements (Capability Level)

Stated as **capabilities needed**, not specific connector commitments.

- **Lead intake:** ability to receive/ingest leads from the store's sources (e.g., website forms, AutoTrader, Cars.com, Facebook Marketplace, OEM/manufacturer leads, phone-lead logs).
- **CRM access:** read (and, where approved, scoped write) to the dealer's CRM — e.g., **VinSolutions, CDK, DealerSocket, Elead** — at a capability level: leads, contacts, statuses, appointments, notes.
- **DMS context (read):** inventory, deal/sold status, service records where relevant to merchandising and review timing.
- **Inventory feed:** access to current inventory + VDP content for the merchandising assist.
- **Consent & suppression data:** consent state, opt-out/DNC flags, contact preferences — *required before any contact motion*.
- **Identity & security:** least-privilege scoped credentials, no raw PII exported beyond what's necessary, audit logging, data-handling agreement with [Dealer].

*Exact integration method (native API, middleware, or export-based) is determined in Phase 2 based on what [Dealer]'s stack permits.*

---

## 6. Pricing Model — OPTIONS (to decide, not committed)

Presented as options for [Dealer] and Cognitia to choose from. **No pricing is committed in this outline.**

| Option | Structure | Pros | Cons / cautions |
|---|---|---|---|
| **A. Flat pilot fee** | Fixed fee for the 10–12 week pilot | Predictable; clean scope; simplest to govern | No outcome alignment |
| **B. Performance-share** | Base + share tied to *measured, attributable* lift vs. baseline | Aligns incentives | Attribution disputes; needs airtight measurement; must avoid implying guaranteed ROI |
| **C. SaaS subscription** | Monthly platform fee post-pilot (per-rooftop / per-seat / usage tiers) | Recurring, scalable | Premature before pilot proves fit |
| **Hybrid** | Pilot fee now → SaaS (± modest performance component) if expanded | Stages risk | More terms to negotiate |

**Recommendation to discuss:** start with **Option A (flat pilot fee)** to de-risk and keep measurement clean, with a pre-agreed path to **Option C/Hybrid** if the Phase-4 readout supports expansion.

---

## 7. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **Data access delays** | Slips timeline | Confirm access path in Discovery; export-based fallback |
| **Compliance (TCPA/consent/DNC)** | Legal/reputational | No outreach without verified consent; guardrail layer; legal review before any messaging automation (future) |
| **Attribution ambiguity** | Disputed results | Baseline + control logic; document confounders; avoid outcome guarantees |
| **Staff adoption** | Agents ignored | Human-in-loop design, playbooks, weekly reviews, draft-acceptance tracking |
| **CRM/DMS API limits** | Reduced functionality | Capability-level scoping; degrade gracefully |
| **Over-automation / brand tone** | Customer trust | Approval gates; tone governance; opt-out honored |
| **Single-store sample** | Limited generalizability | Frame as Client Zero learning, not proof at scale |

---

## 8. Scope Boundary — What is OUT of the Pilot

Explicitly **NOT** in this pilot:

- **Automated voice (IVR/AI calling) and automated SMS sending** — future/out-of-scope. Any move toward these requires a separate consent/compliance design and legal sign-off **before** activation.
- **Guaranteed sales, revenue, ROI, or SEO outcomes** — not offered; only targets/ranges.
- **Real outreach to named individuals** during proposal/design.
- **Full CRM/DMS replacement or migration** — the OS augments, it does not replace.
- **Multi-rooftop rollout** — pilot is single-store (Client Zero) only.
- **Paid-media buying/management, F&I, pricing/desking, and service scheduling automation** — not in this pilot.
- **Autonomous send without human approval** — out for the pilot; assist/draft mode only.

---

## Appendix — Benchmark Sources (context only)

- Foureyes — appointment set rate benchmarks: https://www.foureyes.io/blog/dealership-appointment-set-rates
- Demand Local — appointment setting & show rate statistics: https://www.demandlocal.com/blog/appointment-setting-show-rate-statistics/
- VinSolutions (CRM context): https://www.vinsolutions.com/
- Spyne — automotive BDC metrics: https://www.spyne.ai/blogs/automotive-bdc-metrics

*All benchmark figures are directional/unverified estimates used for framing, not commitments.*
