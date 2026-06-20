# Google Ads Readiness Checklist

For `{{DEALER_NAME}}`, a US mixed-inventory dealership. Get the account, feeds,
tracking, and creative ready — then stop at the launch gate. **This checklist
does not launch anything and authorizes no spend.**

> **2026 policy headline:** Google's *Dishonest Pricing Practices* policy (in
> force since Oct 28, 2025) requires the **advertised price to be the real
> price** — no hidden doc, prep, shipping, or "market adjustment" fees revealed
> later. Build every price-bearing ad and landing page around this.

## 1. Account & access prerequisites

- [ ] Google Ads account created (or access granted) under `{{DEALER_NAME}}`.
- [ ] Account in **USD**, correct time zone, correct billing country.
- [ ] Billing profile exists but **no budget set / campaigns paused** (hard rule #1).
- [ ] Google Merchant Center account created for vehicle feeds.
- [ ] Admin + standard user roles assigned; Operator has the access needed.
- [ ] Linked: Google Ads ⇄ Merchant Center, Google Ads ⇄ GA4, Google Ads ⇄
      Google Business Profile (for location assets / local).

## 2. Business & identity verification

- [ ] **Advertiser identity verification** completed (required to run ads).
- [ ] Brick-and-mortar location verified — Google Vehicle Ads require a physical
      location customers can visit in the state the vehicles are listed.
- [ ] One state per Merchant Center account (vehicle ads list a single state).
- [ ] Business name/contact consistent across Ads, Merchant Center, and GBP.

## 3. Tracking & conversions (no PII, consent-aware)

- [ ] Google Tag (gtag) / Google Tag Manager installed on `{{URL}}`.
- [ ] **Consent Mode v2** configured via the CMP (see [07](07-landing-page-tracking-plan.md)).
- [ ] GA4 property linked; key events imported as conversions.
- [ ] Conversion actions defined: `lead_submit`, `call_click`,
      `directions_click`, `inventory_view`, `offsite_call` (call extensions).
- [ ] Enhanced Conversions configured to send **only hashed**, consented data.
- [ ] Conversion tracking validated in Tag Assistant / DebugView (test mode).

## 4. Vehicle feed (VLA) readiness

- [ ] Vehicle feed built with required fields: VIN, make, model, year, price,
      mileage, condition, dealer name, location, image link.
- [ ] **Full price including all mandatory fees** in the feed (pricing policy).
- [ ] Every VIN is genuinely available for sale at `{{DEALER_NAME}}`.
- [ ] Images meet spec (no excessive overlays/watermarks, real vehicle photos).
- [ ] Feed passes Merchant Center diagnostics with **zero disapprovals**.

## 5. Policy eligibility (review before building)

- [ ] **Pricing:** advertised price = real price; all fees included; no
      bait pricing. Landing page price matches ad price.
- [ ] **Financial products & services:** any financing/credit messaging complies
      with state + local regulations for every targeted location. Do your own
      research per locale. Route financing copy to Counsel.
- [ ] **No prohibited claims** — cross-check [09](09-what-not-to-claim.md)
      (no "guaranteed approval", no unqualified "$0 down", etc.).
- [ ] **Required disclaimers** present per [08](08-compliance-disclaimers.md)
      (plus tax/title/license/fees, OAC, financing examples with Reg Z terms).
- [ ] Trademark usage (OEM/brand names) within Google's trademark policy.

## 6. Creative spec sheet

| Asset | Spec | Notes |
|-------|------|-------|
| Responsive Search Ads | 15 headlines (30 char), 4 descriptions (90 char) | No "!", no all-caps, no banned claims |
| Sitelinks / callouts | 25 char / 25 char | Hours, directions, inventory, service |
| Call extension | Tracked `{{PHONE}}` | Forwarding number for call conversions |
| Image / VLA assets | Real VIN photos | Match feed; no misleading overlays |
| Location assets | Linked GBP | Drives store-visit + directions |

## 7. Google Business Profile / local SEO (do this regardless of paid)

- [ ] GBP claimed & verified for `{{DEALER_NAME}}` at the `{{CITY}}` location.
- [ ] Categories set (Car Dealer + relevant secondary), hours, service area.
- [ ] NAP (name/address/phone) consistent with website + citations.
- [ ] Photos current; weekly fresh photos planned (see [04](04-content-calendar.md)).
- [ ] Q&A seeded; review-response SOP in place (respond within 24–48h).
- [ ] GBP Posts cadence scheduled (offers/events) — no financing promises.
- [ ] UTM-tagged website link on GBP (see [07](07-landing-page-tracking-plan.md)).

## 8. Pre-flight checklist (final, before the gate)

- [ ] All of sections 1–7 complete.
- [ ] Landing page live, fast, mobile-friendly, price-accurate, tracking validated.
- [ ] Disclaimers present and legible on ad + landing page.
- [ ] No campaign is enabled; no budget is set.

## DO NOT LAUNCH — human sign-off required

Demandara stops here. A human Reviewer must complete the launch gate in
[00-engine-overview.md](00-engine-overview.md), set the budget, and enable the
campaign. **Demandara does not spend, does not launch.**

```
[ ] Reviewer has run the LAUNCH GATE (00) and signed.
[ ] Counsel has signed if any financing claim is present.
[ ] Budget set by a named human: ____________________
```

---

**Sources (verify live before launch):**
[Vehicle ads policies — Google Ads Help](https://support.google.com/google-ads/answer/11544533),
[Financial products and services — Google Advertising Policies](https://support.google.com/adspolicy/answer/2464998),
[Google's dishonest-pricing rule for car dealers (Oct 28, 2025)](https://www.dealereprocess.com/blog-googles-new-ad-rule-the-end-of-hidden-fees-for-car-dealers-starting-october-28-2025/),
[Google Vehicle Ads setup for dealers 2026](https://almcorp.com/blog/google-vehicle-ads-standard-shopping-campaigns/).
