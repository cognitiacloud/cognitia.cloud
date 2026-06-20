# Deliverable #9 — SEO / AEO / GEO Page & Entity Map

**Module:** Found where buyers look · **For:** [Dealership name]
**Prepared by:** Demandara (powered by Cognitia)

> Guardrails: this is best-practice work toward visibility and answer
> eligibility. It never promises a ranking, a keyword position, or
> inclusion in any AI answer. Any price, payment, or trade-in figure on a
> page is `[REQUIRES HUMAN APPROVAL]`. See `../internal/guardrails.md`.

---

## What this document is

A page and entity map across three layers — classic SEO, AEO (answer
engine optimization), and GEO (generative engine optimization) — with a
concrete page table, the schema types to attach, and a priority order that
scales by `primary_goal` and `current_website` state.

State this plainly to the client and keep it in the doc: visibility is
**effort toward eligibility**, never a guaranteed rank and never a
guaranteed AI-answer inclusion. We build the pages, structure, and signals
that make a dealership eligible to be found and cited. We do not control
search engines or generative engines, and we do not promise placement.

## The three layers

### Layer 1 — Classic SEO (be findable)

The crawlable, indexable foundation. Make/model pages, location pages,
inventory category pages, and the schema that describes them.

- **Make/model pages:** one durable page per make and per make+model the
  dealership stocks or wants to attract (e.g. /used/toyota/,
  /used/toyota/corolla/). These outlast individual VIN listings.
- **Location pages:** one per rooftop, with consistent NAP (name, address,
  phone), hours, directions, and the inventory served there.
- **Inventory category pages:** body style, price band, condition, fuel
  type (e.g. /used-suvs/, /trucks-under-30k/). Faceted but indexable.
- **Individual vehicle (VDP) pages:** one per VIN, photos privacy-checked
  before publish (Hermes Vision publish-safety), retired cleanly when the
  vehicle sells.

### Layer 2 — AEO (be the answer)

Structure content so an answer engine can lift a clean, correct answer.

- **FAQ blocks** on make/model, location, and category pages answering the
  real questions buyers type and speak.
- **"Near me" intent:** location and category pages tuned for "[body
  style] dealer near me", "used [make] [city]".
- **Comparison questions:** "[Model A] vs [Model B]", "is [model] good for
  families", "best used SUV under 30k in [city]" — answered factually, no
  invented stats, no fabricated reviews.
- **Structured data** (FAQPage, Vehicle) so answers are machine-readable.

### Layer 3 — GEO (be citable)

Make the dealership a coherent, consistent entity that a generative engine
can recognize and cite.

- **Consistent NAP** everywhere — site, Google Business Profile, maps,
  directories. One spelling, one phone, one address per rooftop.
- **Entity coherence:** the dealership, its rooftops, and its inventory
  described consistently across the site so the entity is unambiguous.
- **Being citable:** clear, factual, attributable pages a model can quote
  without guessing. Accurate over clever.

We never promise an AI answer will cite the dealership. We make it
eligible to be cited.

## Page map

| Page type | Example URL | Primary schema | SEO | AEO | GEO |
| --- | --- | --- | --- | --- | --- |
| Homepage | `/` | `AutoDealer`, `LocalBusiness` | core | brand FAQ | NAP anchor |
| Location page | `/locations/[city]/` | `LocalBusiness` | core | "near me" | NAP per rooftop |
| Make page | `/used/[make]/` | `AutoDealer` | core | make FAQ | entity link |
| Make/model page | `/used/[make]/[model]/` | `Vehicle` (aggregate) | core | model + comparison FAQ | citable spec |
| Category page | `/used-suvs/`, `/trucks-under-30k/` | `AutoDealer` | core | category "near me" | entity link |
| Vehicle (VDP) | `/vehicle/[vin]/` | `Vehicle` | core | spec answers | freshness signal |
| FAQ / answers hub | `/answers/` | `FAQPage` | support | primary AEO surface | citable Q&A |
| About / trust | `/about/` | `AutoDealer`, `LocalBusiness` | support | trust FAQ | entity coherence |

Any price, payment, or financing copy that appears on a category or VDP
page (e.g. "trucks under 30k", listed price, "financing available") is
dealer-supplied listing data or `[REQUIRES HUMAN APPROVAL]` placeholder
until a named dealer approver signs off. The page map structures where
such copy lives; it does not originate a number.

## Schema types

Four core types, applied per the table above:

- **`AutoDealer`** — the dealership as a business; make, category, and
  dealer-level pages.
- **`LocalBusiness`** — per-rooftop presence: NAP, hours, geo, service
  area. Foundation of GEO entity coherence.
- **`Vehicle`** — individual VDPs and aggregate make/model pages; year,
  make, model, mileage, condition. Price fields are dealer-supplied /
  `[REQUIRES HUMAN APPROVAL]`.
- **`FAQPage`** — FAQ blocks and the answers hub; the AEO surface engines
  read for direct answers.

Schema is implemented to current best practice. Valid, accurate markup
makes a page *eligible* for rich results and answer lift — it does not
guarantee either.

## Priority order

Sequencing depends on where the dealership starts and what it is trying to
move. Two dials: `current_website` and `primary_goal`.

### By `current_website` state

| State | Start here |
| --- | --- |
| `none` | Stand up homepage + one location page + NAP/`LocalBusiness` first. Get the entity to exist and be consistent before depth. |
| `basic` | Add make/model and category pages; layer schema; build the answers hub. |
| `outdated` | Fix NAP consistency and schema, retire dead/duplicate pages, then expand make/model coverage. |
| `modern` | Lead with AEO/GEO depth: comparison FAQs, answers hub, entity coherence, citability. |

### When `primary_goal` is `online_presence`

`online_presence` makes this module the headline. Recommended order:

1. **NAP + `LocalBusiness` + homepage** — the entity exists and is
   consistent (GEO foundation).
2. **Location pages** — one per rooftop, "near me" eligible.
3. **Make/model pages** — durable demand capture, `Vehicle` schema.
4. **Category pages** — body style and price-band intent.
5. **Answers hub + FAQ blocks** — `FAQPage`, comparison and "near me"
   questions (AEO).
6. **VDP hygiene** — clean publish (privacy-checked photos), clean
   retirement on sale.
7. **Entity coherence + citability pass** — consistent description across
   all surfaces (GEO depth).

For other goals this module still runs, but ordering yields to the lead
module: under `faster_response` the intake and Closer lead; under
`more_leads`, category and make/model capture pages move up; under
`inventory_online`, VDP and category coverage move up.

## What we commit to vs what we don't

| We commit to | We do not promise |
| --- | --- |
| Building the pages and schema above to best practice | A #1 ranking or any keyword position |
| Consistent NAP and entity coherence across surfaces | Inclusion or citation in any AI answer |
| Accurate, factual, citable content | A traffic, lead, or sales number |
| Privacy-checked, clean VDP publish and retirement | A timeline to "page one" |

No invented inventory and no fabricated reviews appear on any page. Every
answer and comparison is built from real, attributable facts. Outcomes are
reported honestly in the proof loop, including flat periods — see
`../proposal/12-proof-reporting-plan.md`.

## Governance note

This page map is a specification in the Client Zero prototype lane. No live
wiring of analytics, Google Business Profile, or any third-party SEO tool
is performed here; tools named are options to evaluate, not provisioned
integrations. Visibility claims stay inside the guardrails above. See
`../internal/guardrails.md`.
