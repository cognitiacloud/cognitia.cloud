# Meta Ads Readiness Checklist

For `{{DEALER_NAME}}` on Facebook + Instagram. Get assets, identity, tracking,
and creative ready — then stop at the launch gate. **This checklist does not
launch anything and authorizes no spend.**

> **2026 policy headline:** Auto loans and financing fall under Meta's **Credit
> Special Ad Category**. Selecting it (or having it auto-applied) **removes**
> age targeting, ZIP precision (forces a ≥15-mile radius), and most
> interest/behavior audiences, and limits lookalikes to a "Special Ad Audience"
> model. In 2026, Meta's image classifiers can **auto-apply** the Credit
> category from visuals (loan calculators, payment graphics) even if you didn't
> select it. Plan for it from the start.

## 1. Account & asset prerequisites

- [ ] Facebook Page for `{{DEALER_NAME}}` exists and is published.
- [ ] Instagram professional account linked to the Page.
- [ ] **Meta Business Manager** created; Page, ad account, pixel, catalog inside it.
- [ ] Ad account in **USD**, correct time zone; **no budget set / paused** (rule #1).
- [ ] Payment method may exist but no active spend is authorized.
- [ ] Roles assigned (Operator = advertiser access; Reviewer = admin/finance).

## 2. Business & identity verification

- [ ] **Business verification** completed in Business Manager.
- [ ] **Special Ad Category — Credit** acknowledged for any financing-adjacent
      offer; understand the targeting restrictions before building audiences.
- [ ] Page roles and 2FA enforced on admins.
- [ ] Domain (`{{URL}}` root) verified in Business Manager (needed for
      Aggregated Event Measurement).

## 3. Tracking & conversions (consent-safe)

- [ ] Meta Pixel installed on `{{URL}}`; base + event code validated.
- [ ] **Conversions API (CAPI)** configured (server-side), with event
      **deduplication** (same `event_id` browser + server).
- [ ] **Consent consistency:** when the CMP signal is "denied", the server does
      **not** send PII in the CAPI body (see [07](07-landing-page-tracking-plan.md)).
- [ ] Standard events mapped: `ViewContent` (VDP), `Lead`, `Contact` (call),
      `FindLocation` (directions), `Search` (inventory).
- [ ] Aggregated Event Measurement: 8 priority events configured on the
      verified domain.
- [ ] Events validated in Test Events / Events Manager (test mode only).

## 4. Catalog / automotive inventory readiness (optional but recommended)

- [ ] Vehicle catalog/feed created in Commerce/Business Manager.
- [ ] Required fields present (VIN, make/model/year, price-with-fees, mileage,
      condition, images, dealer location).
- [ ] **Price includes all mandatory fees**; matches landing page.
- [ ] Catalog passes diagnostics; no disapproved items.
- [ ] Automotive inventory ads reviewed against Special Ad Category rules if any
      financing message is attached.

## 5. Targeting & audiences (policy-first)

- [ ] If **Credit** category applies: **no** age/gender targeting beyond legal
      minimums; **no** ZIP precision (≥15-mile radius); **no** detailed
      interest/behavior targeting; lookalikes → **Special Ad Audience**.
- [ ] **Consent-based custom audiences only** — build retargeting from
      **explicitly consented, hashed email lists**, not from scraped or
      non-consented data. Document consent source.
- [ ] Instant Form (lead ad) fields **exclude** age, gender, relationship
      status, and location when Credit category applies.
- [ ] No discriminatory exclusions or proxies (cross-check [09](09-what-not-to-claim.md)).

## 6. Creative spec sheet

| Placement | Ratio | Notes |
|-----------|-------|-------|
| Feed (FB/IG) image/video | 1:1 or 4:5 | Primary text ≤125 char recommended |
| Stories / Reels | 9:16 | Safe-zone top/bottom for UI |
| Carousel | 1:1 | Multi-vehicle showcase |
| Headline / Primary text | — | No banned claims (09); disclaimers (08) |

- [ ] Creatives avoid loan-calculator / "guaranteed approval" imagery that would
      auto-trigger Credit category unintentionally — unless intended and handled.
- [ ] All financing claims carry required disclaimers from [08](08-compliance-disclaimers.md).
- [ ] No before/after "credit repair" framing; no income/debt claims.

## 7. Policy eligibility (review before building)

- [ ] Cross-check every claim against [09](09-what-not-to-claim.md).
- [ ] Required disclaimers from [08](08-compliance-disclaimers.md) present.
- [ ] Pricing honest and fee-inclusive; landing-page price matches the ad.
- [ ] Personal-attributes rule: don't imply you know the user's finances
      ("Struggling with bad credit?" → non-compliant framing).

## 8. Pre-flight checklist (final, before the gate)

- [ ] Sections 1–7 complete.
- [ ] Pixel + CAPI validated; consent signals correct in test mode.
- [ ] Special Ad Category status correct for the offer.
- [ ] No campaign published; no budget set.

## DO NOT LAUNCH — human sign-off required

Demandara stops here. A human Reviewer completes the launch gate in
[00-engine-overview.md](00-engine-overview.md), sets the budget, and publishes.
**Demandara does not spend, does not launch.**

```
[ ] Reviewer has run the LAUNCH GATE (00) and signed.
[ ] Special Ad Category set correctly (Credit if financing-adjacent).
[ ] Counsel has signed if any financing claim is present.
[ ] Budget set by a named human: ____________________
```

---

**Sources (verify live before launch):**
[Meta Special Ad Categories](https://www.facebook.com/business/help/298000447747885),
[Meta special ad categories rules](https://www.data-axle.com/resources/blog/meta-special-ad-categories-rules/),
[Meta advertising policies guide 2026](https://bir.ch/blog/what-can-you-advertise-on-meta),
[Meta Consent Mode + CAPI deduplication](https://dev.to/mehwish_malik_4f29ff7fb04/meta-consent-mode-capi-the-deduplication-pattern-that-actually-works-479b).
