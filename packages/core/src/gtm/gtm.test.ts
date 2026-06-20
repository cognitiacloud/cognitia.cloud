import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  canContactProspect,
  canUseSourceForProspecting,
  classifySourceRisk,
  createGtmProofEvent,
  normalizeGtmProspect,
  requiresHumanReviewForOutreach,
  GTM_OUTREACH_REQUIRES_HUMAN_APPROVAL,
} from './index.js';
import type { DataSource, GtmProspect, RawGtmProspectInput, SourceType } from '../types/index.js';

const FIXED_ID = '11111111-1111-1111-1111-111111111111';
const FIXED_NOW = new Date('2026-06-20T00:00:00.000Z');

function source(partial: Partial<DataSource>): DataSource {
  return {
    id: FIXED_ID,
    name: 'Test Source',
    category: 'discovery',
    sourceType: 'public_registry',
    allowedUse: 'discovery',
    disallowedUse: 'none',
    riskLevel: 'low',
    fieldsAvailable: ['name'],
    productionStatus: 'production',
    notes: '',
    ...partial,
  };
}

function prospect(partial: Partial<GtmProspect>): GtmProspect {
  return {
    ...normalizeGtmProspect(
      { companyName: 'Acme Motors', source: 'vsa' },
      { id: FIXED_ID, now: FIXED_NOW },
    ),
    ...partial,
  };
}

