# Sales Closer Data-Source Strategy — Car Dealerships, BC/Vancouver

> **Status:** Design memo (no code). Architecture decision record for the data
> sourcing layer of the Cognitia Sales Closer Intelligence Engine.
> **Scope of pilot:** Licensed car dealerships in BC / Greater Vancouver,
> multi-channel outreach (email + phone + LinkedIn), lean-budget provider posture.

## Context

Cognitia is building a B2B "Sales Closer Intelligence Engine" to **find, qualify,
and prepare multi-channel outreach** to car dealerships, starting in BC / Greater
Vancouver. The system leans on **Apify** for public discovery and own-website
crawling, plus **licensed enrichment APIs** — but must avoid risky/non-compliant
scraping and respect Canadian law (**CASL, PIPEDA, CRTC National DNCL**) and
platform Terms of Service.

This memo defines the data-source strategy **before** any implementation: safe
sources, which Apify Actors to test and in what order, which enrichment providers
to use, the fields each source provides, prototype-vs-production classification,
a consolidated data-source matrix, and compliance guardrails.

---

## 1. Strategic principle: registry-anchored, not scrape-anchored

Treat an **authoritative public registry as the spine** of the account list, and
use scraping only to *enrich* known accounts — never as the primary way to
"discover people." This inverts the usual risk profile: we crawl a dealer's
*own* public website and verify against licensed APIs, instead of harvesting
third-party platforms. Personal data is minimized; we prefer **role-based,
conspicuously-published business contacts** (e.g. `sales@`, GM names on team
pages) over personal data sourced from third-party platforms.

---

## 2. Safe public sources for account discovery (production-safe)

| # | Source | Why it's safe / authoritative |
|---|--------|-------------------------------|
| 1 | **BC Vehicle Sales Authority (VSA) licensed-dealer registry** | Statutory public register of every licensed motor dealer in BC. The spine of the list. |
| 2 | **New Car Dealers Association of BC (NCDA BC)** member directory | Public industry directory; clean franchise-dealer coverage. |
| 3 | **OEM "Find a Dealer" locators** (Toyota.ca, Ford.ca, etc.) | Public, structured, brand-affiliation signal. |
| 4 | **BC Registry / OrgBook BC (open data)** | Legal entity name, status, registration #, directors. Open licence. |
| 5 | **The dealership's own public website** | Hours, services, team/about, departments, published business contacts. |
| 6 | **OpenStreetMap / municipal open data** | POI/address backstop under open licences. |

These six need **no scraping of a third party's protected platform** and form the
production backbone.

---

## 3. Apify Actors — test order & verdict

| Order | Actor (example) | Use | Verdict |
|---|---|---|---|
| **1st** | **Website Content Crawler** (`apify/website-content-crawler`) | Crawl the dealer's *own* site → services, departments, team, hours, tech footprint. | **Production-safe** when limited to the target's own site, robots.txt-respecting, rate-limited. Lowest risk, highest signal. |
| **2nd** | **Google Search / SERP scraper** (`apify/google-search-scraper`) | Resolve official website + presence for each registry account. | **Prototype → conditional prod.** Low volume, discovery-only (URLs/titles, no personal data). Google ToS disallows automated SERP; keep volume low or swap to a licensed Search API before scaling. **Medium risk.** |
| **3rd** | **Contact-details / email scraper** (`vdrmota/contact-info-scraper`) | Pull published business emails/phones from the dealer's own site. | **Prototype, legal-reviewed.** Restrict to the dealer's own domain + role-based addresses; do **not** mass-harvest personal emails (CASL). **Medium-high risk.** |
| **4th** | **Google Maps / Local Business scraper** (`compass/crawler-google-places`) | Rich firmographics (hours, ratings, category). | **Prototype ONLY, legal-reviewed.** Google Maps ToS prohibits scraping; reviews/personal data raise PIPEDA. Use to validate field value, then source the same fields compliantly (OEM/registry/own-site or Google Places **API**). **High risk.** |

**Rule:** crawl *your prospect's own property* freely (respectfully); treat any
*third-party platform* (Google SERP/Maps, LinkedIn) as prototype-only until
replaced by a licensed API or counsel sign-off.

---

## 4. Enrichment providers (lean-budget posture)

| Provider | Role | Fields | Cost model | Pilot decision |
|---|---|---|---|---|
| **Hunter** | Email discovery + **verification** from domain | Email, pattern, deliverability/confidence, sources | Cheap per-search/verify credits; free tier | **YES — pilot core.** Cheapest way to get/verify business emails for CASL-defensible sending. |
| **Apollo** | B2B contact + company DB | Person name/title/role, business email, phone, company firmographics, LinkedIn URL | Seat + credit tiers | **YES — selective.** Fill GM/decision-maker name + title + phone where own-site/Hunter miss. Use sparingly to control cost. |
| **People Data Labs** | Bulk person/company enrichment API | Person + company records, firmographic depth, at scale | Per-record API | **DEFER to scale.** Overkill for one metro; revisit beyond Vancouver. |
| **Clay** | Waterfall **orchestration** of many sources | (orchestrates above) | Credit tiers | **DEFER to scale.** Powerful for chaining providers, but adds cost/complexity; reproduce a simple waterfall manually in the pilot. |

