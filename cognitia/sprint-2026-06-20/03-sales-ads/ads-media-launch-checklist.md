# Ads / Media Engine — Launch Readiness Checklist (Paid Social + Search, Dealerships)

> **Status: READINESS ONLY. DO NOT LAUNCH.** This is a pre-launch gate checklist, not a go-live order.
> **Scope:** Paid social (Meta) + paid search (Google) for automotive dealerships.
> **Owner:** Cognitia Ads/Media. **Date:** 2026-06-20.

---

## 1. Executive Summary

This checklist gates whether the ads/media engine is *ready* to launch — it does **not** launch anything. Every metric below is a **TARGET or RANGE**, never a guarantee. The two highest-risk areas for dealership advertising are: (1) **platform special-ad-category / discrimination policy** (vehicle financing ads can pull credit/financial-services restrictions on Meta, and personalized-ads limits apply), and (2) **consent + tracking integrity** (pixel/CAPI must respect consent, and Meta blocks pixel/CAPI on domains implying special-category data).

**Brutal readiness flags up front:**

- 🔴 **NOT READY** until tracking + consent banner are verified end-to-end (no consent = no tracking = invalid measurement and policy exposure).
- 🔴 **NOT READY** until special-ad-category classification is decided per campaign (financing creatives likely trigger restrictions).
- 🔴 **NOT READY** until landing pages, privacy policy, and creative legal approval exist.
- 🔴 **NOT READY** until kill-switch and spend caps are configured and tested.
- 🟡 Measurement plan defines targets only; no ROAS/CAC commitments may be made externally.

---

## 2. Pre-Launch Readiness Gates

| # | Gate | Ready? | Blocking notes |
|---|------|--------|----------------|
| 2.1 | **Tracking — pixels installed & firing** (Meta Pixel, Google tag) | ☐ | Verify in test mode; no PII in event params. |
| 2.2 | **Server-side / CAPI** (Meta Conversions API, Google enhanced conversions) | ☐ | Dedupe with browser events; hash any identifiers; **respect consent**. |
| 2.3 | **Consent banner / CMP** live, blocks tags pre-consent | ☐ | 🔴 Hard gate. Tags must not fire before consent. |
| 2.4 | **Consent → tracking wiring** verified (consent mode v2 / signals) | ☐ | Confirm denied-consent path drops/anonymizes. |
| 2.5 | **Landing pages** built, fast, mobile-first, form working | ☐ | Lead form must capture consent + disclosure. |
| 2.6 | **Privacy policy + terms** linked on every LP and ad destination | ☐ | Required by platform policy. |
| 2.7 | **Creative approval** — legal/brand sign-off on copy & assets | ☐ | Includes disclaimers (see §4). |
| 2.8 | **Budget guardrails** — daily/lifetime caps set per campaign | ☐ | See §6 kill-switch. |
| 2.9 | **Attribution model** chosen & documented | ☐ | Define windows; note platform-reported ≠ truth. |
| 2.10 | **UTM / naming convention** standardized | ☐ | For clean reporting and audit. |
| 2.11 | **Lead routing** into CRM/BDC tested end-to-end | ☐ | Ties to Sales Closer flow (consented inbound). |
| 2.12 | **Account access & 2FA** on all ad/business accounts | ☐ | Business Manager roles least-privilege. |

---

## 3. Platform-Policy Compliance

### 3.1 Meta

| Item | Ready? | Notes |
|------|--------|-------|
| **Special Ad Category review** | ☐ | 🔴 Vehicle **financing/credit** offers can fall under the **Financial Products & Services / Credit** special category (expanded Oct 2024). If so: **no ZIP targeting, no age/gender targeting, no Lookalikes, no Special Ad Audiences.** |
| Self-identify category at campaign creation | ☐ | Required for US-targeted ads where applicable. |
| **No prohibited targeting** | ☐ | No targeting/exclusion by protected classes or proxies. |
| Pixel/CAPI domain check | ☐ | 🔴 Meta blocks pixel/CAPI on domains implying special-category data (effective Jan 2025). |
| Personal-attribute policy | ☐ | No "you" assumptions about protected attributes in copy. |
| Business verification complete | ☐ | — |

### 3.2 Google

| Item | Ready? | Notes |
|------|--------|-------|
| **Personalized-ads / sensitive-category** review | ☐ | Credit/financing can trigger restricted targeting; review eligibility. |
| Vehicle ads / business data feeds compliant | ☐ | If using vehicle ads, feed policy + verification. |
| **No prohibited targeting** | ☐ | No targeting on sensitive categories. |
| Misrepresentation / clickbait policy | ☐ | Claims must be substantiated. |
| Required disclosures present | ☐ | Financing/lease terms disclaimers. |
| Account-level policy / verification | ☐ | Advertiser identity verification. |

### 3.3 Cross-Platform Fair-Lending / Anti-Discrimination

- ☐ No audience definition, exclusion, or creative that steers by race, color, religion, national origin, sex, marital status, age, disability, familial status, or public-assistance status — or proxies (ZIP as race proxy, etc.).
- ☐ Financing creatives reviewed against ECOA/Reg B-adjacent and platform discrimination rules.

---

## 4. Creative QC Checklist

