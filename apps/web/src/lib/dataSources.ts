import type { DataSource } from '@cognitia/core';

/**
 * Declared data sources for B2B dealership prospecting, transcribed from the
 * data-source strategy memo (docs/sales-closer/data-source-strategy.md, PR #91).
 *
 * Uses the shared `DataSource` type from `@cognitia/core` (PII-safe GTM scaffold,
 * #97) — no local redefinition. Pure data + a usability mirror; no network, no
 * scraping. The registry is the spine; third-party platforms are prototype/
 * legal-review only. `isSourceUsable` mirrors the core
 * `canUseSourceForProspecting` rule (verified in the test) so the page bundle
 * stays free of core's runtime.
 */

export const DATA_SOURCES: readonly DataSource[] = [
  {
    id: 'vsa-registry',
    name: 'BC Vehicle Sales Authority (VSA) licensed-dealer registry',
    category: 'Registry',
    sourceType: 'public_registry',
    allowedUse:
      'Authoritative account list: legal/operating name, licence #, status, address, dealer type.',
    disallowedUse: 'Not a source of personal/consumer data.',
    riskLevel: 'low',
    fieldsAvailable: ['companyName', 'licenceNumber', 'status', 'address', 'dealerType'],
    productionStatus: 'production',
    notes:
      'Statutory public register — the spine of the account list. Business/firmographic data only.',
  },
  {
    id: 'ncda-bc',
    name: 'New Car Dealers Association of BC (NCDA BC) directory',
    category: 'Directory',
    sourceType: 'industry_directory',
    allowedUse: 'Brand affiliation, official site URL, public phone, franchise flag.',
    disallowedUse: 'No scraping behind member logins.',
    riskLevel: 'low',
    fieldsAvailable: ['brand', 'website', 'publicPhone', 'franchiseFlag'],
    productionStatus: 'production',
    notes: 'Public industry directory; clean franchise coverage. Business contact only.',
  },
  {
    id: 'oem-locators',
    name: 'OEM "Find a Dealer" locators (Toyota.ca, Ford.ca, etc.)',
    category: 'OEM',
    sourceType: 'oem_locator',
    allowedUse: 'Brand affiliation, official URL, public phone.',
    disallowedUse: 'No anti-bot bypass; respect site ToS.',
    riskLevel: 'low',
    fieldsAvailable: ['brand', 'website', 'publicPhone'],
    productionStatus: 'production',
    notes: 'Public, structured brand-affiliation signal.',
  },
  {
    id: 'bc-registry-orgbook',
    name: 'BC Registry / OrgBook BC (open data)',
    category: 'Registry',
    sourceType: 'open_data',
    allowedUse:
      'Legal entity, registration #, status, directors/officers (business identification).',
    disallowedUse: 'Do not use director data for personal targeting.',
    riskLevel: 'low',
    fieldsAvailable: ['legalEntity', 'registrationNumber', 'status'],
    productionStatus: 'production',
    notes: 'Open-licence legal-entity data. Minimize use of director personal data.',
  },
  {
    id: 'apify-website-content-crawler',
    name: "Apify Website Content Crawler (dealer's own site)",
    category: 'Own site',
    sourceType: 'own_website',
    allowedUse:
      "Crawl the target's OWN site: departments, team, hours, role-based info@/sales@ contact, site tech.",
    disallowedUse: 'No third-party sites; respect robots.txt; rate-limit.',
    riskLevel: 'low',
    fieldsAvailable: ['departments', 'team', 'hours', 'roleBasedContact', 'siteTech'],
    productionStatus: 'production',
    notes:
      'Lowest risk, highest signal when limited to the target site. Robots-respecting; role-based contacts preferred.',
  },
  {
    id: 'apify-serp',
    name: 'Apify Google Search / SERP scraper',
    category: 'Search',
    sourceType: 'search_engine',
    allowedUse: 'Resolve official website / presence per registry account (URLs/titles only).',
    disallowedUse: 'No personal data; Google ToS disallows automated SERP — keep volume low.',
    riskLevel: 'medium',
    fieldsAvailable: ['officialUrl', 'presence'],
    productionStatus: 'prototype',
    notes: 'Discovery-only; swap to a licensed Search API to scale. Revisit before production.',
  },
  {
    id: 'apify-contact-scraper',
    name: 'Apify contact-details / email scraper (own domain)',
    category: 'Own site',
    sourceType: 'own_website',
    allowedUse: "Published role-based business contacts from the dealer's OWN domain.",
    disallowedUse: 'No mass-harvesting of personal emails (CASL); own-domain + role-based only.',
    riskLevel: 'high',
    fieldsAvailable: ['roleBasedContact'],
    productionStatus: 'legal_review',
    notes: 'Legal review required before production; restrict strictly to own-domain + role-based.',
  },
  {
    id: 'apify-maps-places',
    name: 'Apify Google Maps / Local Business scraper',
    category: 'Maps',
    sourceType: 'maps_platform',
    allowedUse: 'Validation only: category, hours, ratings — then re-source compliantly.',
    disallowedUse: 'Google Maps ToS prohibits scraping; reviews/personal data raise PIPEDA.',
    riskLevel: 'blocked',
    fieldsAvailable: ['category', 'hours', 'rating'],
    productionStatus: 'blocked',
    notes: 'Do not use for production prospecting; replace with Places API / registry.',
  },
  {
    id: 'hunter',
    name: 'Hunter (email discovery + verification)',
    category: 'Enrichment',
    sourceType: 'enrichment_api',
    allowedUse:
      'Discover/verify role-based business contact + deliverability confidence from a domain.',
    disallowedUse: 'No sensitive personal data; CASL-defensible business contacts only.',
    riskLevel: 'low',
    fieldsAvailable: ['roleBasedContact', 'deliverabilityConfidence'],
    productionStatus: 'production',
    notes: 'Pilot core — cheapest verified business contact. Licensed provider.',
  },
  {
    id: 'apollo',
    name: 'Apollo (B2B contact + company DB)',
    category: 'Enrichment',
    sourceType: 'enrichment_api',
    allowedUse: 'Selective decision-maker fill: name, title, business contact, firmographics.',
    disallowedUse: 'Use sparingly; no sensitive personal data; human review of basis.',
    riskLevel: 'medium',
    fieldsAvailable: ['contactName', 'contactRole', 'firmographics'],
    productionStatus: 'production',
    notes: 'Selective use to fill GM/decision-maker gaps. Verify contact basis on import.',
  },
  {
    id: 'people-data-labs',
    name: 'People Data Labs (bulk enrichment)',
    category: 'Enrichment',
    sourceType: 'enrichment_api',
    allowedUse: 'Deferred: bulk person/company enrichment at scale.',
    disallowedUse: 'Overkill for one metro; do not enable in pilot.',
    riskLevel: 'medium',
    fieldsAvailable: ['firmographics'],
    productionStatus: 'prototype',
    notes: 'Deferred to scale (beyond Vancouver). Review before enabling.',
  },
  {
    id: 'clay',
    name: 'Clay (waterfall orchestration)',
    category: 'Enrichment',
    sourceType: 'enrichment_api',
    allowedUse: 'Deferred: orchestrate multiple licensed providers.',
    disallowedUse: 'Adds cost/complexity; reproduce a simple waterfall manually in pilot.',
    riskLevel: 'medium',
    fieldsAvailable: ['firmographics'],
    productionStatus: 'prototype',
    notes: 'Deferred to scale; inherits the risk of whatever it orchestrates.',
  },
];

/** Look up a declared source by id. */
export function getDataSource(id: string): DataSource | undefined {
  return DATA_SOURCES.find((s) => s.id === id);
}

/**
 * Whether a source may be used for prospecting at all. Mirrors the core
 * `canUseSourceForProspecting(source)` rule (blocked by risk OR production
 * status). Kept local so the web bundle does not import core's runtime; the
 * test asserts parity with the core helper.
 */
export function isSourceUsable(source: DataSource): boolean {
  return source.riskLevel !== 'blocked' && source.productionStatus !== 'blocked';
}
