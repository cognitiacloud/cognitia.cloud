# Advertising Compliance Guardrails — Auto Dealers

**Worker C — Ads + Media House**
**Status:** Research-backed checklist. Guidance, not legal advice. Routes ambiguous calls to founder + counsel.
**Date:** 2026-06-20

> Classification: **VERIFIED** = backed by a cited primary/secondary source (URL below).
> **INFERRED** = reasoned from the cited sources. **RECOMMENDED** = our judgment call.
> **UNSAFE** = touches a hard-stop boundary / needs counsel before going live.
>
> ⚠️ IMPORTANT REGULATORY STATUS (VERIFIED): The FTC's **CARS Rule** (Combating Auto Retail Scams)
> was finalized in Dec 2023 but **vacated by the Fifth Circuit on Jan 27, 2025** for procedural
> defects, and cannot take effect unless the FTC restarts rulemaking. So the CARS Rule's specific
> obligations are **not currently in force** — BUT the underlying **FTC Act (deception/unfairness)**
> and **TILA/Regulation Z** advertising rules **still fully apply**, plus state mini-FTC/dealer-ad
> laws. Treat CARS as a strong "direction of travel" best-practice baseline, not current black-letter law.

---

## A. Core legal framework (VERIFIED)

1. **FTC Act — deception standard (VERIFIED).** Both **express and implied** misrepresentations
   about price, financing, rebates/discounts, vehicle availability, and pre-approval/guarantees are
   prohibited and have been the basis of FTC enforcement against dealers.
   Source: FTC, "FTC Takes Action To Stop Deceptive Car Dealership Ads"; CARS Rule guidance.
2. **Substantiation (VERIFIED).** Dealers must be able to **back up ad claims** about price,
   financing, and savings; the FTC has challenged ads that promised terms the dealer couldn't honor.
   Source: FTC business-guidance on dealer ad claims; FTC enforcement releases.
3. **TILA / Regulation Z — credit advertising (VERIFIED).** If a finance charge is advertised, the
   rate must be stated as an **Annual Percentage Rate / APR**. Dealers arranging financing must
   disclose APR, total finance charge, and total of payments.
   Source: TILA/Reg Z advertising guidance (Consumer Compliance Outlook; Wipfli).

---

## B. TILA / Reg Z trigger terms (VERIFIED — the financing landmine)

**Rule (VERIFIED):** Using a **trigger term** in an ad forces additional disclosures *in close
proximity, clearly and conspicuously*.

**Trigger terms (any of these triggers disclosure):**
- The amount/percentage of any **down payment** (e.g. "5% down," "$2,000 down").
- The **number of payments** or the **repayment period** (e.g. "60 months").
- The **amount of any payment** (e.g. "$199/mo," "under $300 a month").

**Required disclosures once triggered (must appear together, clear & conspicuous):**
1. The **down payment** amount.
2. The **terms of repayment** (example loan amount, term, and payment).
3. The **APR** (and whether the APR may increase after consummation).

**Key nuance (VERIFIED):** Advertising the **APR alone does NOT trigger** the extra disclosures.
INFERRED best practice: prefer **APR-only** or **no-number** creative to avoid the trigger entirely.
Source: Consumer Compliance Outlook (Reg Z advertising); Wipfli (trigger terms); financeband.

---

## C. Checklist — run on every auto ad before GATE 1

| # | Check | Class | Action if fail |
|---|-------|-------|----------------|
| 1 | No "guaranteed approval / everyone approved / guaranteed financing" | **UNSAFE** | Reframe to "on approved credit; apply to see if you qualify." |
| 2 | No "guaranteed APR/rate for everyone" | **UNSAFE** | "Available to qualified buyers on select models." |
| 3 | Any payment / down-payment / term number -> APR + repayment terms shown in close proximity | **VERIFIED rule** | Add disclosure block or remove the number. |
| 4 | Advertised price/units are actually in stock and honored (no bait-and-switch) | **VERIFIED rule** | Only advertise available units. |
| 5 | "Up to $X off / save up to" — top figure genuinely available on a meaningful number of units | **VERIFIED rule** | Qualify: "select vehicles; varies." |
| 6 | Scarcity ("this weekend only") is literally true and the creative is pulled when it ends | INFERRED | No perpetual countdowns. |
| 7 | Rebates/discounts: state eligibility; don't imply universal availability | **VERIFIED rule** | Add "qualified buyers / select models." |
| 8 | Fees/add-ons not misrepresented; total payment context given when monthly payment is discussed | INFERRED (CARS direction) | Disclose total + add-ons. |
| 9 | No real PII in audiences/creative (synthetic only this loop) | GUARDRAILS #8 | Block. |
| 10 | No guaranteed ROI / lead-volume language (internal or external) | GUARDRAILS #9 | Reframe to "estimated." |
| 11 | All required disclosures clear & conspicuous (legible, not buried) | **VERIFIED rule** | Fix placement/contrast. |
| 12 | Lease vs. purchase clearly distinguished | INFERRED (CARS direction) | Label financing type. |