| Item | Ready? |
|------|--------|
| 4.1 No price/payment/APR shown without required disclaimers & accuracy | ☐ |
| 4.2 No "guaranteed approval / guaranteed savings / guaranteed ROI" claims | ☐ |
| 4.3 Financing/lease claims include legally required terms | ☐ |
| 4.4 No protected-class targeting language or imagery steering | ☐ |
| 4.5 Inventory/availability claims are current and qualified ("while supplies last") | ☐ |
| 4.6 Logos/trademarks/vehicle imagery licensed/approved | ☐ |
| 4.7 Alt text, aspect ratios, and platform spec compliance | ☐ |
| 4.8 Landing page matches ad promise (no bait-and-switch) | ☐ |
| 4.9 CTA routes to consented lead capture | ☐ |
| 4.10 Accessibility (contrast, captions on video) | ☐ |

---

## 5. Measurement Plan — TARGETS ONLY (no guarantees)

> All figures are **targets / ranges (unverified estimate)** to be validated against first-party data. **No ROAS, CAC, or sales outcome may be guaranteed** internally or externally.

| Metric | Definition | Target type |
|--------|-----------|-------------|
| **CPL** (cost per lead) | Spend ÷ raw leads | Range target, set per market after baseline |
| **CAC** (cost per acquisition) | Spend ÷ sold units attributable | Directional target only |
| **Lead quality** | % leads meeting BDC qualification (valid contact + intent) | Target % band |
| **Appointment set / show rate** | Booked & shown ÷ leads | Target band |
| **ROAS** | Attributed value ÷ spend | **Target only — never guaranteed** |
| **CTR / CVR** | Engagement & landing-page conversion | Diagnostic |

- ☐ Baseline period defined before any target is treated as a commitment.
- ☐ Attribution caveat documented: platform-reported metrics overstate; reconcile with CRM/sold data.
- ☐ Lead-quality feedback loop from BDC → media defined.

---

## 6. Kill-Switch / Spend-Cap Protocol

| Control | Setting | Ready? |
|---------|---------|--------|
| 6.1 Daily spend cap per campaign | Hard cap configured | ☐ |
| 6.2 Account-level spend cap | Monthly ceiling | ☐ |
| 6.3 **Manual kill-switch** | One owner can pause all campaigns in <5 min | ☐ |
| 6.4 Auto-pause triggers | CPL > threshold, CVR < floor, policy disapproval, broken LP/form | ☐ |
| 6.5 Tracking-failure trigger | Pixel/CAPI stops firing → auto-pause | ☐ |
| 6.6 Anomaly alerting | Spend spike / zero-conversion alerts | ☐ |
| 6.7 Escalation + on-call owner | Named owner + backup | ☐ |
| 6.8 Rollback / pause runbook | Documented, tested in dry run | ☐ |

---

## 7. "DO NOT LAUNCH UNTIL" — Hard Gate List

Launch is **blocked** until **every** item below is ✅:

1. ☐ Consent banner/CMP live and tags verified to **not** fire pre-consent.
2. ☐ Pixel + CAPI/enhanced conversions firing correctly, **no PII** in payloads, consent-respecting.
3. ☐ Special-ad-category classification decided per campaign; restricted-targeting rules applied where triggered.
4. ☐ No prohibited/protected-class targeting (or proxies) in any audience.
5. ☐ Landing pages live, fast, mobile-first, with working consented lead form + privacy policy.
6. ☐ Creative legal/brand approval complete; all disclaimers present; no guarantee claims.
7. ☐ Budget caps + kill-switch + auto-pause triggers configured **and** dry-run tested.
8. ☐ Lead routing into CRM/BDC verified end-to-end.
9. ☐ Measurement baseline + attribution caveats documented (targets only).
10. ☐ Account security (2FA, least-privilege) confirmed.
11. ☐ Dealer counsel / compliance sign-off on file.

> If any box is unchecked: **DO NOT LAUNCH.**

---

## 8. Brutal Readiness Assessment (current)

| Area | Status | Flag |
|------|--------|------|
| Tracking / CAPI | Not verified | 🔴 NOT READY |
| Consent banner / CMP | Not confirmed live | 🔴 NOT READY |
| Special-ad-category decision | Undecided | 🔴 NOT READY (financing ads likely restricted) |
| Landing pages + privacy policy | Not confirmed | 🔴 NOT READY |
| Creative legal approval | Not done | 🔴 NOT READY |
| Kill-switch + spend caps | Not configured/tested | 🔴 NOT READY |
| Measurement plan | Drafted (targets only) | 🟡 PARTIAL |
| Fair-lending / anti-discrimination review | Not signed off | 🔴 NOT READY |

**Overall: 🔴 NOT READY TO LAUNCH.** Treat all green only after independent verification.

---

## Sources

- [Meta Special Ad Categories rules 2025 — data-axle.com](https://www.data-axle.com/resources/blog/meta-special-ad-categories-rules/)
- [Meta Ads Policy 2025 compliance checklist — adamigo.ai](https://www.adamigo.ai/blog/meta-ads-policy-2025-checklist-for-compliance)
- [Meta Advertising Policies Explained 2025 — inbeat.co](https://www.inbeat.co/articles/meta-advertising-policies/)

*Targeting-restriction and Jan-2025 pixel/CAPI domain-blocking details are platform-reported and labeled (unverified estimate); confirm against current Meta/Google official policy before any launch decision.*
