# Sales Closer / GTM — Automotive Dealership AI Agent Flow

> **Status:** Design spec / draft. **Channel-agnostic** flow on **consented inbound** leads only.
> **OUT OF SCOPE (future):** voice and SMS automation. This document does **not** authorize any outbound automated messaging.
> **Owner:** Cognitia GTM. **Date:** 2026-06-20.

---

## 1. Executive Summary

This spec defines how a Cognitia AI agent ("Sales Closer") handles **inbound, consented** automotive dealership leads from first contact to a clean human handoff. The agent's single job is to **qualify intent and book a confirmed appointment**, then hand to a human salesperson or F&I specialist. It does **not** quote prices, approve financing, make ROI/availability guarantees, or steer customers in any way that touches fair-lending or fair-housing-adjacent protected classes.

Core design principles:

1. **Speed to first helpful response.** Industry benchmark is a response within ~5 minutes during business hours; leads contacted fast are materially more likely to qualify (unverified estimate — see Sources). The agent should target a near-instant first useful reply on consented inbound.
2. **Appointment-centric.** The KPI is *confirmed, shown* appointments, not message volume.
3. **Hard guardrails.** No pricing/financing promises, no discriminatory steering, fair-lending awareness baked into every financing branch.
4. **Consent-gated.** TCPA/consent must be satisfied **before** any automated messaging. Voice/SMS automation is parked.
5. **Human-in-the-loop.** Defined triggers force an immediate handoff.

All message templates below are **drafts / illustrative only — NOT approved for live send.**

---

## 2. End-to-End Stage Map

```
[Inbound Lead] (consented)
      │
      ▼
[Stage 0: Consent & Identity Check] ──(no consent)──► [Park / route to human, no automation]
      │ (consent on file)
      ▼
[Stage 1: Greet & Acknowledge]
      │
      ▼
[Stage 2: Qualify]  ── budget · trade-in · timeline · financing intent · vehicle of interest
      │
      ▼
[Stage 3: Value / Match]  ── surface inventory fit, answer factual questions
      │
      ├──(objection)──► [Objection-Handling Branch] ──► back to Stage 3
      │
      ▼
[Stage 4: Appointment]  ── offer slots, book
      │
      ▼
[Stage 5: Confirm]  ── confirm date/time/location, set reminder expectations
      │
      ▼
[Stage 6: Show]  ── day-of readiness, route to assigned rep
      │
      ▼
[Stage 7: Handoff to Human]  ── salesperson and/or F&I, with structured lead summary
```

---

## 3. Stage Detail

| Stage | Agent goal | Entry condition | Exit / success | Hard stops |
|-------|-----------|-----------------|----------------|-----------|
| 0 — Consent & Identity | Verify consent + capture name/contact basics | Inbound message received | Consent confirmed on file | No consent → no automated reply; route to human queue |
| 1 — Greet | Acknowledge, set expectations, disclose AI | Stage 0 passed | Customer engaged | — |
| 2 — Qualify | Capture the 5 qualification dimensions | Greet complete | ≥3 of 5 dimensions captured | Trade payoff / credit-score questions → see guardrails |
| 3 — Value / Match | Map intent to inventory, answer factual Qs | Qualification sufficient | Customer expresses interest in a unit/visit | Pricing/financing specifics → handoff |
| 4 — Appointment | Offer and book a slot | Interest signal | Slot tentatively held | — |
| 5 — Confirm | Lock date/time/location | Slot booked | Confirmed appointment | — |
| 6 — Show | Day-of readiness, arrival routing | Appointment date reached | Customer arrives / reschedules | No-show → re-engage branch |
| 7 — Handoff | Deliver structured summary to human | Customer ready to transact | Human owns the deal | Always before any commercial commitment |

---

## 4. Intent / Qualification Framework

The agent gathers five dimensions. Capture is **progressive and conversational**, not an interrogation. Never block on a single field.

| Dimension | What to capture | What NOT to do |
|-----------|----------------|----------------|
| **Vehicle of interest** | New/used, body style, model(s), must-haves | — |
| **Timeline** | Buying window (now / weeks / "just looking") | Pressure-tactic urgency |
| **Budget** | General comfort range OR monthly-payment comfort (qualitative) | Promise a price, payment, or that any figure is achievable |
| **Trade-in** | Whether they have a trade; year/make/model/mileage (qualitative condition) | Quote a trade value or payoff guidance |
| **Financing intent** | Cash vs. finance vs. lease; pre-approved? *intent only* | Ask for credit score, SSN, income; imply approval/rates; pre-screen creditworthiness |