---

## D. "Up to" and savings disclaimers (VERIFIED + RECOMMENDED)

- **VERIFIED:** Savings/discount claims must be substantiated and the advertised price/terms must
  be genuinely available; the FTC has acted where they were not.
- **RECOMMENDED:** For "up to $X," keep evidence that the top number is achievable on a real,
  meaningful set of units. A fine-print disclaimer **cannot cure** a headline that is misleading on
  its face (a long-standing FTC principle — disclaimers clarify, they don't contradict).

---

## E. Platform-layer compliance (INFERRED / RECOMMENDED)

- Meta/Google/TikTok each have their own automotive + financial-services ad policies layered on top
  of the law. INFERRED: a compliant-under-law ad can still be rejected by platform policy; the
  Compliance Agent should carry a platform-policy sub-checklist (design only — no launch this loop).
- **UNSAFE / DO NOT DO YET:** verifying live against any ad platform's policy API.

---

## F. Process controls (RECOMMENDED)

1. Compliance Agent has **block authority**; no agent override (see engine spec §3).
2. Every approved ad's claims + their substantiation are recorded in the **action ledger** (spec §5)
   so any claim can be traced to its evidence — the audit trail the FTC substantiation standard implies.
3. Maintain a **claims register**: claim -> substantiation -> reviewer -> date.
4. **Legal review of all live claims is a prerequisite to GATE 2** (launch) — currently UNSAFE.
5. Re-check state-specific dealer advertising rules (many states have stricter mini-FTC acts).
   INFERRED: state law is the most under-covered risk here and needs local counsel.

---

## G. Biggest landmine (summary)

**INFERRED + VERIFIED basis:** The #1 auto-ad landmine is **financing/payment claims** — stating a
monthly payment or down payment without the required APR + repayment-term disclosures (a TILA/Reg Z
violation), and any "guaranteed approval / guaranteed APR" language (FTC deception). These two cause
the most enforcement exposure and are the easiest for a generative system to produce by accident.
The Compliance Agent must hard-block both.

---

## Sources

- FTC — FTC Takes Action To Stop Deceptive Car Dealership Ads: https://www.ftc.gov/news-events/news/press-releases/2012/03/ftc-takes-action-stop-deceptive-car-dealership-ads
- FTC — CARS Rule: A Dealer's Guide: https://www.ftc.gov/business-guidance/resources/ftc-cars-rule-combating-auto-retail-scams-dealers-guide
- FTC CARS Rule (Federal Register): https://www.federalregister.gov/documents/2024/01/04/2023-27997/combating-auto-retail-scams-trade-regulation-rule
- 5th Circuit vacates CARS Rule (Seyfarth Shaw): https://www.seyfarth.com/news-insights/5th-circuit-vacates-ftc-new-car-dealer-rule.html
- CARS Rule vacated, 2026 update (KGI Dealer Solutions): https://kgidealersolutions.com/help/articles/laws-and-compliance/ftc-cars-rules-2025-update/
- Reg Z advertising requirements (Consumer Compliance Outlook): https://www.consumercomplianceoutlook.org/2021/first-issue/understanding-regulation-zs-advertising-requirements/
- Reg Z trigger terms (Wipfli): https://www.wipfli.com/insights/articles/fi-understand-triggering-terms-to-keep-your-advertising-in-compliance
- TILA/Reg Z trigger terms (financeband): https://financeband.com/what-are-trigger-terms-under-tila-and-regulation-z
- FTC dealer ad pricing warning letters, 2026 (Consumer Finance Monitor): https://www.consumerfinancemonitor.com/2026/04/02/ftc-sends-warning-letters-about-pricing-to-97-auto-groups/
