import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * V-4b — public-safe guards for the live proof feed page (`/trust/live`).
 * Source-text scan (repo convention). The page is read-only: it only GETs the
 * unauthenticated public feed, sends no auth/token, performs no writes, and
 * carries no token-purchase / price / marketing copy.
 */

const here = dirname(fileURLToPath(import.meta.url));
const pagePath = join(here, 'page.tsx');
const src = existsSync(pagePath) ? readFileSync(pagePath, 'utf8') : '';
const lower = src.toLowerCase();

// Banned launch-hype needles assembled at runtime (doctrine guard scans apps/web).
const N1 = ['pre', 'sale'].join('');
const N2 = ['air', 'drop'].join('');
const N3 = ['get in', 'early'].join(' ');
const N4 = ['staking', 'rewards'].join(' ');
const N5 = ['to the', 'moon'].join(' ');

describe('Live public proof feed (/trust/live) — public-safe guards', () => {
  it('exists and exports a default component', () => {
    expect(existsSync(pagePath)).toBe(true);
    expect(src).toMatch(/export default function \w+/);
  });

  it('is read-only: GET-only against the public feed, no writes, no auth/token', () => {
    expect(src).toContain('/public/trust-feed');
    // Only GET requests.
    expect(src).not.toMatch(/method:\s*['"]POST['"]/i);
    expect(src).not.toMatch(/method:\s*['"]PUT['"]/i);
    expect(src).not.toMatch(/method:\s*['"]DELETE['"]/i);
    // No auth/session token / credentials.
    expect(lower).not.toMatch(/authorization|bearer|session token|credentials:/);
    expect(lower).not.toContain('apiclient');
  });

  it('does not render or reference private proof fields', () => {
    expect(lower).not.toContain('details_private');
    expect(lower).not.toContain('evidence_ref');
    expect(lower).not.toContain('verifier_ref');
    expect(lower).not.toContain('tenant_id');
    expect(src).toContain('redaction');
  });

  it('has NO token purchase CTA, price/return, or DEX/liquidity/staking/yield marketing', () => {
    expect(lower).not.toMatch(/buy now|buy token|purchase token|token sale is live|mint now/);
    expect(lower).not.toMatch(/price target|guaranteed return|expected return|apy|% return/);
    expect(lower).not.toMatch(/provide liquidity|liquidity pool|yield farming|earn yield/);
    expect(lower).not.toMatch(/\bpump\b/);
    for (const needle of [N1, N2, N3, N4, N5]) {
      expect(lower).not.toContain(needle);
    }
  });

  it('links back to the static Trust explorer and states the public-safe guarantee', () => {
    expect(src).toContain('/trust');
    expect(lower).toContain('public-safe');
    expect(lower).toContain('aggregate');
  });
});
