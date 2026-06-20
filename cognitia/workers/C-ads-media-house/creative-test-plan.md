# Creative Test Plan — Auto Dealership (Synthetic Offer)

**Worker C — Ads + Media House**
**Status:** TEST DESIGNS ONLY. None of these launch. No paid spend, no real audiences, no real PII.
**Date:** 2026-06-20

> Synthetic offer used throughout: **"Certified Pre-Owned (CPO) Event"** at a fictional dealership
> ("Sample Auto Group" — not a real brand). All numbers are placeholders.

---

## 1. Objective & framing

Design a structured creative-testing framework that *could* be run if/when launch is authorized
(GATE 2, currently UNSAFE). The deliverable is the **experiment design**, not results.

Primary objective: maximize qualified test-drive bookings per impression for a CPO event, **without
any guaranteed-volume or guaranteed-ROI claims** (GUARDRAILS boundary #9).

---

## 2. Hypothesis Matrix (Hook × Audience × Format)

Each cell = one testable variant. Run as a fractional design (don't test all 27 at once; start with
a screening round, then a confirmation round).

### Axes

**Hooks (the creative angle):**
- H1 — *Inspection/trust*: "Every CPO unit passes a multi-point inspection." (verifiable claim)
- H2 — *Event scarcity*: "CPO event this weekend only." (time-bound, must be true)
- H3 — *Payment framing*: "See estimated monthly payments before you visit." (TILA-sensitive — see §5)

**Audiences (hypotheses, no real PII; modeled segments only):**
- A1 — In-market used-vehicle shoppers (interest/behavior modeled, synthetic)
- A2 — Existing-owner lookalike (modeled, synthetic — no customer list uploaded this loop)
- A3 — Lease-end / upgrade window (modeled, synthetic)

**Formats:**
- F1 — Short-form vertical video (9:16, <15s)
- F2 — Static single image
- F3 — Carousel (inventory highlights)

### Matrix (screening round — pick the diagonal + key cross-cells)

| Variant | Hook | Audience | Format | Hypothesis |
|---------|------|----------|--------|------------|
| V1 | H1 | A1 | F1 | Trust hook + in-market + video drives the most bookings |
| V2 | H2 | A1 | F2 | Scarcity + in-market + static is cheapest qualified booking |
| V3 | H3 | A3 | F1 | Payment framing resonates with lease-end audience |
| V4 | H1 | A2 | F3 | Trust + lookalike + carousel inventory browsing |
| V5 | H2 | A3 | F1 | Scarcity + lease-end urgency |
| V6 | H3 | A1 | F2 | Payment framing for broad in-market |

INFERRED: A full factorial (3×3×3=27) wastes budget; a screening round of ~6 cells then a
confirmation round on the top 2 hooks is the RECOMMENDED structure.

---

## 3. Success metrics

| Tier | Metric | Why |
|------|--------|-----|
| Primary | Qualified test-drive bookings / 1k impressions | Closest leading indicator to revenue |
| Primary | Cost per qualified booking (sandbox $) | Efficiency; SANDBOX figures only |
| Secondary | Hook-rate (3s video views / impressions) | Isolates hook strength |
| Secondary | Landing-page form-start rate | Isolates offer/landing clarity |
| Guardrail | Disclosure-view / completion | Ensures required disclosures are actually seen |
| Guardrail | Complaint/negative-feedback rate | Early signal of deceptive perception |

**Decision rule (RECOMMENDED):** Promote a variant only if it beats control on the primary metric
*and* does not regress the guardrail metrics. No variant is promoted on click-rate alone (clicks
reward clickbait/deceptive hooks).

---

## 4. Statistical design (RECOMMENDED)

- Pre-register hypotheses and the primary metric **before** any data (avoid HARKing).
- One control (a known-baseline creative) per round.
- Fixed minimum sample / pre-set runtime to avoid peeking bias; no early stopping on noise.
- Hold audiences mutually exclusive where possible to avoid cross-contamination.
- Report effect size + uncertainty interval — **never** report a point estimate as a guarantee.

---

## 5. Guardrails against deceptive claims (HARD)

These are binding on the test design itself — a variant that needs a non-compliant claim to "win"
is disqualified, not optimized.

- **No guaranteed ROI / lead-volume language** anywhere — internal or external. (Boundary #9.)
  - UNSAFE: "Guaranteed X bookings." / "Guaranteed APR." / "Guaranteed approval."
  - Compliant: "Estimated," "see if you qualify," "subject to credit approval."
- **Payment/financing hooks (H3) trigger TILA/Reg Z disclosures.** If a variant states a down
  payment, payment amount, number of payments, or repayment term, it MUST show APR + terms of
  repayment in close proximity. See `compliance-guardrails.md` §Trigger-terms.
- **Scarcity (H2) must be literally true** — if "this weekend only," the event must actually end.
  A perpetual "ends soon" countdown is a deceptive-urgency landmine.
- **"Up to" savings** require the offer to be genuinely available and substantiated; a meaningful
  number of units must actually be at that price. See compliance file.
- **No bait-and-switch inventory** — advertised CPO units at a price must be available.
- **No real PII** in audience construction this loop — all segments are synthetic/modeled.

---

## 6. What this loop does NOT do

- Does not launch (GATE 2 / boundary #5 = UNSAFE).
- Does not upload customer lists or build real lookalikes from real PII (boundary #8).
- Does not spend real money (boundary #2/#5).
- Does not promise the founder a booking number (boundary #9).
- Measurement uses synthetic data only until launch is separately authorized.
