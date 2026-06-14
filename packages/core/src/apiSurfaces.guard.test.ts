import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * VISIBILITY-004 — guards for the public API & surfaces reference. It must
 * document the auth model + the only two unauthenticated reads, affirm the
 * no-real-payments / no-token-endpoints posture, and carry no purchase CTA or
 * price/return language. CTA/price needles assembled at runtime.
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const doc = (() => {
  const p = join(repoRoot, 'docs', 'cognitia', 'public', 'API_AND_SURFACES.md');
  return existsSync(p) ? readFileSync(p, 'utf8') : '';
})();

const CTA = /buy now|buy token|purchase token|mint now|token sale is live/i;
const PRICE = /\bapy\b|guaranteed return|expected return|price target|\$\s?\d/i;

describe('VISIBILITY-004 API surfaces guards', () => {
  it('exists and states the auth model', () => {
    expect(doc.length).toBeGreaterThan(200);
    const lower = doc.toLowerCase();
    expect(lower).toContain('authorization');
    expect(lower).toContain('x-tenant-id'); // never trusted on operator routes
    expect(lower).toContain('never trusted');
  });

  it('documents the only two unauthenticated reads', () => {
    expect(doc).toContain('/health');
    expect(doc).toContain('/public/trust-feed');
    expect(doc.toLowerCase()).toContain('deny-by-default');
  });

  it('affirms the no-real-payments / no-token-endpoint posture', () => {
    const lower = doc.toLowerCase();
    const flat = lower.replace(/\s+/g, ' ');
    expect(flat).toContain('no real payments');
    expect(flat).toContain('internal credits');
    expect(flat).toContain('not production-deployed');
    // The doc may name token/buy routes ONLY in the "does not exist" section.
    expect(lower).toContain('what does not exist');
  });

  it('carries no purchase CTA or price/return language', () => {
    const lower = doc.toLowerCase();
    expect(CTA.test(lower)).toBe(false);
    expect(PRICE.test(lower)).toBe(false);
  });
});