describe('normalizeGtmProspect — PII doctrine (hash/mask only, no raw)', () => {
  const raw: RawGtmProspectInput = {
    companyName: '  Acme Motors  ',
    source: 'vsa',
    contactEmail: '  Jane.Doe@Dealer.COM ',
    contactPhone: '+1 (604) 555-1234',
  };

  it('returns no raw contactEmail / contactPhone keys', () => {
    const p = normalizeGtmProspect(raw, { id: FIXED_ID, now: FIXED_NOW });
    expect('contactEmail' in p).toBe(false);
    expect('contactPhone' in p).toBe(false);
    // And the raw values never leak into any string field.
    const serialized = JSON.stringify(p);
    expect(serialized).not.toContain('Jane.Doe@Dealer.COM');
    expect(serialized.toLowerCase()).not.toContain('jane.doe@dealer.com');
    expect(serialized).not.toContain('6045551234');
  });

  it('lowercases (and trims) email before hashing', () => {
    const upper = normalizeGtmProspect({ companyName: 'A', source: 's', contactEmail: 'A@X.COM' });
    const lower = normalizeGtmProspect({
      companyName: 'A',
      source: 's',
      contactEmail: ' a@x.com ',
    });
    expect(upper.contactEmailHash).toBe(lower.contactEmailHash);
    expect(upper.contactEmailHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces safe masks and a domain, dropping the raw value', () => {
    const p = normalizeGtmProspect(raw, { id: FIXED_ID, now: FIXED_NOW });
    expect(p.contactEmailMasked).toBe('j***@dealer.com');
    expect(p.contactPhoneMasked).toBe('***-***-1234');
    expect(p.contactDomain).toBe('dealer.com');
    // masks reveal neither the full local-part nor the full number
    expect(p.contactEmailMasked).not.toContain('jane');
    expect(p.contactPhoneMasked).not.toContain('6045551234');
  });

  it('hashes phone by digits only (formatting-independent)', () => {
    const a = normalizeGtmProspect({
      companyName: 'A',
      source: 's',
      contactPhone: '(604) 555-1234',
    });
    const b = normalizeGtmProspect({ companyName: 'A', source: 's', contactPhone: '6045551234' });
    expect(a.contactPhoneHash).toBe(b.contactPhoneHash);
  });

  it('leaves hash/mask/domain null when no contact provided', () => {
    const p = normalizeGtmProspect({ companyName: 'A', source: 's' });
    expect(p.contactEmailHash).toBeNull();
    expect(p.contactPhoneHash).toBeNull();
    expect(p.contactEmailMasked).toBeNull();
    expect(p.contactPhoneMasked).toBeNull();
    expect(p.contactDomain).toBeNull();
  });

  it('applies safe consent/contact defaults', () => {
    const p = normalizeGtmProspect({ companyName: 'A', source: 's' });
    expect(p.consentStatus).toBe('not_established');
    expect(p.contactBasis).toBe('unknown');
    expect(p.unsubscribeStatus).toBe('subscribed');
    expect(p.doNotContact).toBe(false);
    expect(p.fitScore).toBe(0);
    expect(p.discoveryStatus).toBe('not_started');
    expect(p.proposalStatus).toBe('none');
  });

  it('trims business strings and honours injected id/timestamps', () => {
    const p = normalizeGtmProspect(raw, { id: FIXED_ID, now: FIXED_NOW });
    expect(p.companyName).toBe('Acme Motors');
    expect(p.id).toBe(FIXED_ID);
    expect(p.createdAt).toBe(FIXED_NOW.toISOString());
    expect(p.updatedAt).toBe(FIXED_NOW.toISOString());
  });
});

describe('canContactProspect — hard blocks', () => {
  it('blocks on do-not-contact', () => {
    expect(canContactProspect(prospect({ doNotContact: true }))).toBe(false);
  });
  it('blocks on unsubscribe', () => {
    expect(canContactProspect(prospect({ unsubscribeStatus: 'unsubscribed' }))).toBe(false);
  });
  it('blocks on consent unsubscribed / do_not_contact', () => {
    expect(canContactProspect(prospect({ consentStatus: 'unsubscribed' }))).toBe(false);
    expect(canContactProspect(prospect({ consentStatus: 'do_not_contact' }))).toBe(false);
  });
  it('allows an otherwise-clean prospect', () => {
    expect(
      canContactProspect(prospect({ consentStatus: 'implied_possible', sourceRisk: 'low' })),
    ).toBe(true);
  });
});

describe('requiresHumanReviewForOutreach', () => {
  it('always-on global approval invariant holds', () => {
    expect(GTM_OUTREACH_REQUIRES_HUMAN_APPROVAL).toBe(true);
  });
  it('requires review when consent is not established', () => {
    expect(requiresHumanReviewForOutreach(prospect({ consentStatus: 'not_established' }))).toBe(
      true,
    );
  });
  it('requires review when sourced at high risk', () => {
    expect(
      requiresHumanReviewForOutreach(prospect({ consentStatus: 'express', sourceRisk: 'high' })),
    ).toBe(true);
  });
  it('no extra gate when consent express and risk low', () => {
    expect(
      requiresHumanReviewForOutreach(prospect({ consentStatus: 'express', sourceRisk: 'low' })),
    ).toBe(false);
  });
});

describe('source guardrails', () => {
  it('blocked sources cannot be used', () => {
    expect(canUseSourceForProspecting(source({ riskLevel: 'blocked' }))).toBe(false);
    expect(canUseSourceForProspecting(source({ productionStatus: 'blocked' }))).toBe(false);
  });
  it('non-blocked sources can be used', () => {
    expect(
      canUseSourceForProspecting(source({ riskLevel: 'high', productionStatus: 'prototype' })),
    ).toBe(true);
  });
  it('classifySourceRisk maps types deterministically', () => {
    const cases: Array<[SourceType, string]> = [
      ['public_registry', 'low'],
      ['own_website', 'low'],
      ['open_data', 'low'],
      ['search_engine', 'medium'],
      ['enrichment_api', 'medium'],
      ['maps_platform', 'high'],
      ['social_platform', 'high'],
      ['other', 'medium'],
    ];
    for (const [type, expected] of cases) {
      expect(classifySourceRisk(source({ sourceType: type }))).toBe(expected);
    }
  });
  it('classifySourceRisk returns blocked when production is blocked', () => {
    expect(
      classifySourceRisk(source({ sourceType: 'public_registry', productionStatus: 'blocked' })),
    ).toBe('blocked');
  });
});

describe('createGtmProofEvent', () => {
  it('builds an append-only event with injected id/timestamp and no PII leakage', () => {
    const event = createGtmProofEvent(
      {
        kind: 'gtm.prospect.sourced.v1',
        subjectType: 'gtm_prospect',
        subjectId: FIXED_ID,
        evidenceTag: 'likely_inference',
        summaryPublic: 'Prospect sourced from approved public registry.',
        detailsPrivate: { sourceUrl: 'https://example.gov/registry' },
        actorRef: 'user:' + FIXED_ID,
      },
      { id: FIXED_ID, occurredAt: FIXED_NOW },
    );
    expect(event.id).toBe(FIXED_ID);
    expect(event.kind).toBe('gtm.prospect.sourced.v1');
    expect(event.occurredAt).toBe(FIXED_NOW.toISOString());
    expect(event.summaryPublic).not.toMatch(/@/); // public summary carries no contact PII
  });
});

describe('separation from customer-lead universe', () => {
  const moduleSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'index.ts'), 'utf8');
  // Inspect only import statements — a doc comment may *name* the customer-lead
  // tables to explain the separation; what matters is that none are imported.
  const importLines = moduleSrc
    .split('\n')
    .filter((line) => /^\s*import\b/.test(line) || /from\s+['"]/.test(line));

  it('the gtm module imports no customer-lead primitives', () => {
    const imports = importLines.join('\n');
    for (const needle of ['lead_intakes', 'lead_rescue', 'leadOutcome', '@cognitia/db', 'leads']) {
      expect(imports).not.toContain(needle);
    }
  });

  it('only imports node:crypto and the local core types', () => {
    const froms = [...moduleSrc.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
    expect(froms.sort()).toEqual(['../types/index.js', 'node:crypto']);
  });
});
