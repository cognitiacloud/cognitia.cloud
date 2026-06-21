import type { RawGtmProspectInput } from '@cognitia/core';

/**
 * A single mock-safe fixture lead for the Sales Closer workflow.
 *
 * Business-only: company, website, region, role, lawful basis. There is NO
 * contact email/phone and NO raw PII — `normalizeGtmProspect` would hash/drop
 * those anyway, but the fixture omits them so nothing sensitive ever exists.
 * `consentStatus: 'implied_possible'` keeps the lead contactable so the happy
 * path can proceed; tests override these fields to exercise blocked branches.
 */
export const FIXTURE_LEAD: RawGtmProspectInput = {
  companyName: 'Northshore Auto Group',
  website: 'https://northshore-auto.example',
  city: 'Vancouver',
  provinceOrState: 'BC',
  country: 'CA',
  businessType: 'auto_dealership',
  source: 'public_registry',
  sourceUrl: 'https://registry.example/northshore-auto',
  sourceRisk: 'low',
  contactRole: 'General Manager',
  contactBasis: 'conspicuously_published_business_contact',
  consentStatus: 'implied_possible',
  unsubscribeStatus: 'subscribed',
  doNotContact: false,
};
