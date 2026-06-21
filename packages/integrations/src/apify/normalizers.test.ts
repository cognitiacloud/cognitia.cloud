import { describe, it, expect } from 'vitest';
import { piiHash } from '@cognitia/core';
import {
  buildCloserDedupeKey,
  extractBusinessDomain,
  normalizeBusinessName,
  normalizeDatasetItem,
  normalizeDatasetItems,
  type NormalizeOptions,
} from './normalizers.js';
import { getActorConfig } from './policy.js';
import { normalizePhoneToDigits } from './redaction.js';

const actor = getActorConfig('apify/google-places-scraper')!;
const opts: NormalizeOptions = {
  sourceId: 'src-1',
  actor,
  providerRunId: 'run-1',
  collectedAt: '2026-06-20T00:00:00.000Z',
};

describe('domain + name normalization', () => {
  it('extracts a bare domain from messy urls', () => {
    expect(extractBusinessDomain('https://www.AcmeToyota.example/north?x=1')).toBe(
      'acmetoyota.example',
    );
    expect(extractBusinessDomain('http://acmetoyota.example')).toBe('acmetoyota.example');
    expect(extractBusinessDomain('not a url')).toBeNull();
    expect(extractBusinessDomain(null)).toBeNull();
  });

  it('slugs business names deterministically', () => {
    expect(normalizeBusinessName('  Acme  Toyota! ')).toBe('acme-toyota');
  });
});

describe('dedupe keys are stable and never use email/phone', () => {
  it('prefers the website domain across url variations', () => {
    const a = buildCloserDedupeKey({
      sourceId: 'src-1',
      website: 'https://www.acmetoyota.example/north',
      accountName: 'Acme Toyota (North)',
      city: 'Toronto',
      provinceOrState: 'ON',
    });
    const b = buildCloserDedupeKey({
      sourceId: 'src-1',
      website: 'http://acmetoyota.example',
      accountName: 'Acme Toyota',
      city: 'Toronto',
      provinceOrState: 'ON',
    });
    expect(a).toBe('domain:acmetoyota.example');
    expect(a).toBe(b);
  });

  it('falls back to name+geo slug when no website', () => {
    const key = buildCloserDedupeKey({
      sourceId: 'src-1',
      website: null,
      accountName: 'Lakeside Honda',
      city: 'Hamilton',
      provinceOrState: 'ON',
    });
    expect(key).toBe('name:src-1|lakeside-honda|hamilton|on');
  });
});

describe('normalizeDatasetItem — redaction + hashing', () => {
  const item = {
    name: 'Acme Toyota',
    website: 'https://acmetoyota.example',
    city: 'Toronto',
    state: 'ON',
    country: 'CA',
    category: 'Toyota dealer',
    rating: 4.4,
    reviewsCount: 812,
    url: 'https://maps.example/place/acme-toyota',
    phone: '+1 (416) 555-0100',
    ownerName: 'Demo Owner',
    contactEmail: 'Sales@AcmeToyota.example',
    contact: { fullName: 'Nested Person', email: 'nested@acmetoyota.example' },
  };

  it('strips all direct PII keys from rawRedacted (including nested)', () => {
    const record = normalizeDatasetItem(item, opts)!;
    const raw = JSON.stringify(record.rawRedacted).toLowerCase();
    for (const banned of ['phone', 'owner', 'email', 'fullname']) {
      expect(raw).not.toContain(banned);
    }
    // raw values themselves never appear anywhere in the record
    const whole = JSON.stringify(record).toLowerCase();
    expect(whole).not.toContain('sales@acmetoyota.example');
    expect(whole).not.toContain('nested person');
    expect(whole).not.toContain('14165550100');
    expect(whole).not.toContain('demo owner');
  });

  it('produces deterministic, non-reversible contact hashes', () => {
    const record = normalizeDatasetItem(item, opts)!;
    expect(record.contactHashes?.emailHash).toBe(piiHash('sales@acmetoyota.example'));
    expect(record.contactHashes?.emailHash).toMatch(/^[a-f0-9]{64}$/);
    expect(record.contactHashes?.phoneHash).toBe(
      piiHash(normalizePhoneToDigits('+1 (416) 555-0100')),
    );
  });

  it('preserves company fields + evidence', () => {
    const record = normalizeDatasetItem(item, opts)!;
    expect(record.accountName).toBe('Acme Toyota');
    expect(record.website).toBe('https://acmetoyota.example');
    expect(record.rating).toBe(4.4);
    expect(record.reviewCount).toBe(812);
    expect(record.evidence).toMatchObject({
      sourceUrl: 'https://maps.example/place/acme-toyota',
      actorId: actor.actorId,
      providerRunId: 'run-1',
      collectedAt: '2026-06-20T00:00:00.000Z',
    });
    expect(record.complianceFlags).toContain('redacted_contact_fields');
  });

  it('skips items with no usable company identity', () => {
    expect(normalizeDatasetItem({ rating: 5 }, opts)).toBeNull();
    const { records, skipped } = normalizeDatasetItems([{ rating: 5 }, item], opts);
    expect(records).toHaveLength(1);
    expect(skipped).toBe(1);
  });
});
