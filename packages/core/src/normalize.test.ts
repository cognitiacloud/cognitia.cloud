import { describe, it, expect } from 'vitest';
import {
  accountDedupeKey,
  canonicalizeDomain,
  contactDedupeKey,
  dedupeRecords,
  normalizeItem,
  signalsHash,
} from './normalize';

describe('canonicalizeDomain', () => {
  it.each([
    ['https://www.Northwind-Robotics.com/', 'northwind-robotics.com'],
    ['http://Brightwave-Health.com', 'brightwave-health.com'],
    ['dana@northwind-robotics.com', 'northwind-robotics.com'],
    ['cobaltfreight.io/path?q=1', 'cobaltfreight.io'],
  ])('%s -> %s', (input, expected) => {
    expect(canonicalizeDomain(input)).toBe(expected);
  });
});

describe('contactDedupeKey', () => {
  it('prefers email, lowercased', () => {
    expect(contactDedupeKey({ email: 'Dana@X.com', fullName: 'Dana' })).toBe('dana@x.com');
  });
  it('falls back to normalized name', () => {
    expect(contactDedupeKey({ fullName: '  Dana   Ortiz ' })).toBe('dana ortiz');
  });
});

describe('normalizeItem + dedupeRecords', () => {
  it('returns null when no domain can be derived', () => {
    expect(normalizeItem({ companyName: 'No Domain' })).toBeNull();
  });

  it('dedupes two spellings of the same company by canonical domain', () => {
    const records = [
      { companyName: 'Northwind', website: 'https://www.northwind-robotics.com/' },
      { companyName: 'Northwind', website: 'https://northwind-robotics.com' },
    ]
      .map(normalizeItem)
      .filter((r): r is NonNullable<typeof r> => r !== null);
    expect(dedupeRecords(records)).toHaveLength(1);
    expect(accountDedupeKey('NORTHWIND-ROBOTICS.com')).toBe('northwind-robotics.com');
  });
});

describe('signalsHash', () => {
  it('is order-independent and stable', () => {
    const a = signalsHash([
      { type: 'hiring', value: { x: 1 }, weight: 1 },
      { type: 'tech_stack', value: { y: 2 }, weight: '2' },
    ]);
    const b = signalsHash([
      { type: 'tech_stack', value: { y: 2 }, weight: 2 },
      { type: 'hiring', value: { x: 1 }, weight: '1' },
    ]);
    expect(a).toBe(b);
  });

  it('changes when a signal changes', () => {
    const a = signalsHash([{ type: 'hiring', value: { x: 1 }, weight: 1 }]);
    const b = signalsHash([{ type: 'hiring', value: { x: 2 }, weight: 1 }]);
    expect(a).not.toBe(b);
  });
});
