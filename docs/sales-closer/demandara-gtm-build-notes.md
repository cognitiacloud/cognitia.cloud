# Demandara GTM Sales-Closer — Build Notes

> **Status:** Scaffold only (types + pure guardrail helpers + docs). No scrapers,
> no enrichment integrations, no outreach. Policy-first.

## What this is

The **Demandara Sales Closer Data Source Registry** is the governed system for
identifying **GTM prospects** — dealership owners/operators who may buy the
product — and preparing **human-reviewed** outreach. Its policy source is the
data-source strategy memo (PR #91, `docs/sales-closer/data-source-strategy.md`).

This change scaffolds only the **data model** and **compliance guardrail
helpers** in `@cognitia/core`. It deliberately builds **no** scrapers, **no**
Apify/Hunter/Apollo/Clay/PDL integrations, adds **no** dependencies, sends **no**
outreach, and automates **no** cold messaging.

## Two universes — do not mix

| Universe                    | Who                         | Captured how                                                              | Lives in                                                                                 |
| --------------------------- | --------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Dealer customer leads**   | Car shoppers                | Public dealership website (vehicle/finance/trade-in/test-drive inquiries) | Auto Growth OS CRM-lite — existing `leads` / MoverOS `lead_intakes`. **Untouched here.** |
| **Demandara GTM prospects** | Dealership owners/operators | Governed public/business data strategy                                    | New `GtmProspect` DTO (this scaffold) → Demandara Sales Closer / GTM pipeline.           |

`GtmProspect` is a **prospecting DTO / domain type**, not a customer-lead model
and **not a new database table**. Nothing in the GTM module imports or aliases
the customer-lead primitives.

> Persistence later should map GTM prospects into the platform-native GTM/account
> primitives where appropriate. This scaffold intentionally does not create a new
> GTM prospect table or mix with dealership customer leads.

## Prototype vs production

Per the PR #91 memo, sources are split:

- **Production-safe:** licensed-dealer registry, industry directories, OEM dealer
  locators, business registry / open data, the dealer's own website, role-based
  published business contacts; Hunter (verify) + selective Apollo as the lean
  enrichment stack.
- **Prototype / legal-reviewed only:** SERP scraping (low volume), own-domain
  contact scraping, Google Maps/Places scraping. People Data Labs + Clay are
  deferred-to-scale, not pilot.

`DataSource.productionStatus` (`prototype | legal_review | production | blocked`)
and `classifySourceRisk()` encode this split in code. A `blocked` source can
never be used (`canUseSourceForProspecting()` returns `false`).

## No integrations are live

There is no API wiring to any provider in this change. The helpers are pure
functions over in-memory inputs. Connecting Apify/Hunter/Apollo etc. is a
separate, future, explicitly-scoped effort gated by legal review.

## Canadian compliance is encoded, not assumed

- **PII doctrine (ARCHITECTURE_LOCK_V1_1):** a normalized `GtmProspect` carries
  **no raw contact PII** — only `contactEmailHash` / `contactPhoneHash` (sha256),
  `contactEmailMasked` / `contactPhoneMasked`, and `contactDomain`. Raw
  email/phone may transit `RawGtmProspectInput` into `normalizeGtmProspect()`
  only, where they are hashed/masked and **dropped** from the result.
- **CASL / consent:** `contactBasis` and `consentStatus` track lawful basis;
  `canContactProspect()` hard-blocks do-not-contact, unsubscribe, and
  do_not_contact/unsubscribed consent states.
- **Human-in-the-loop:** `GTM_OUTREACH_REQUIRES_HUMAN_APPROVAL` is always true;
  `requiresHumanReviewForOutreach()` adds a hard gate for not-established consent
  or high-risk sources. There is no fully autonomous outreach path.

## Helpers (in `@cognitia/core`)

`packages/core/src/gtm/index.ts`:

- `canUseSourceForProspecting(source)`
- `canContactProspect(prospect)`
- `requiresHumanReviewForOutreach(prospect)` (+ `GTM_OUTREACH_REQUIRES_HUMAN_APPROVAL`)
- `classifySourceRisk(source)`
- `createGtmProofEvent(action)` — builds, never persists, a proof event
- `normalizeGtmProspect(rawInput)` — PII-safe normalization
- `DEMANDARA_GTM_AGENT_POLICY`, `GTM_PROOF_EVENT_EXAMPLES` — policy data

## Deferred follow-up spec (UI not built here)

These surfaces are intentionally **not** implemented in this scaffold (the web
app has no `/portal` or `/discovery` routes today, and the architecture is
guard-tested). They are captured here as the agreed follow-up:

- **`/portal/settings/data-sources`** — source matrix: allowed/disallowed use,
  risk level, prototype-vs-production status, enrichment provider notes,
  compliance notes. Backed by the `DataSource` type.
- **`/portal/agent-economy` — Demandara GTM agent behavior.**
  - Allowed: summarize prospect, score fit, draft human-reviewed outreach,
    create discovery-prep note, log proof event.
  - Forbidden: scrape blocked sources, send autonomous cold outreach, bypass
    unsubscribe/do-not-contact, invent contacts, enrich sensitive personal data
    without review, claim guaranteed results.
  - Encoded as `DEMANDARA_GTM_AGENT_POLICY`.
- **`/portal/proof` — GTM proof events:** prospect sourced from approved public
  source, source reviewed, outreach draft generated, human review required,
  discovery booked manually, proposal generated. Encoded as
  `GTM_PROOF_EVENT_EXAMPLES`.
- **`/discovery` gating:** a `GtmProspect` may become a `DiscoverySession` only
  after **human qualification** (`discoveryStatus: 'qualified'` → `'booked'`).
