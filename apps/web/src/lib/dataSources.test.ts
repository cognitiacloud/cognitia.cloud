import { describe, it, expect } from 'vitest';
import { canUseSourceForProspecting } from '@cognitia/core';
import { DATA_SOURCES, getDataSource, isSourceUsable } from './dataSources.js';

describe('data source matrix (uses the @cognitia/core DataSource shape)', () => {
  it('includes the registry spine and enrichment providers', () => {
    const ids = DATA_SOURCES.map((s) => s.id);
    expect(ids).toContain('vsa-registry');
    expect(ids).toContain('hunter');
    expect(ids).toContain('apify-maps-places');
  });

  it('every source declares allowed + disallowed use, a sourceType, and notes', () => {
    for (const s of DATA_SOURCES) {
      expect(s.allowedUse.length).toBeGreaterThan(0);
      expect(s.disallowedUse.length).toBeGreaterThan(0);
      expect(s.notes.length).toBeGreaterThan(0);
      expect(s.sourceType.length).toBeGreaterThan(0);
      expect(s.fieldsAvailable.length).toBeGreaterThan(0);
    }
  });
});

describe('isSourceUsable mirrors core canUseSourceForProspecting', () => {
  it('agrees with the core helper for every declared source', () => {
    for (const s of DATA_SOURCES) {
      expect(isSourceUsable(s)).toBe(canUseSourceForProspecting(s));
    }
  });

  it('blocks the Maps/Places source and allows production-safe sources', () => {
    const maps = getDataSource('apify-maps-places')!;
    expect(isSourceUsable(maps)).toBe(false);
    expect(canUseSourceForProspecting(maps)).toBe(false);

    for (const id of ['vsa-registry', 'hunter', 'apollo']) {
      const s = getDataSource(id)!;
      expect(isSourceUsable(s)).toBe(true);
    }
  });

  it('getDataSource resolves a known source and returns undefined otherwise', () => {
    expect(getDataSource('hunter')?.name).toMatch(/Hunter/);
    expect(getDataSource('nope')).toBeUndefined();
  });
});
