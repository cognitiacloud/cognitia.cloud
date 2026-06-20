import type { ApifyConfig } from './types.js';

/**
 * The ONLY env boundary for the Apify module. Pure modules (policy, normalizers,
 * redaction, fixtures) never read process.env — they receive resolved config.
 * Defaults are simulation-first: no network, no live tests, low item cap.
 *
 * Env vars (see .env.example):
 *   APIFY_TOKEN, CLOSER_APIFY_ALLOW_NETWORK, CLOSER_APIFY_LIVE_TESTS,
 *   CLOSER_APIFY_MAX_ITEMS, CLOSER_APIFY_DEFAULT_TIMEOUT_MS
 */

/** Absolute upper bound on items per run — no request/config can exceed this. */
export const HARD_MAX_APIFY_ITEMS = 500;

const DEFAULT_MAX_ITEMS = 25;
const DEFAULT_TIMEOUT_MS = 30_000;

function boolEnv(value: string | undefined): boolean {
  return value === 'true' || value === '1';
}

function intEnv(value: string | undefined, fallback: number): number {
  const n = value === undefined ? NaN : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * Resolve Apify config from an env bag (defaults to process.env). Pass an
 * explicit object in tests — never read process.env from pure modules. The
 * resolved `maxItems` is itself clamped to HARD_MAX_APIFY_ITEMS.
 */
export function loadApifyConfig(env: NodeJS.ProcessEnv = process.env): ApifyConfig {
  const token = env.APIFY_TOKEN?.trim();
  return {
    token: token && token.length > 0 ? token : undefined,
    allowNetwork: boolEnv(env.CLOSER_APIFY_ALLOW_NETWORK),
    liveTests: boolEnv(env.CLOSER_APIFY_LIVE_TESTS),
    maxItems: Math.min(intEnv(env.CLOSER_APIFY_MAX_ITEMS, DEFAULT_MAX_ITEMS), HARD_MAX_APIFY_ITEMS),
    defaultTimeoutMs: intEnv(env.CLOSER_APIFY_DEFAULT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
  };
}

/** A safe fixture-only config for tests/dev (no token, no network). */
export function fixtureApifyConfig(overrides: Partial<ApifyConfig> = {}): ApifyConfig {
  return {
    token: undefined,
    allowNetwork: false,
    liveTests: false,
    maxItems: DEFAULT_MAX_ITEMS,
    defaultTimeoutMs: DEFAULT_TIMEOUT_MS,
    ...overrides,
  };
}
