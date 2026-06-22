# Client Zero Pilot Offer — Proof-Governed Lead-to-Appointment

> **Status:** Internal + dealer-facing pilot definition. Illustrative offer
> terms; not a contract. Final scope, integrations, and deliverables are set
> in the signed pilot agreement.
>
> **No guaranteed outcomes.** This pilot sells a *governed operating model and
> a proof-reporting cadence*, not a promise of leads, sales, or rankings.

## Who's who

- **Demandara** — the go-to-market / operator brand. This is what the dealer
  buys: the **Sales Closer**, a proof-governed lead-to-appointment workflow.
- **Cognitia** — the trust / proof / control layer underneath: the consent
  gate, the human-approval gate, and the proof records that make every action
  reviewable.
- **Hermes Vision** — an **optional** content/QC and privacy-scan add-on, not
  the core offer.

"**Client Zero**" is our internal working label for the first paid pilot
dealership. It does not refer to any named, confirmed, or referenceable client.

## Overview

The pilot is a **90-day** engagement with a **single Canadian dealership** to
run an inbound lead through a controlled path to a booked appointment — with a
consent check, a human sign-off, and a proof record at each step — and to
deliver a **monthly proof report** summarizing what ran and how it was
governed.

Suggested phasing:

| Phase | Days | Focus |
|-------|------|-------|
| 1 | 0–30 | Setup, baseline, demo workflow (sandbox appointment/CRM writeback) |
| 2 | 31–60 | Operating cadence under consent + human-approval gates |
| 3 | 61–90 | Proof report, review, renew/expand decision |

## The core workflow (Demandara Sales Closer)

The primary offer is lead-to-appointment, in this order:

1. **Lead intake / lead handling** — capture an inbound lead and prepare a
   structured follow-up.
2. **Compliance / consent gate (Cognitia)** — check consent status before any
   outbound message; CASL-triggering messages are blocked until consent and
   sign-off are confirmed.
3. **Human approval** — a person reviews and approves the proposed action
   before anything is sent or written.
4. **Appointment / CRM writeback** —
   - **Sandbox writeback is used for the demo** (`budget_wheels_demo` /
     Tenant Zero), so the dealer can see the end-to-end flow without touching
     live data.
   - **Live CRM / customer writes require written dealer authorization and an
     explicitly scoped integration.** Sandbox/mock writeback is a demo, not a
     live client deliverable.
5. **Proof record** — each step produces a record of what happened and who
   approved it. During the pilot this is the **proof-governed operating model**
   and a **sandbox/demo proof workflow** — not a claim of a finished production
   proof backend. The exact per-action receipt depth is finalized in the signed
   pilot scope.
6. **Monthly proof report** — the recurring deliverable: what ran, what was
   gated, approval coverage, and outcomes *measured* over the period.

## What the client gets

- An operating lead-to-appointment workflow run under the consent and
  human-approval gates.
- A **sandbox/demo proof workflow** showing the governed path end to end.
- A **monthly proof report** (the headline recurring deliverable).
- *Optional add-on:* AI social / short-form / video content with
  **human-reviewed QC** and a **privacy/PII scan** (Hermes Vision). Optional and
  supporting only — not the core of the pilot.

## What is excluded

- **Paid ads.** Ad management and ad spend are **out of scope**. If ads are
  added later by separate written agreement, **ad spend is paid directly by the
  dealer and is never fronted by Cognitia.**
- **Live CRM / customer-data writes** until written authorization + a scoped
  integration are in place.
- **Live customer outreach** without written authorization and consent.
- CRM/website rebuilds, inventory-feed integrations, and anything not listed.
- Any **guarantee of leads, sales, or rankings**.

## Pilot scope & cadence

- Single dealership, 90 days, month-to-month within the pilot.
- Fixed lead-handling volume and a defined reporting cadence (set in the signed
  scope).
- For the optional content add-on: a fixed monthly volume and a capped number
  of revision rounds.
- Defined approval flow and communication cadence with the dealer's point of
  contact.

## Success metrics

Metrics we own and report (process / governance):

- Workflow runs completed.
- Consent-gate pass rate.
- Human-approval coverage (share of actions approved before send/write).
- Proof records issued.
- Monthly proof report delivered on time.

Any engagement or appointment numbers are **measured and reported, not
promised**. There are **no guaranteed outcomes**.

## Pricing (CAD)

Three tiers; taxes (GST/HST) are client-side. Full economics in
[`unit-economics-model.md`](./unit-economics-model.md).

| Tier | Monthly (CAD) |
|------|---------------|
| Starter Pilot | $500–$750 |
| **Recommended Pilot** | **$1,000–$1,500** |
| Managed Growth Pilot | $1,500–$2,500 |

**Default first offer presented: CAD $1,000/mo for 90 days** (Recommended
Pilot entry point).

## Commercial terms

- Month-to-month within the 90-day pilot; cancellation per the signed agreement.
- The dealer owns its published accounts, CRM, and customer data.
- Dealer-provided assets remain the dealer's; deliverables transfer per the
  agreement.

## Compliance note

Compliance items are an **internal readiness checklist, not legal advice.**
Founder/counsel sign-off is required before live outreach, CASL-triggering
messages, live CRM writes, ad launches, or any real customer-data handling. See
the checklist in [`dealer-discovery-script.md`](./dealer-discovery-script.md).
