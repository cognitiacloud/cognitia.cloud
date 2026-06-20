import { describe, expect, it } from 'vitest';
import { assertContactCallable, isContactCallable, type ConsentStatus } from './consent';

describe('consent gate', () => {
  it('allows contactable states', () => {
    for (const status of ['unknown', 'opted_in'] as ConsentStatus[]) {
      expect(isContactCallable(status)).toBe(true);
      expect(() => assertContactCallable(status)).not.toThrow();
    }
  });

  it('blocks opted_out and dnc', () => {
    for (const status of ['opted_out', 'dnc'] as ConsentStatus[]) {
      expect(isContactCallable(status)).toBe(false);
      expect(() => assertContactCallable(status)).toThrow(/opted out|do-not-call/i);
    }
  });
});