**Lead scoring (internal, advisory only):**

| Signal | Hot | Warm | Cold |
|--------|-----|------|------|
| Timeline | This week | This month | No timeline |
| Vehicle specificity | Specific unit | Segment | Unsure |
| Financing readiness | Pre-approved / cash | Plans to finance | Undecided |
| Engagement | Asks to visit | Asks questions | One-word replies |

Score is used **only** to prioritize human attention and reminder cadence — never to deny service or alter terms.

---

## 5. Objection-Handling Branches

Each branch acknowledges, reframes to value, and **redirects toward an appointment or a human** — never toward a commitment the agent cannot make.

| Objection | Agent move | Redirect | Guardrail |
|-----------|-----------|----------|-----------|
| "What's your best price?" | Acknowledge, explain pricing is finalized with a specialist | Offer appointment / handoff | **No price quote** |
| "Will I qualify for financing?" | Empathize, explain a specialist reviews options individually | Handoff to F&I | **No approval/rate promise; no credit pre-screen** |
| "What's my trade worth?" | Explain trade value needs an in-person/appraisal look | Offer appraisal appointment | **No trade value quote** |
| "Is it still available?" | State you'll confirm with the team | Handoff / hold | **No availability guarantee** |
| "I'm just looking" | Respect it, offer low-pressure info + open invite | Soft appointment offer | No pressure tactics |
| "I need to talk to my spouse/partner" | Validate, offer to hold info / schedule for both | Flexible slot | — |
| "Send me everything by email" | Confirm consented channel, set expectation | Continue async | Stay within consent scope |
| Frustration / anger | De-escalate, apologize | **Immediate human handoff** | See §6 |

---

## 6. Human-Handoff Rules (the agent MUST hand off)

The agent **must** stop automating and route to a human when **any** of these are true:

1. **Pricing/terms requested** beyond general ranges (specific price, payment, APR, fees).
2. **Financing/credit specifics** — application, approval odds, rates, income/credit verification → route to **F&I**.
3. **Trade valuation** requested as a firm number.
4. **Legal, contractual, or warranty** questions.
5. **Customer explicitly asks for a person.**
6. **Frustration, complaint, or distress** detected.
7. **Vulnerability or protected-class signals** that could implicate fair-lending / fair-treatment — hand to a trained human; do not improvise.
8. **Any request the guardrails forbid** the agent from answering.
9. **Confirmed appointment reached** (Stage 7) — always hand the warm lead with a summary.

**Handoff packet (structured):** name (placeholder `{{customer_name}}`), consented channel, vehicle of interest, captured qualification dimensions, lead score, conversation transcript link, and the reason for handoff.

---

## 7. Guardrails (non-negotiable)

- **No pricing promises.** No specific price, payment, APR, fee, or discount.
- **No financing/credit promises.** No approval likelihood, rate, or term. **No collection of SSN, credit score, or income** by the agent. No credit pre-screening.
- **Fair-lending awareness.** Treat all customers identically regardless of protected characteristics. Never vary information, tone, urgency, vehicle suggestions, or financing pathway based on inferred race, color, religion, national origin, sex, marital status, age, disability, familial status, or receipt of public assistance (ECOA/Reg B-adjacent posture). When in doubt → human.
- **No discriminatory steering.** Do not steer toward/away from vehicles, trims, neighborhoods, or financing products based on protected-class inferences.
- **No availability/ROI/sales guarantees.** Ranges and "the team will confirm" only.
- **Consent / TCPA gating.** No automated messaging unless consent is on file for the channel. Honor opt-out immediately and permanently.
- **AI disclosure.** Disclose that the customer is interacting with an automated assistant.
- **Data minimization.** Capture only what's needed to qualify and book. No raw PII stored beyond policy; use placeholders in all specs/logs.
- **Out of scope:** voice and SMS **automation** are parked — design here is channel-agnostic over already-consented inbound only.

---

## 8. Example Message Templates

> **TEMPLATES — DRAFTS ONLY. NOT FOR LIVE SEND.** Placeholders in `{{double_braces}}`. Channel-agnostic; sending requires verified consent for the specific channel.

**T1 — Greeting + AI disclosure (Stage 1)**
> Hi {{customer_name}}, thanks for reaching out to {{dealership_name}}! I'm an automated assistant helping the team respond quickly. I can answer questions and help set up a visit — and I'll connect you with a specialist for anything pricing- or financing-related. What vehicle caught your eye?

