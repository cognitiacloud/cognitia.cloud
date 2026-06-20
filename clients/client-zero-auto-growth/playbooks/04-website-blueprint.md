# Dealership Website Blueprint — Deliverable #4

**For:** [Dealership name] · **Prepared by:** Demandara (powered by Cognitia)
**Date:** [date] · **Module:** Auto Growth OS #1 (conversion-built website)

> Guardrails: this blueprint specifies a build, not a promise; finance and
> trade-in pages are collection-and-handoff and every customer-facing
> number is `[REQUIRES HUMAN APPROVAL]`. See `../internal/guardrails.md`.

---

## What this document is

The build spec for the dealership website — the first module of the Auto
Growth OS (`../proposal/03-auto-growth-os-offer.md`). It defines the
information architecture, the full page list, section-by-section
wireframe notes for the pages that move the deal, the conversion
elements that go on every page, the performance and mobile-first bar the
build must clear, and the schema markup we ship.

It is **not a website on its own.** It is the surface the rest of the OS
plugs into: inventory publishes onto these pages
(`05-inventory-automation.md`), intake feeds the inboxes
(`06-whatsapp-telegram-intake.md`), and the AI Sales Closer answers from
them (`08-ai-sales-closer-script.md`).

## Build tier — scales by `current_website`

The website is sized off the discovery `current_website` field. Same
architecture either way; the effort and the deliverable differ.

| `current_website` | Tier       | What we do                                      |
| ----------------- | ---------- | ----------------------------------------------- |
| `none`            | Full build | New site, full IA, all pages                    |
| `basic`           | Full build | Replace; carry over domain + brand              |
| `outdated`        | Full build | Rebuild on current stack                        |
| `modern`          | Optimize   | Keep the shell; add VDP, capture, schema, speed |

Full build = `none` / `basic` / `outdated`: we stand up the whole IA
below. Optimize = `modern`: we leave the existing site standing and
layer on the parts that convert — per-vehicle VDPs, inquiry capture,
sticky contact, trust signals, and the schema block — rather than
re-pour the foundation.

---

## Information architecture

One top-level nav, shallow and obvious. Every page is at most two clicks
from Home. Inventory is the spine; everything else supports a path to an
inquiry.

```
Home
├── Inventory (listing)
│   └── Vehicle Detail Page (VDP)   one page per vehicle
├── Finance *                       [REQUIRES HUMAN APPROVAL]
├── Trade-in *                      [REQUIRES HUMAN APPROVAL]
├── About
├── Locations
│   └── (per-rooftop page if multi-location)
├── Contact
└── AEO / FAQ hub
```

`*` = approval-gated. Finance and Trade-in render in nav and as
collection-and-handoff pages by default; the customer-facing copy on
them does not ship until a named human approver signs off.

### Full page list

| Page          | Purpose                                | Gate                        |
| ------------- | -------------------------------------- | --------------------------- |
| Home          | Orient, route to inventory, capture    | —                           |
| Inventory     | Browse + filter the lot                | —                           |
| VDP           | Sell one vehicle, capture intent       | per-vehicle, auto-built     |
| Finance       | Collect financing interest, hand off   | `[REQUIRES HUMAN APPROVAL]` |
| Trade-in      | Collect trade details, hand off        | `[REQUIRES HUMAN APPROVAL]` |
| About         | Trust, people, why-you                 | —                           |
| Contact       | Reach a human, all channels            | —                           |
| Locations     | Hours, map, directions per rooftop     | —                           |
| AEO / FAQ hub | Answer the real questions; AI-eligible | —                           |

Finance and Trade-in pages exist for every dealership, but their depth
follows discovery: `finance_handling` and `tradein_handling`
(`none` / `collect_only` / `dealer_approved_copy` /
`dealer_approved_ranges`) decide whether the page is hidden, a pure
collection form, or a form plus dealer-approved language.

---

## Wireframe notes — key pages

Notes are top-to-bottom, mobile-first order. Desktop widens; it does not
re-rank. Every page ends with one clear next step.

