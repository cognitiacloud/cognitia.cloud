import { describe, it, expect } from 'vitest';
import { buildAudience, LAWFUL_SOURCE_LABELS, type AudienceInputRow } from './audienceBuilder.js';

/**
 * Fixture rows. PII-safe by construction: every contact value is a `.example`
 * domain or a `555-01xx` test number. No real data.
 */
const FIXTURE_ROWS: AudienceInputRow[] = [
  {
    id: 'p-001',
    companyName: 'Northshore Auto Group',
    source: 'consented_csv',
    fit: 0.9,
    urgency: 0.8,
    consentBasis: 'explicit_consent',
    evidence: 'verified_fact',
    region: 'BC',
    contactEmailExample: 'sales@northshore-auto.example',
    contactPhoneExample: '555-0123',
  },
  {
    id: 'p-002',
    companyName: 'Budget Wheels Demo',
    source: 'manual',
    fit: 0.6,
    urgency: 0.5,
    consentBasis: 'legitimate_interest',
    evidence: 'likely_inference',
    region: 'ON',
  },
  {
    id: 'p-003',
    companyName: 'Westfield Motors',
    source: 'public_site_manual_review',
    fit: 0.5,
    urgency: 0.3,
    consentBasis: 'not_established',
    evidence: 'unknown',
  },
  {
    id: 'p-bad',
    companyName: 'Scraped Co',
    source: 'maps_platform_scrape',
  },
];

describe('buildAudience — validation & rejection', () => {
  it('rejects disallowed source types with a clear reason', () => {
    const { rejected, prospects } = buildAudience(FIXTURE_ROWS);
    expect(prospects.find((p) => p.id === 'p-bad')).toBeUndefined();
    const bad = rejected.find((r) => r.id === 'p-bad');
    expect(bad).toBeDefined();
    expect(bad?.reason).toContain('disallowed_source');
    expect(bad?.reason).toContain('maps_platform_scrape');
  });

  it('rejects every non-lawful source label', () => {
    const rows: AudienceInputRow[] = [
      { id: 'a', companyName: 'A', source: 'apify' },
      { id: 'b', companyName: 'B', source: 'google_maps' },
      { id: 'c', companyName: 'C', source: '' },
    ];
    const { prospects, rejected } = buildAudience(rows);
    expect(prospects).toHaveLength(0);
    expect(rejected).toHaveLength(3);
    for (const r of rejected) expect(r.reason).toContain('disallowed_source');
  });

  it('accepts every documented lawful source label', () => {
    const rows: AudienceInputRow[] = LAWFUL_SOURCE_LABELS.map((source, i) => ({
      id: `ok-${i}`,
      companyName: `Co ${i}`,
      source,
    }));
    const { prospects, rejected } = buildAudience(rows);
    expect(rejected).toHaveLength(0);
    expect(prospects).toHaveLength(LAWFUL_SOURCE_LABELS.length);
  });

  it('rejects rows with a missing id', () => {
    const { rejected } = buildAudience([{ id: '', companyName: 'X', source: 'manual' }]);
    expect(rejected[0]?.reason).toContain('missing_id');
  });
});

describe('buildAudience — ranking', () => {
  it('ranks prospects by score descending', () => {
    const { prospects } = buildAudience(FIXTURE_ROWS);
    const ids = prospects.map((p) => p.id);
    expect(ids).toEqual(['p-001', 'p-002', 'p-003']);
    for (let i = 1; i < prospects.length; i++) {
      expect(prospects[i - 1]!.score.score).toBeGreaterThanOrEqual(prospects[i]!.score.score);
    }
  });

  it('breaks score ties by id ascending (deterministic)', () => {
    const tie: AudienceInputRow[] = [
      { id: 'z', companyName: 'Z', source: 'manual', fit: 0.5, urgency: 0.5 },
      { id: 'a', companyName: 'A', source: 'manual', fit: 0.5, urgency: 0.5 },
      { id: 'm', companyName: 'M', source: 'manual', fit: 0.5, urgency: 0.5 },
    ];
    const { prospects } = buildAudience(tie);
    expect(prospects.map((p) => p.id)).toEqual(['a', 'm', 'z']);
  });

  it('is deterministic across runs', () => {
    expect(buildAudience(FIXTURE_ROWS)).toEqual(buildAudience(FIXTURE_ROWS));
  });
});

describe('buildAudience — evidence tags & breakdown', () => {
  it('attaches evidence/provenance tags including SANDBOX/PLANNED labels', () => {
    const { prospects } = buildAudience(FIXTURE_ROWS);
    const p1 = prospects.find((p) => p.id === 'p-001')!;
    expect(p1.evidenceTags).toContain('source:consented_csv');
    expect(p1.evidenceTags).toContain('consent:explicit_consent');
    expect(p1.evidenceTags).toContain('evidence:verified_fact');
    expect(p1.evidenceTags).toContain('label:SANDBOX');
  });

  it('marks the planned licensed provider with label:PLANNED and high source risk', () => {
    const { prospects } = buildAudience([
      { id: 'pl', companyName: 'Future Co', source: 'licensed_provider_planned' },
    ]);
    const p = prospects[0]!;
    expect(p.evidenceTags).toContain('label:PLANNED');
    expect(p.sourceRisk).toBe('high');
  });

  it('exposes a transparent per-component score breakdown', () => {
    const { prospects } = buildAudience(FIXTURE_ROWS);
    const p1 = prospects.find((p) => p.id === 'p-001')!;
    expect(p1.score.breakdown).toHaveProperty('fit');
    expect(p1.score.breakdown).toHaveProperty('consentRiskPenalty');
    expect(p1.score.breakdown).toHaveProperty('sourceRiskPenalty');
    expect(p1.score.breakdown.consentRiskPenalty).toBeLessThanOrEqual(0);
  });
});

describe('buildAudience — PII safety', () => {
  it('keeps only `.example` emails and `555-01xx` phones', () => {
    const { prospects } = buildAudience(FIXTURE_ROWS);
    const p1 = prospects.find((p) => p.id === 'p-001')!;
    expect(p1.contactEmailExample).toBe('sales@northshore-auto.example');
    expect(p1.contactPhoneExample).toBe('555-0123');
  });

  it('drops unsafe (real-looking) contact values and tags the drop', () => {
    const { prospects } = buildAudience([
      {
        id: 'leaky',
        companyName: 'Leaky Co',
        source: 'manual',
        contactEmailExample: 'jane.doe@gmail.com',
        contactPhoneExample: '604-555-9999',
      },
    ]);
    const p = prospects[0]!;
    expect(p.contactEmailExample).toBeNull();
    expect(p.contactPhoneExample).toBeNull();
    expect(p.evidenceTags).toContain('dropped_unsafe_email');
    expect(p.evidenceTags).toContain('dropped_unsafe_phone');
  });

  it('asserts no raw PII anywhere in serialized output', () => {
    const result = buildAudience(FIXTURE_ROWS);
    const serialized = JSON.stringify(result);
    // No real TLDs / common PII domains.
    expect(serialized).not.toMatch(/@(gmail|yahoo|hotmail|outlook)\./i);
    expect(serialized).not.toMatch(/\.(com|net|org|ca)\b/);
    // Any phone-shaped string must be a 555-01xx test number.
    const phoneLike = serialized.match(/\b\d{3}[\s.-]?\d{4}\b/g) ?? [];
    for (const ph of phoneLike) expect(ph).toMatch(/555[\s.-]?01\d{2}/);
  });
});