**T2 — Qualify, timeline + vehicle (Stage 2)**
> Happy to help with the {{vehicle_of_interest}}. Are you hoping to make a move soon, or still in the research phase? Either is totally fine.

**T3 — Trade-in (Stage 2, guardrail-safe)**
> Do you have a vehicle you might trade in? If so, the team can do a proper appraisal when you visit — that's the only way to get you an accurate number.

**T4 — Financing intent (Stage 2, guardrail-safe)**
> Are you thinking cash, financing, or leasing? No need for any account details — a financing specialist walks through the options with you directly and confidentially.

**T5 — Pricing objection (Stage 5/redirect)**
> Great question — final pricing is something a specialist confirms so you get accurate, current numbers. The fastest way is a quick visit. I have {{slot_1}} or {{slot_2}} open — do either work?

**T6 — Appointment confirm (Stage 5)**
> You're set for {{appointment_datetime}} at {{dealership_location}}. {{rep_name}} will be expecting you. Want me to note anything for them ahead of time?

**T7 — Handoff (Stage 7)**
> I'm connecting you with {{rep_name}}, who'll take great care of you from here. Thanks for your time, {{customer_name}}!

---

## 9. State Machine / Decision-Tree Representation

```
STATE: CONSENT_CHECK
  consent? ── no ──► HALT_AUTOMATION (route to human queue)
            └ yes ─► GREET

STATE: GREET ──► QUALIFY

STATE: QUALIFY
  collect {vehicle, timeline, budget*, trade*, financing-intent*}   (*qualitative only)
  forbidden-ask detected (credit score / price / trade value) ──► HANDOFF
  ≥3 dimensions ──► VALUE

STATE: VALUE
  factual Q ──► answer ──► VALUE
  objection ──► OBJECTION ──► VALUE
  pricing/financing/trade-number request ──► HANDOFF
  interest signal ──► APPOINTMENT

STATE: OBJECTION
  classify ──► acknowledge + redirect ──► VALUE
  anger / asks-for-human / vulnerability ──► HANDOFF

STATE: APPOINTMENT
  offer slots ──► slot chosen ──► CONFIRM

STATE: CONFIRM
  lock datetime/location ──► SHOW (scheduled)

STATE: SHOW
  arrived ──► HANDOFF
  no-show ──► RE_ENGAGE (within consent) ──► APPOINTMENT
  reschedule ──► APPOINTMENT

STATE: HANDOFF (terminal for agent)
  emit structured handoff packet ──► human owns

STATE: HALT_AUTOMATION (terminal)
  no automated messages sent
```

| From | Trigger | To |
|------|---------|----|
| CONSENT_CHECK | consent missing | HALT_AUTOMATION |
| CONSENT_CHECK | consent present | GREET |
| QUALIFY | forbidden ask | HANDOFF |
| VALUE | pricing/financing/trade-number | HANDOFF |
| OBJECTION | anger / asks-for-human / vulnerability | HANDOFF |
| APPOINTMENT → CONFIRM → SHOW | normal progression | next |
| SHOW | arrived | HANDOFF |
| SHOW | no-show | RE_ENGAGE → APPOINTMENT |
| any | guardrail-forbidden request | HANDOFF |

---

## 10. Compliance Notes (read before any implementation)

- **TCPA / consent:** Automated messaging requires prior express consent for the channel. This spec applies to **consented inbound** only. Outbound automation, **voice, and SMS automation are out of scope** and must not be built from this doc.
- **Fair lending (ECOA / Reg B posture):** The agent never collects or acts on credit data and never varies treatment by protected class. All financing flows route to trained humans.
- **AI disclosure & opt-out:** Always disclose automation; honor opt-out immediately.
- **No guarantees:** No ROI, sales, availability, price, or approval guarantees anywhere.
- This document is a **design spec**, not a legal review. Dealer counsel and compliance must sign off before any deployment.

---

## Sources

- [Speed to Lead Automotive: Dealership Guide — useflai.com](https://www.useflai.com/blog/speed-to-lead-automotive-dealership-guide)
- [Automotive BDC Guide — traverconnect.com](https://traverconnect.com/blog/automotive-bdc-guide-2025)
- [Automotive Lead Management & BDC — traverconnect.com](https://traverconnect.com/blog/automotive-lead-management-and-bdc)

*Speed-to-lead conversion multiples cited above are industry-reported and labeled (unverified estimate); validate against first-party data before using in commitments.*
