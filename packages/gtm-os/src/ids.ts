import { randomUUID } from 'node:crypto';
import type { RuntimeEnv } from './types.js';

/**
 * Runtime environments supply the only two sources of nondeterminism in the
 * substrate: the clock and id generation. Injecting them keeps runs (and their
 * hash chains) fully reproducible in tests and demos.
 */

/** Production-style env: real wall clock + random UUIDs. */
export function createSystemEnv(): RuntimeEnv {
  return {
    now: () => new Date().toISOString(),
    id: (prefix: string) => `${prefix}_${randomUUID()}`,
  };
}

/**
 * Deterministic env for tests/demos. The clock advances by one second on each
 * read starting from `startIso`; ids are monotonic per prefix.
 */
export function createDeterministicEnv(startIso = '2026-01-01T00:00:00.000Z'): RuntimeEnv {
  const base = Date.parse(startIso);
  let clockTick = 0;
  const counters = new Map<string, number>();
  return {
    now: () => new Date(base + clockTick++ * 1000).toISOString(),
    id: (prefix: string) => {
      const next = (counters.get(prefix) ?? 0) + 1;
      counters.set(prefix, next);
      return `${prefix}_${String(next).padStart(4, '0')}`;
    },
  };
}
