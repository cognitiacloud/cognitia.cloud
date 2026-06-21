/**
 * Synthetic fixtures for the Sales Closer workflow. NO real PII — all values are
 * invented and use the reserved `example.com` domain. Raw `contactEmail`/
 * `contactPhone` here are deliberately present to prove they are dropped by
 * normalization; they are fake.
 */

import type { RawGtmProspectInput } from '@cognitia/core';
import type { CloserLeadIntake } from './types.js';

const DEFAULT_TENANT_ID = '11111111-1111-4111-8111-111111111111';
const DEFAULT_LEAD_REF = 'lead:22222222-2222-4222-8222-222222222222';
const DEFAULT_PROSPECT_ID = '33333333-3333-4333-8333-333333333333';

function defaultProspect(): RawGtmProspectInput {
  return {
    id: DEFAULT_PROSPECT_ID,
    companyName: 'Northwind Auto Group',
    website: 'https://northwind-auto.example.com',
    city: 'Austin',
    provinceOrState: 'TX',
    country: 'US',
    businessType: 'independent_dealer',
    source: 'industry_directory',
    sourceUrl: 'https://directory.example.com/northwind-auto',
    sourceRisk: 'low',
    contactName: 'Pat Rivera',
    contactRole: 'General Manager',
    // Fake raw PII — normalization hashes/masks and drops these.
    contactEmail: 'pat@northwind-auto.example.com',
    contactPhone: '+1-555-0100',
    contactBasis: 'conspicuously_published_business_contact',
    consentStatus: 'implied_possible',
    unsubscribeStatus: 'subscribed',
    doNotContact: false,
    fitScore: 0.72,
  };
}

export interface CloserLeadIntakeOverrides {
  tenantId?: string;
  leadRef?: string;
  prospect?: Partial<RawGtmProspectInput>;
}

/** Build a valid, contactable synthetic lead intake (happy path by default). */
export function makeCloserLeadIntake(overrides: CloserLeadIntakeOverrides = {}): CloserLeadIntake {
  return {
    tenantId: overrides.tenantId ?? DEFAULT_TENANT_ID,
    leadRef: overrides.leadRef ?? DEFAULT_LEAD_REF,
    prospect: { ...defaultProspect(), ...overrides.prospect },
  };
}

/** The ways a lead can fail the compliance gate (for blocked-path tests). */
export type CloserBlockKind = 'do_not_contact' | 'unsubscribed' | 'consent_do_not_contact';

/** Build a synthetic lead intake that the compliance gate must block. */
export function makeBlockedLeadIntake(
  kind: CloserBlockKind,
  overrides: CloserLeadIntakeOverrides = {},
): CloserLeadIntake {
  const prospect: Partial<RawGtmProspectInput> =
    kind === 'do_not_contact'
      ? { doNotContact: true }
      : kind === 'unsubscribed'
        ? { unsubscribeStatus: 'unsubscribed' }
        : { consentStatus: 'do_not_contact' };
  return makeCloserLeadIntake({
    ...overrides,
    prospect: { ...prospect, ...overrides.prospect },
  });
}