Lean stack = **Hunter (verify) + selective Apollo (decision-maker fill)**; PDL +
Clay are the documented upgrade path when expanding past Vancouver.

---

## 5. Fields each source should provide

- **VSA registry:** legal/operating name, licence #, status, address, dealer type.
- **NCDA BC / OEM locators:** brand affiliation(s), franchise vs independent, official site URL, public phone.
- **BC Registry / OrgBook:** legal entity, registration #, status, directors/officers.
- **Website Content Crawler (own site):** departments (new/used/service/parts/finance), staff/team names + titles, hours, published `info@/sales@` email, location count, site tech (chat/CRM/booking widgets) as a fit signal.
- **SERP scraper:** official URL, basic presence/title snippets (discovery only).
- **Contact scraper (own site):** role-based business email(s), department phone(s).
- **Maps/Places (prototype):** category, hours, rating/review count (validation only).
- **Hunter:** verified business email + confidence/deliverability.
- **Apollo:** decision-maker (GM/Owner/GSM) name, title, business email, direct/mobile phone, LinkedIn URL, company size/revenue band.
- **(PDL/Clay — deferred):** enrichment depth + orchestration at scale.

---

## 6. Data-source matrix

| Source | Key data fields | Cost model | Risk | Production recommendation |
|---|---|---|---|---|
| VSA licensed-dealer registry | name, licence#, status, address, type | Free/public | **Low** | **Production — spine of list** |
| NCDA BC directory | brand, site, phone, franchise flag | Free/public | **Low** | **Production** |
| OEM dealer locators | brand affiliation, official URL, phone | Free/public | **Low** | **Production** |
| BC Registry / OrgBook | entity, reg#, status, directors | Free / open data | **Low** | **Production** |
| Apify **Website Content Crawler** (own site) | departments, team, hours, email, site tech | Apify compute (per-run) | **Low–Med** | **Production** (robots-respecting, rate-limited) |
| Apify **SERP scraper** | official URL, presence | Apify compute | **Med** | **Prototype → prod at low volume**; swap to licensed Search API to scale |
| Apify **Contact scraper** (own site) | role-based email/phone | Apify compute | **Med–High** | **Prototype, legal-reviewed**; own-domain + role-based only |
| Apify **Maps/Places scraper** | category, hours, rating | Apify compute | **High** | **Prototype only**; replace with Places **API**/registry for prod |
| **Hunter** | verified email + confidence | Credits (cheap) | **Low** | **Production — pilot core** |
| **Apollo** | decision-maker name/title/email/phone/LinkedIn | Seat + credits | **Low–Med** | **Production — selective use** |
| **People Data Labs** | bulk person/company enrichment | Per-record API | **Low–Med** | **Defer** to scale |
| **Clay** | multi-source waterfall orchestration | Credits | **Low–Med** | **Defer** to scale |

---

## 7. Prototype-only vs production-safe (summary)

- **Production-safe:** VSA, NCDA BC, OEM locators, BC Registry/OrgBook, Website
  Content Crawler (own site), Hunter, selective Apollo.
- **Prototype / legal-reviewed:** SERP scraper (low volume), contact scraper
  (own-domain role-based), Google Maps/Places scraper. PDL + Clay are
  "production-capable but deferred" on cost grounds, not risk grounds.

---

## 8. Compliance guardrails (Canada, multi-channel)

- **CASL (email):** rely on **implied consent** — email a *conspicuously published*
  business address, message relevant to that role, with valid identification +
  one-click unsubscribe. No purchased personal-email lists.
- **CRTC National DNCL (phone):** scrub dealership phone outreach against the DNCL;
  rely on business-relationship/published-number exemptions where applicable.
- **LinkedIn:** outreach **manually or via official APIs only** — no automated
  scraping/connection bots (ToS + account risk).
- **PIPEDA:** minimize personal data, prefer role-based contacts, honor
  access/deletion requests, document source + lawful basis per record.
- **Platform ToS:** never scrape Google SERP/Maps or LinkedIn at production scale;
  use licensed APIs there.

---

## 9. Recommended pipeline (conceptual, no code)

```
Discovery        → VSA spine + NCDA/OEM cross-ref
Resolve site     → low-volume SERP
Enrich own-site  → Website Content Crawler (departments / team / hours / email / tech)
Contact build    → Hunter verify → selective Apollo decision-maker
Qualify / score  → brand, size, dept mix, site-tech fit signals
Compliance gate  → CASL / DNCL / ToS checks per channel
Outreach prep    → multi-channel, per-record source + consent provenance
```

---

## 10. Next step

Future work (separate task) is to design the **data model / schema + ingestion
pipeline** for the above, starting with the VSA-spine account table and a
**provenance + consent** field on every contact record.
