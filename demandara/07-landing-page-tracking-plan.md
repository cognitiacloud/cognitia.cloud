# Landing Page Tracking Plan

How `{{DEALER_NAME}}` measures traffic and builds **consent-safe** audiences
without violating privacy rules or platform policy. This plan is implementation-
ready but **installs nothing live until the launch gate** — validate in test mode
only ([00](00-engine-overview.md)).

## Principles

- **Consent first.** No marketing tags fire before the CMP records consent where
  consent is required. **Consent Mode v2** is the baseline.
- **No PII in URLs or tags.** Never put email/phone/name in query strings or
  event payloads. Hash on the server for match-based features.
- **Server-side where possible.** Use CAPI / Events API with **deduplication**
  so browser + server events aren't double-counted.
- **Honest pricing.** The landing-page price must equal the ad price, all fees
  included (Google pricing policy; see [01](01-google-ads-readiness.md)).

## Landing page structure (lead / VDP style)

```
┌─ Above the fold ──────────────────────────────┐
│ Vehicle hero image (real VIN photo)           │
│ Year/Make/Model · Mileage · Condition         │
│ Full price (all fees included) · {{CITY}}     │
│ Primary CTA: [Check availability] [Call]      │
├─ Trust row ───────────────────────────────────┤
│ Reviews · inspection badge · "no-pressure"    │
├─ Details ─────────────────────────────────────┤
│ Features · gallery · specs                    │
├─ Lead form ───────────────────────────────────┤
│ Name · email · phone (+ consent checkbox)     │
├─ Footer ──────────────────────────────────────┤
│ Disclaimers (08) · privacy · directions       │
└───────────────────────────────────────────────┘
```

- Mobile-first, fast (LCP < 2.5s), one primary CTA.
- Consent checkbox + privacy link adjacent to the form.
- Disclaimers from [08](08-compliance-disclaimers.md) legible, not buried.

## Event taxonomy

| Event | Trigger | Key params (no PII) |
|-------|---------|---------------------|
| `page_view` | Page load (post-consent) | page_path, vehicle_id |
| `view_inventory` | Inventory/list view | list_id |
| `view_vehicle` | VDP / landing view | vehicle_id, condition |
| `lead_start` | Form field focus | form_id |
| `lead_submit` | Form submit success | form_id, vehicle_id |
| `call_click` | Tap tracked `{{PHONE}}` | source |
| `directions_click` | Map/directions click | location_id |
| `chat_open` | Chat widget open | — |
| `cta_click` | Any primary CTA | cta_label |

Keep names consistent across GA4, Google Ads, Meta, and TikTok so the mapping
table below stays clean.

## UTM convention

```
?utm_source={platform}&utm_medium={paid|organic|gbp}
 &utm_campaign={offer-city-month}&utm_content={creative-id}&utm_term={audience-theme}
```

Examples:
- Google VLA: `utm_source=google&utm_medium=paid&utm_campaign=new-arrivals-springfield-2026-07`
- TikTok reel: `utm_source=tiktok&utm_medium=paid&utm_content=walkaround-001`
- GBP post: `utm_source=gbp&utm_medium=gbp&utm_campaign=summer-event`

Never include PII in any UTM value.

## Platform event mapping

| Demandara event | GA4 | Google Ads | Meta | TikTok |
|-----------------|-----|-----------|------|--------|
| `view_vehicle` | `view_item` | (signal) | `ViewContent` | `ViewContent` |
| `lead_submit` | `generate_lead` | Conversion: Lead | `Lead` | `SubmitForm` |
| `call_click` | `select_content` | Conversion: Call | `Contact` | `Contact` |
| `directions_click` | `select_content` | (store visit signal) | `FindLocation` | `ClickButton` |
| `cta_click` | `select_content` | — | `Search`/custom | `ClickButton` |

## Consent-safe retargeting design

- **CMP** (consent management platform) gates all marketing tags; default state
  **denied** until the user consents.
- **Google Consent Mode v2:** pass `ad_storage`, `analytics_storage`,
  `ad_user_data`, `ad_personalization`. `ad_personalization=denied` ⇒ user is
  **excluded** from remarketing — by design.
- **Meta:** Pixel + CAPI with the **same `event_id`** for dedup. When consent is
  denied, the server must **not** send PII in the CAPI body (consent consistency).
- **TikTok:** Pixel/Events API respect the same consent signal; hashed Advanced
  Matching only with consent.
- **Custom audiences:** build retargeting from **explicitly consented, hashed
  email lists**, not scraped or non-consented data. Document the consent source
  and date.
- **No special-category proxies:** never build or exclude audiences in a way that
  targets protected classes (cross-check [09](09-what-not-to-claim.md);
  Meta Credit category rules in [02](02-meta-ads-readiness.md)).

## Tag/tech stack (reference)

| Layer | Tool (example) | Role |
|-------|---------------|------|
| CMP | Consent banner / CMP | Capture + broadcast consent |
| Container | Google Tag Manager (web + server) | Fire tags, route server-side |
| Analytics | GA4 | Source of truth for events |
| Google | Google tag + Enhanced Conversions (hashed) | Ads conversions |
| Meta | Pixel + CAPI (deduped) | Meta conversions/audiences |
| TikTok | Pixel + Events API | TikTok conversions |

## QA / validation steps (test mode only)

- [ ] CMP: with consent **denied**, no marketing tags fire; with **granted**,
      they do.
- [ ] GA4 DebugView shows each event once with correct params, **no PII**.
- [ ] Google Tag Assistant: Consent Mode v2 signals present and correct.
- [ ] Meta Test Events: browser + server events **deduplicate** (one count).
- [ ] TikTok Events Manager test: events fire, hashed matching only on consent.
- [ ] UTMs land correctly in GA4 acquisition reports.
- [ ] Landing-page price == ad price, all fees included.
- [ ] No `lead_submit` stores PII in the dataLayer or URL.

## DO NOT GO LIVE — human sign-off required

Tracking is validated in **test mode** only. Production tags go live with the
campaign, after the Reviewer signs the launch gate in
[00-engine-overview.md](00-engine-overview.md). Demandara does not flip
production tracking on by itself.

---

**Sources (verify live before launch):**
[Consent Mode v2 in 2026](https://www.globalreach.com/global-reach-media/blog/2026/01/12/consent-mode-v2-explained),
[Meta Consent Mode + CAPI deduplication](https://dev.to/mehwish_malik_4f29ff7fb04/meta-consent-mode-capi-the-deduplication-pattern-that-actually-works-479b).
