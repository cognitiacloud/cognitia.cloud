# Pricing & Packages — Auto Growth OS

Three tiers, one system. Every tier is the same Auto Growth OS; what changes is how
much we automate, how many channels we wire, and how deep the optimization goes.
Pricing is USD and shown as a template anchor — the Discovery Console recommends a
tier from the dealership's config, and the final number is confirmed at proposal.

> Guardrails: prices below are **service fees for work delivered**, not financing,
> not a promise of return. No guaranteed sales, rankings, ROI, or lead counts. Any
> customer-facing finance/trade-in number is `[REQUIRES HUMAN APPROVAL]`. See
> `../internal/guardrails.md`.

---

## The three tiers

|                          | **Launch**                                 | **Growth** ★ most pick this                | **Scale**                                    |
| ------------------------ | ------------------------------------------ | ------------------------------------------ | -------------------------------------------- |
| Best for                 | Small lot, getting online + responsive     | Established dealer ready to convert harder | Multi-rooftop / high-volume operation        |
| One-time setup           | **$2,500**                                 | **$5,000**                                 | **$9,000**                                   |
| Monthly                  | **$750/mo**                                | **$1,500/mo**                              | **$3,000/mo**                                |
| Website                  | Core build (Home, Inventory, VDP, Contact) | Full build + Finance*/Trade-in*/Locations  | Full build + CRO program + A/B testing       |
| Inventory automation     | Basic (assisted publish)                   | Standard (sheet/feed sync, multi-channel)  | Advanced (DMS feed, full multi-channel sync) |
| Photo QC (Hermes vision) | Included                                   | Included                                   | Included                                     |
| Intake channels          | 2 channels, one inbox                      | Up to 4 channels, one inbox                | All channels in `lead_channels[]`            |
| AI Sales Closer          | After-hours auto-response                  | 24/7, qualify + book test drives           | 24/7 multi-channel + bilingual               |
| CRM-lite                 | Pipeline + capture                         | + automations, SLA timers, follow-up       | + lost-lead re-engagement, attribution depth |
| SEO / AEO / GEO          | Foundation (core pages + schema)           | Make/model/location pages + AEO            | Full SEO/AEO/GEO program + entities          |
| Proof reporting          | Monthly dashboard                          | Monthly review call + dashboard            | Bi-weekly review + case-study build          |
| Target first win         | ≤ 30 days                                  | ≤ 30 days                                  | ≤ 30 days                                    |

`*` Finance and Trade-in pages/flows are collection-and-handoff and go live only
after the named approver signs off — `[REQUIRES HUMAN APPROVAL]`.

## What "setup" vs "monthly" means

- **One-time setup** covers the build: website, inventory automation, channel
  wiring, CRM-lite configuration, AI Sales Closer setup, and the initial SEO/AEO
  foundation. Delivered over the first 30–60 days.
- **Monthly** covers the system running: hosting + tooling, AI Sales Closer
  operation, ongoing content/SEO work, optimization, and the reporting cadence.
  It is a service retainer, not a software license you own.

## Add-ons (any tier)

| Add-on                        | Anchor price                  | Notes                                                               |
| ----------------------------- | ----------------------------- | ------------------------------------------------------------------- |
| Extra intake channel          | $250/mo each                  | Beyond the tier's included set                                      |
| Video content pack (Cognitia) | from $750/mo                  | AI-assisted vehicle / brand video, monthly batch                    |
| Ad management                 | 15% of ad spend (min $500/mo) | Management fee only; ad spend is paid by the dealer and is separate |
| Extra language                | $400 setup + $150/mo          | Full bilingual site + intake + closer                               |
| Additional rooftop            | $1,000 setup + $400/mo        | Per extra location                                                  |
| Dedicated landing campaign    | from $1,200 one-time          | Single-offer page + intake, approval-gated copy                     |

Ad spend itself is the dealer's media budget paid to the platforms — we never mark
it up or commingle it with our fee, and we make no claim about its return.

## How the Console maps config → tier

The Discovery Console computes a transparent complexity score from the config
(`inventory_size`, `inventory_update_method`, `current_website`, `current_crm`,
channel count, `sales_team_size`, `monthly_ad_budget`, languages) and recommends:

| Complexity score | Recommended tier |
| ---------------- | ---------------- |
| 0–4              | Launch           |
| 5–9              | Growth           |
| 10+              | Scale            |

Then it applies budget sense:

- `monthly_ad_budget = under_1k` caps the recommendation at **Launch**.
- `monthly_ad_budget = 7k_plus` floors the recommendation at **Growth**.

The full scoring is in `../console/discovery-console-spec.md` and runs live in
`../console/discovery-console.html`. The recommendation is a starting point, not a
gate — any dealer can choose any tier.

## Value framing (not a guarantee)

We anchor on the leak, not on a promised return. If even a handful of inquiries a
month are currently going unanswered after hours or getting lost in a spreadsheet,
the cost of _not_ capturing them tends to dwarf the monthly fee. We will show you
the captured-lead and response-time numbers in the proof dashboard so you can judge
the value yourself — `12-proof-reporting-plan.md`. We do not promise a specific
return; we make the results visible.

## Terms (template)

- Month-to-month after an initial 90-day term (so the proof loop has time to run).
- Setup billed 50% at kickoff, 50% at first-win delivery.
- Founding **Client Zero** terms may differ from this template — see the signed
  offer. `[REQUIRES HUMAN APPROVAL]` for any final figure.

## Next step

Confirm your config in the Discovery Console, pick the recommended tier (or adjust),
and we book kickoff. Roadmap: `10-roadmap-30-60-90.md`.
