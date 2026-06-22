import { describe, expect, it } from 'vitest';
import { normalizeAppState } from './normalize';

const defaults = {
  role: 'dealer_owner',
  leads: [{ id: 'seed' }],
  customers: [{ id: 'C1' }],
  proposals: [],
};

describe('normalizeAppState', () => {
  it('keeps default slices that are missing from an older snapshot', () => {
    // An older localStorage snapshot predates `customers` / `proposals`.
    const stored = { role: 'sales_manager', leads: [{ id: 'runtime' }] };
    const out = normalizeAppState(stored, defaults);
    expect(out.role).toBe('sales_manager');
    expect(out.leads).toEqual([{ id: 'runtime' }]);
    expect(out.customers).toEqual([{ id: 'C1' }]); // fell back to seed
    expect(out.proposals).toEqual([]);
  });

  it('ignores a stored value whose shape does not match the default', () => {
    const out = normalizeAppState({ leads: 'not-an-array', role: 42 }, defaults);
    expect(out.leads).toEqual([{ id: 'seed' }]);
    expect(out.role).toBe('dealer_owner');
  });

  it('returns the defaults when the snapshot is missing or corrupt', () => {
    expect(normalizeAppState(null, defaults)).toBe(defaults);
    expect(normalizeAppState('garbage', defaults)).toBe(defaults);
  });
});
