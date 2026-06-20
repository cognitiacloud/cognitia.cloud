import type { GtmProspect } from '@cognitia/core';
import type { EvidenceField } from './complianceTypes';

/**
 * Demo seed data for the compliance surfaces. Local-first / demo-safe: fictional
 * dealership PROSPECTS (B2B), not consumer car-shopper leads.
 *
 * PII doctrine (matches #97): NO raw `contactEmail` / `contactPhone` anywhere —
 * only masked + domain fields, and evidence values carry business facts (company,
 * role, source URL), never raw contact PII. Prospects are built as fully-typed
 * literals (not via core's runtime `normalizeGtmProspect`) to keep the web bundle
 * free of core's runtime.
 */

/** A demo prospect paired with its compliance evidence (evidence is not on GtmProspect). */
export interface DemoProspectRecord {
  prospect: GtmProspect;
  evidence: EvidenceField[];
}

function buildProspect(
  partial: Partial<GtmProspect> & Pick<GtmProspect, 'id' | 'companyName' | 'source'>,
): GtmProspect {
  return {
    website: null,
    city: null,
    provinceOrState: null,
    country: 'CA',
    businessType: 'Franchise dealership',
    inventoryModelGuess: null,
    sourceUrl: null,
    sourceRisk: 'medium',
    contactName: null,
    contactRole: null,
    contactEmailHash: null,
    contactPhoneHash: null,
    contactEmailMasked: null,
    contactPhoneMasked: null,
    contactDomain: null,
    contactBasis: 'unknown',
    consentStatus: 'not_established',
    unsubscribeStatus: 'subscribed',
    doNotContact: false,
    fitScore: 0,
    packageFit: null,
    discoveryStatus: 'not_started',
    proposalStatus: 'none',
    assignedOwner: null,
    lastContactedAt: null,
    nextStep: null,
    notes: null,
    createdAt: '2026-06-01T12:00:00.000Z',
    updatedAt: '2026-06-05T09:00:00.000Z',
    ...partial,
  };
}

function evidence(over: Partial<EvidenceField> = {}): EvidenceField {
  return {
    sourceUrl: 'https://example-vsa.ca/licensee/example',
    sourceName: 'VSA licensed-dealer registry',
    capturedAt: '2026-06-01T12:00:00.000Z',
    capturedBy: 'system:registry-import',
    fieldName: 'companyName',
    fieldValue: 'Example Dealer Group',
    confidence: 'high',
    notes: 'Business fact from a public registry — no contact PII.',
    ...over,
  };
}

/** Clean B2B prospect: tracked basis, complete evidence, PII-safe masked contact. */
const cleanB2b: DemoProspectRecord = {
  prospect: buildProspect({
    id: 'prospect:northshore-auto',
    companyName: 'North Shore Auto Group',
    website: 'https://northshore-auto.example.ca',
    city: 'North Vancouver',
    provinceOrState: 'BC',
    source: 'vsa-registry',
    sourceUrl: 'https://example-vsa.ca/licensee/northshore',
    sourceRisk: 'low',
    contactName: 'J. Operator',
    contactRole: 'General Sales Manager',
    contactEmailMasked: 's***@northshore-auto.example.ca',
    contactPhoneMasked: '***-***-0100',
    contactDomain: 'northshore-auto.example.ca',
    contactBasis: 'conspicuously_published_business_contact',
    consentStatus: 'implied_possible',
    fitScore: 82,
    packageFit: 'Sales Closer — Pilot',
    discoveryStatus: 'researching',
  }),
  evidence: [
    evidence({
      sourceUrl: 'https://example-vsa.ca/licensee/northshore',
      fieldValue: 'North Shore Auto Group',
    }),
    evidence({
      fieldName: 'contactRole',
      fieldValue: 'General Sales Manager',
      sourceName: 'Dealer own website',
      sourceUrl: 'https://northshore-auto.example.ca/about/team',
    }),
  ],
};

/** Unsubscribed — must be blocked on every channel. */
const unsubscribed: DemoProspectRecord = {
  prospect: buildProspect({
    id: 'prospect:fraser-motors',
    companyName: 'Fraser Valley Motors',
    city: 'Surrey',
    provinceOrState: 'BC',
    source: 'ncda-bc',
    sourceRisk: 'low',
    contactBasis: 'existing_business_relationship',
    consentStatus: 'implied_possible',
    unsubscribeStatus: 'unsubscribed',
  }),
  evidence: [
    evidence({
      sourceName: 'NCDA BC directory',
      sourceUrl: 'https://example-ncda.ca/fraser',
      fieldValue: 'Fraser Valley Motors',
    }),
  ],
};

/** Internal do-not-contact — must be blocked on every channel. */
const doNotContact: DemoProspectRecord = {
  prospect: buildProspect({
    id: 'prospect:peak-auto',
    companyName: 'Peak Auto Sales',
    city: 'Burnaby',
    provinceOrState: 'BC',
    source: 'oem-locators',
    sourceRisk: 'low',
    contactBasis: 'referral',
    consentStatus: 'do_not_contact',
    doNotContact: true,
  }),
  evidence: [evidence({ sourceName: 'OEM locator', fieldValue: 'Peak Auto Sales' })],
};

/** High-risk source — requires human review. */
const highRiskSource: DemoProspectRecord = {
  prospect: buildProspect({
    id: 'prospect:metro-imports',
    companyName: 'Metro Imports',
    city: 'Richmond',
    provinceOrState: 'BC',
    source: 'apify-contact-scraper',
    sourceRisk: 'high',
    contactBasis: 'conspicuously_published_business_contact',
    consentStatus: 'implied_possible',
  }),
  evidence: [
    evidence({ sourceName: 'Apify contact scraper (own domain)', fieldValue: 'Metro Imports' }),
  ],
};

/** Consent not established + no evidence — requires human review. */
const unknownBasis: DemoProspectRecord = {
  prospect: buildProspect({
    id: 'prospect:coast-cars',
    companyName: 'Coastline Cars',
    city: 'Coquitlam',
    provinceOrState: 'BC',
    source: 'apify-serp',
    sourceRisk: 'medium',
    contactBasis: 'unknown',
    consentStatus: 'not_established',
  }),
  evidence: [],
};

export const DEMO_PROSPECTS: readonly DemoProspectRecord[] = [
  cleanB2b,
  unsubscribed,
  doNotContact,
  highRiskSource,
  unknownBasis,
];

export const DEMO_PROSPECTS_BY_ID: Readonly<Record<string, DemoProspectRecord>> =
  Object.fromEntries(DEMO_PROSPECTS.map((r) => [r.prospect.id, r]));
