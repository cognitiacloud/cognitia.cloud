import { describe, it, expect } from 'vitest';
import { loadEnv, resetEnvCache, tierForScore } from './index';

describe('loadEnv', () => {
  it('applies defaults for a minimal environment', () => {
    resetEnvCache();
    const e = loadEnv({});
    expect(e.MOCK_MODE).toBe(true);
    expect(e.VENDOR_NAME).toBe('mock');
    expect(e.LLM_PROVIDER).toBe('mock');
  });

  it('coerces boolish MOCK_MODE strings', () => {
    resetEnvCache();
    expect(loadEnv({ MOCK_MODE: 'false' }).MOCK_MODE).toBe(false);
  });

  it('rejects an invalid vendor name', () => {
    resetEnvCache();
    expect(() => loadEnv({ VENDOR_NAME: 'nope' } as NodeJS.ProcessEnv)).toThrow(
      /Invalid environment/,
    );
  });
});

describe('tierForScore', () => {
  it.each([
    [95, 'A'],
    [80, 'A'],
    [61, 'B'],
    [40, 'C'],
    [10, 'D'],
  ])('maps %i -> %s', (score, tier) => {
    expect(tierForScore(score)).toBe(tier);
  });
});
