# Cognitia GTM — Roadmap Improvements

**Sprint:** 2026-06-20 / 01-gtm
**Status:** Draft for internal prioritization
**Scope:** Prioritized improvements to Cognitia's GTM system, anchored on the "Client Zero Auto Growth OS" beachhead (automotive dealerships).

---

## Executive Summary

Cognitia's GTM has the right *story* (vertical "Auto Growth OS," agent-driven execution) but — per competitor research — wins or loses on **trust, instrumentation, time-to-value, and compliance posture**, not on "we have agents." This document assumes an early-stage GTM motion and proposes a 90-day plan to (1) tighten the auto-dealer ICP and offer, (2) build the **measurement spine** (activation, time-to-first-value, pipeline created, win rate) before scaling spend, and (3) ship a compliance-by-design baseline.

The single biggest risk is **scope creep into horizontal "agent OS" land** and into **voice/SMS automation** (out of scope, high TCPA liability). The plan is deliberately narrow: prove repeatable, instrumented value with a handful of "Client Zero" dealers before broadening.

All outcome language is framed as **targets/ranges** — no guaranteed ROI, SEO, or sales outcomes.

---

## Current-State Assumptions (Explicit)

> These are **assumptions**, not verified facts. Validate each before committing resources.

1. **A-1.** Cognitia is pre- or early-revenue in the auto vertical, with 0–small number of "Client Zero" dealer pilots.
2. **A-2.** The product can execute agent-driven outbound/engagement and some lead-handling, but pipeline-outcome instrumentation is thin or manual.
3. **A-3.** ICP is not yet razor-sharp (rooftop size, brand, region, CRM/DMS in use, BDC maturity).
4. **A-4.** Pricing is not publicly defined / is bespoke per deal.
5. **A-5.** Integrations to dealer CRMs/DMS (VinSolutions, DealerSocket, CDK, etc.) are partial or roadmap.
6. **A-6.** Compliance handling (CAN-SPAM, TCPA, CASL — consent, opt-out suppression, audit logging) exists informally but is not a formalized, demonstrable feature.
7. **A-7.** Sales motion is founder-led; no formal activation funnel or instrumentation.
8. **A-8.** No standardized "first value" milestone or onboarding playbook.

*If any assumption is false (e.g., instrumentation already exists), re-weight the roadmap accordingly.*

---

## 0–30 / 30–60 / 60–90 Day Plan

### Phase 1 — 0–30 days: Sharpen & Instrument the Core
- **ICP lock.** Define the beachhead dealer profile precisely: rooftop count, brand mix, region, CRM/DMS, BDC size, monthly lead volume. Document an ICP one-pager + 3 anti-personas.
- **Offer definition.** Convert bespoke deals into 1–2 packaged offers with a clear "what you get / what we measure" scope. Frame outcomes as **targets/ranges**, never guarantees.
- **Measurement spine v1.** Stand up core instrumentation: activation event, time-to-first-value (TTFV), pipeline created, appointment/lead-to-appointment rate, win rate. Even if partly manual at first.
- **Compliance baseline v1.** Document consent capture, universal opt-out suppression, and audit logging across channels in scope. Note CAN-SPAM / TCPA / CASL obligations. *(Channels limited to scope — no voice/SMS automation design.)*
- **Client Zero retros.** Structured interviews with current pilot dealer(s): where they got value, where they stalled.