### Home

1. Header: logo, phone (tap-to-call), primary CTA "Browse inventory".
2. Hero: one line on who you are and what you sell, a search/filter
   entry into inventory, no carousel that blocks the fold.
3. Featured / recently added vehicles — pulled live from inventory, each
   card linking to its VDP.
4. Trust strip: years in business, rooftop count, review snapshot
   (real reviews only — no fabricated testimonials, per guardrails).
5. How-it-works / why-buy-here: three short blocks.
6. Finance and Trade-in entry cards (each routes to its gated page;
   copy is collect-first, no numbers).
7. Locations + hours preview, map.
8. Footer: nav, hours, contact channels, legal/disclaimer slot.

Next step on every section: a route into inventory or an inquiry.

### Inventory listing

1. Filter bar: make, model, year, body, price band, fuel/EV, mileage —
   only the facets the lot actually uses, driven by `dealership_type`
   (`new` / `used` / `both` / `specialty`).
2. Result count + sort (price, year, days-on-lot, newest).
3. Vehicle cards: lead photo (already privacy/quality-gated, see
   `05-inventory-automation.md`), year-make-model, mileage, price,
   one-line status, and a clear "View details" link to the VDP.
4. Each card carries a quick "Check availability" inquiry action.
5. Pagination or infinite scroll with a visible result anchor.
6. Empty/loading states that still offer a next step (contact, notify).

Price shown is the listed inventory price field. Any payment or
financing framing on a card is `[REQUIRES HUMAN APPROVAL]`.

### Vehicle Detail Page (VDP)

The page that does the selling. One per vehicle, auto-built on publish.

1. Gallery: privacy/quality-gated photos; lead image first; no plates,
   documents, or low-quality shots (gate is mandatory — see
   `05-inventory-automation.md`).
2. Title block: year-make-model-trim, price, status (available / sold /
   pending), VIN/stock where appropriate.
3. Primary CTA cluster, sticky on mobile: "Check availability",
   "Message us" (routes to the intake inbox), tap-to-call.
4. Key specs table: mileage, drivetrain, fuel/EV, transmission, color,
   features — sourced from the normalized inventory record.
5. Description: generated draft, dealer-editable, factual only.
6. Finance entry: "Ask about financing on this vehicle" → routes to the
   gated Finance flow. No APR, no payment, no "approved."
   `[REQUIRES HUMAN APPROVAL]` on any payment estimate.
7. Trade-in entry: "Have a trade? Get it valued" → collection form;
   value is produced by a human. `[REQUIRES HUMAN APPROVAL]`.
8. Trust + similar vehicles: review snapshot, then 3–4 related VDP
   links to keep the session alive.

### Finance page `[REQUIRES HUMAN APPROVAL]`

Collection-and-handoff by default. The page captures interest and routes
to a human; it does not quote.

1. Plain-language intro: "Tell us what you're looking for and a team
   member follows up." No rates, no "everyone qualifies."
2. Collection form: vehicle of interest, budget band (the discovery
   bands, not a payment promise), timeline, contact + consent.
3. Handoff: submission lands in the intake inbox / CRM-lite pipeline
   (`07-crm-lite-pipeline.md`) tagged for the finance follow-up SLA.
4. Any displayed rate, term, monthly figure, or "approved" language is
   placeholder and `[REQUIRES HUMAN APPROVAL]`; it ships only after the
   dealer/lender approver signs off. If `finance_handling: none`, the
   page is hidden. If `dealer_approved_copy`, only dealer-supplied,
   pre-approved language renders.

### Trade-in page `[REQUIRES HUMAN APPROVAL]`

Collection-and-handoff by default. The system collects the vehicle; a
human produces the number.

1. Intro: "Send us your vehicle details and we'll come back with a
   number." No instant estimate, no "we'll beat any offer."
2. Collection form: year-make-model, mileage, condition, VIN optional,
   photos optional, contact + consent.
