import type { FixtureLead, TenantId } from '../types.js';

/**
 * PII-safe fixture leads. Every contact field uses reserved fictional forms:
 * `.example` email addresses (RFC 6761) and `555-01xx` NANP phone numbers. No
 * real prospect data ever appears here; this is enforced by the PII guard tests.
 *
 * The set covers the happy path plus one lead per blocked compliance reason.
 */
export const FIXTURE_LEADS: FixtureLead[] = [
  // --- budget_wheels_demo ---
  {
    id: 'lead_bw_001',
    tenantId: 'budget_wheels_demo',
    displayName: 'Avery Sample',
    email: 'avery@budget-wheels.example',
    phone: '+1-202-555-0142',
    consent: {
      contact: true,
      grantedAt: '2026-01-02T09:00:00.000Z',
      basis: 'explicit_optin',
      revoked: false,
    },
    suppressed: false,
    source: 'fixture:webform',
  },
  {
    id: 'lead_bw_002',
    tenantId: 'budget_wheels_demo',
    displayName: 'Blair Placeholder',
    email: 'blair@budget-wheels.example',
    phone: '+1-202-555-0173',
    consent: {
      contact: false,
      grantedAt: '2026-01-02T09:05:00.000Z',
      basis: 'explicit_optin',
      revoked: false,
    },
    suppressed: false,
    source: 'fixture:webform',
  },
  {
    id: 'lead_bw_003',
    tenantId: 'budget_wheels_demo',
    displayName: 'Casey Specimen',
    email: 'casey@budget-wheels.example',
    phone: '+1-202-555-0188',
    consent: {
      contact: true,
      grantedAt: '2026-01-02T09:10:00.000Z',
      basis: 'existing_relationship',
      revoked: false,
    },
    suppressed: true,
    source: 'fixture:referral',
  },
  // --- demandara_internal ---
  {
    id: 'lead_dm_001',
    tenantId: 'demandara_internal',
    displayName: 'Dana Example',
    email: 'dana@demandara.example',
    phone: '+1-202-555-0150',
    consent: {
      contact: true,
      grantedAt: '2026-01-03T10:00:00.000Z',
      basis: 'explicit_optin',
      revoked: false,
    },
    suppressed: false,
    source: 'fixture:webform',
  },
  {
    id: 'lead_dm_002',
    tenantId: 'demandara_internal',
    displayName: 'Erin Mock',
    email: 'erin@demandara.example',
    phone: '+1-202-555-0161',
    consent: {
      contact: true,
      grantedAt: '2026-01-03T10:05:00.000Z',
      basis: 'explicit_optin',
      revoked: true,
    },
    suppressed: false,
    source: 'fixture:referral',
  },
  // --- cognitia_internal ---
  {
    id: 'lead_cg_001',
    tenantId: 'cognitia_internal',
    displayName: 'Frankie Demo',
    email: 'frankie@cognitia.example',
    phone: '+1-202-555-0117',
    consent: {
      contact: true,
      grantedAt: '2026-01-04T11:00:00.000Z',
      basis: 'explicit_optin',
      revoked: false,
    },
    suppressed: false,
    source: 'fixture:webform',
  },
];

export function leadById(id: string): FixtureLead | null {
  return FIXTURE_LEADS.find((l) => l.id === id) ?? null;
}

export function leadsForTenant(tenantId: TenantId): FixtureLead[] {
  return FIXTURE_LEADS.filter((l) => l.tenantId === tenantId);
}