### Phase 2 — 30–60 days: Prove Repeatable Time-to-Value
- **Onboarding playbook.** A repeatable path to first value with an explicit TTFV target (e.g., "first qualified pipeline within X days" — target, not promise).
- **Integration priority.** Ship/firm up the top 1–2 dealer CRM/DMS integrations by ICP prevalence (likely VinSolutions/Cox and DealerSocket — validate against actual pilot stack).
- **Pricing transparency test.** Draft public-leaning pricing tiers (borrowing Relevance AI's transparency); A/B against bespoke quoting on conversion + sales-cycle length.
- **Dashboard v1.** Dealer-facing dashboard exposing the measurement spine (proof, not vanity metrics).
- **Case-evidence (compliant).** Build anonymized result narratives using `[Dealer Name]` placeholders; ranges only.

### Phase 3 — 60–90 days: Scale the Proven Motion
- **Repeatability gate.** Only scale spend/outreach if ≥2–3 dealers hit TTFV + activation targets.
- **Self-serve onboarding slice.** Reduce founder-led friction for the qualified-inbound path.
- **Enablement/trust motion.** Lightweight dealer education content (mirroring Impel's certification-style trust-building) — compliant, no outcome guarantees.
- **Compliance v2.** Harden audit trails + opt-out suppression into a demonstrable, sellable feature.
- **Pipeline review cadence.** Weekly instrumentation review; kill experiments not moving activation/TTFV/win rate.

---

## ICE Prioritization Table

*Scoring: Impact (1–10), Confidence (1–10), Ease (1–10). ICE = average. Higher = do first.*

| # | Improvement | Impact | Confidence | Ease | ICE | Phase |
|---|---|---|---|---|---|---|
| 1 | Measurement spine (activation, TTFV, pipeline, win rate) | 10 | 9 | 7 | 8.7 | 1 |
| 2 | ICP lock + anti-personas | 9 | 9 | 8 | 8.7 | 1 |
| 3 | Packaged offer (target/range framing) | 9 | 8 | 8 | 8.3 | 1 |
| 4 | Onboarding playbook + TTFV target | 9 | 8 | 6 | 7.7 | 2 |
| 5 | Compliance-by-design baseline | 8 | 9 | 6 | 7.7 | 1 |
| 6 | Pricing transparency test | 8 | 7 | 7 | 7.3 | 2 |
| 7 | Top 1–2 CRM/DMS integrations | 9 | 8 | 4 | 7.0 | 2 |
| 8 | Dealer-facing proof dashboard | 8 | 7 | 6 | 7.0 | 2 |
| 9 | Repeatability gate before scaling | 8 | 8 | 5 | 7.0 | 3 |
| 10 | Dealer enablement/trust content | 6 | 7 | 7 | 6.7 | 3 |
| 11 | Self-serve onboarding slice | 7 | 6 | 4 | 5.7 | 3 |

*(ICE chosen over RICE: reach is hard to estimate credibly at this stage; revisit with RICE once funnel volume exists.)*

---

## Top 5 Highest-Leverage Improvements

1. **Build the measurement spine first.** Without activation / TTFV / pipeline-created / win-rate instrumentation, every other decision is guesswork and you can't prove value (the category's #2 gap). *Highest leverage.*
2. **Lock the ICP and package the offer.** Diffuse targeting + bespoke deals = slow cycles and no repeatability. Narrow it; productize it; frame outcomes as targets/ranges.
3. **Repeatable time-to-value onboarding.** Fast, provable first value is the wedge vs. slow-integrating incumbents and DIY toolkits.
4. **Compliance-by-design as a feature.** TCPA exposure is large and rising; turning consent/opt-out/audit into a demonstrable feature is both a moat and a risk-reducer.
5. **Pricing transparency experiment.** Nearly every competitor hides pricing; transparency is a cheap, testable differentiator that shortens cycles.

---

## Metrics / Instrumentation to Add

| Metric | Definition | Why it matters | Initial target framing |
|---|---|---|---|
| **Activation rate** | % of onboarded dealers reaching a defined "first meaningful use" event | Leading indicator of retention | Set baseline in Phase 1; improve QoQ (target, not guarantee) |
| **Time-to-First-Value (TTFV)** | Days from onboarding start to first qualified pipeline/appointment | Core competitive wedge | Target a defined ceiling per cohort |
| **Pipeline created** | Net-new qualified opportunities/appointments attributable to Cognitia | Proves value, not vanity | Range-based, per dealer cohort |
| **Lead-to-appointment rate** | Engaged leads → booked appointments | Dealer-native KPI | Track vs. pre-Cognitia baseline (target) |
| **Win rate** | Opportunities → closed (dealer-reported) | Downstream value signal | Directional; dealer attribution caveated |
| **Opt-out / suppression integrity** | % of opt-outs honored universally; audit completeness | Compliance + trust | Target 100% suppression coverage |
| **Onboarding cycle time** | Contract → live | Scalability indicator | Reduce over successive cohorts |

*Instrument before scaling spend. All targets are internal goals, not customer promises.*

---

## Kill / Park / Build Recommendations

### Build (do now)
- Measurement spine (activation, TTFV, pipeline, win rate).
- ICP one-pager + packaged offer.
- Compliance-by-design baseline (consent, opt-out suppression, audit logging).
- Repeatable onboarding playbook + dealer proof dashboard.
- Top 1–2 CRM/DMS integrations by pilot prevalence.

### Park (revisit after Phase 3 / repeatability proven)
- Self-serve onboarding at scale (premature before TTFV is consistent).
- Multi-vertical expansion beyond auto (beachhead unproven).
- Dealer certification/education program (start lightweight; expand only if it drives pipeline).
- RICE-based prioritization (needs funnel volume first).

### Kill (do not pursue now)
- **Horizontal "agent OS" positioning** — crowded, abstract, owned by infra/enterprise-IT players. Stay vertical.
- **Voice/SMS automation as a core wedge** — out of scope, high TCPA liability; do not design it this sprint.
- **ROI/SEO/sales guarantees in any collateral** — replace with target/range framing.
- **"Replace your sales team" messaging** — the 11x credibility trap; use augment + instrument.
- **Bespoke-only enterprise pricing as the default** — test transparent packaging instead.

---

## Scope-Creep Flags

- **SC-1 — "Agent economy / agent OS" vision bleeding into product scope.** Keep it a vision wrapper; the shippable product is the vertical Auto Growth OS. *Flag if eng work targets a horizontal platform before the auto motion is repeatable.*
- **SC-2 — Voice/SMS automation.** Tempting (Kenect/Tecobi do it) but out of scope and TCPA-heavy. *Hard stop this sprint.*
- **SC-3 — Multi-vertical expansion.** Resist until Client Zero auto is provably repeatable.
- **SC-4 — Over-integration.** Don't build every CRM/DMS connector; prioritize the 1–2 the pilots actually use.
- **SC-5 — Dashboard gold-plating.** Ship a proof dashboard, not a BI suite.

---

## Compliance Note

Any improvement touching outreach must respect **CAN-SPAM** (accurate headers, unsubscribe honored), **TCPA** (consent, opt-out, suppression — large and rising dealer liability), and **CASL** (Canadian consent) where applicable. Compliance work here is **process/consent/audit-logging design only** — this document does **not** design voice or SMS automation. Use `[Dealer Name]` / `[Contact]` placeholders in all artifacts; no raw PII; no outreach instructions targeting specific named individuals.