3. Handoff: routed to the pipeline tagged for trade-in valuation SLA.
4. Any range, estimate, or comparative claim is
   `[REQUIRES HUMAN APPROVAL]`. If `tradein_handling: none`, the page is
   hidden. If `dealer_approved_ranges`, only dealer-supplied approved
   ranges render.

### About, Contact, Locations

- **About:** who you are, how long, the people, why buyers choose you
  (pulled from discovery answers). Real proof only.
- **Contact:** every channel you actually run — phone, WhatsApp,
  Telegram, web form, email — each opening the consent-first intake.
  Map + hours. One inbox behind it all.
- **Locations:** one section per rooftop (address, hours, map,
  directions, per-location phone). For multi-location, each rooftop gets
  its own crawlable page for local search.

### AEO / FAQ hub

The answer surface for search and AI assistants. Real questions buyers
ask — financing process, trade-in process, hours, test-drive booking,
what you stock — answered plainly and structured for FAQPage schema.
Cross-links to `09-seo-aeo-geo-page-map.md`. We build for
answer-eligibility; we never promise inclusion in any AI answer.

---

## CRO elements — on every page

These are required, not optional, and they apply to both tiers.

- **One clear next step per page.** Every page names the single action
  we want next (browse, check availability, message, call, book). No
  dead ends.
- **Inquiry capture where intent appears.** Capture lives on the VDP and
  inventory cards — at the moment of interest — not only on Contact.
  Every form is consent-first with an opt-out path (guardrail #6).
- **Sticky contact.** Persistent tap-to-call and message control on
  mobile, always reachable, never blocking content.
- **Trust signals.** Real review snapshots, years/rooftops, named
  people, clear hours and location. No fabricated testimonials, no
  invented inventory (guardrail #7).
- **Consistent inbox routing.** Every form and channel lands in the one
  intake inbox (`06-whatsapp-telegram-intake.md`) and the CRM-lite
  pipeline, so nothing drops into a spreadsheet.

---

## Performance & mobile-first requirements

Buyers are on phones on the lot. The build is mobile-first and fast or
it does not ship.

- Mobile-first layout; the mobile order above is the source of truth.
- Core Web Vitals as the bar: fast load and interaction, stable layout
  (no shifting as images load). Measured, not assumed.
- Image discipline: responsive sizes, lazy-loaded below the fold,
  compressed — and every image already privacy/quality-gated before it
  reaches the page (`05-inventory-automation.md`).
- Tap-to-call and message actions reachable one-handed.
- Accessible: legible contrast, real alt text, keyboard-navigable forms.
- Works on slow mobile connections; no layout that depends on hover.

---

## Schema markup

Structured data ships on the matching pages so vehicles, the dealership,
answers, and locations are machine-readable for search and AI
assistants. Detail and page mapping live in
`09-seo-aeo-geo-page-map.md`; this is the required set.

| Schema          | Where it ships                             |
| --------------- | ------------------------------------------ |
| `Vehicle`       | Every VDP — specs, price, availability     |
| `AutoDealer`    | Site-wide / Home — the dealership entity   |
| `LocalBusiness` | Each Locations / rooftop page — NAP, hours |
| `FAQPage`       | AEO / FAQ hub — question/answer pairs      |

Schema reflects the published record only. Any price, payment, or
trade-in value surfaced through schema inherits the same approval gate:
financing and trade-in figures are `[REQUIRES HUMAN APPROVAL]`.

---

## Handoffs

- **Inventory →** populates Inventory, VDPs, and `Vehicle` schema:
  `05-inventory-automation.md`.
- **Intake →** every form and channel routes here:
  `06-whatsapp-telegram-intake.md`.
- **Pipeline →** captured inquiries (incl. finance/trade-in) land here:
  `07-crm-lite-pipeline.md`.
- **AI Sales Closer →** answers from these pages, hands off on
  finance/payment/trade-in: `08-ai-sales-closer-script.md`.
- **SEO / AEO / GEO →** page map and schema detail:
  `09-seo-aeo-geo-page-map.md`.
