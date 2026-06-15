import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * VISIBILITY-005 — guards for the public threat model, governance posture, trust
 * boundaries, and public risk register. These docs deliberately *negate* banned
 * words ("no DEX", "not decentralized"), so the must-not checks target only
 * AFFIRMATIVE sales/marketing patterns (which never appear, even negated).
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const pub = join(repoRoot, 'docs', 'cognitia', 'public');
const read = (name: string) => {
  const p = join(pub, name);
  return existsSync(p) ? readFileSync(p, 'utf8') : '';
};

const threat = read('THREAT_MODEL.md');
const governance = read('GOVERNANCE_POSTURE.md');
const boundaries = read('TRUST_BOUNDARIES.md');
const risk = read('RISK_REGISTER_PUBLIC.md');
const trustPage = (() => {
  const p = join(repoRoot, 'apps', 'web', 'src', 'app', 'trust', 'page.tsx');
  return existsSync(p) ? readFileSync(p, 'utf8') : '';
})();

const corpus = [threat, governance, boundaries, risk].join('\n').toLowerCase();
const flat = corpus.replace(/\s+/g, ' ');

// Affirmative sales/marketing needles that must NEVER appear (not even via these
// docs' negations). Assembled to keep this file clean.
const CTA = /buy now|buy token|purchase token|mint now|token sale is live/;
const PRICE = /\bapy\b|guaranteed return|expected return|price target|\$\s?\d/;
const MARKETING =
  /provide liquidity|liquidity pool|earn yield|yield farming|staking rewards|stake to earn/;

describe('VISIBILITY-005 threat + governance guards', () => {
  it('all four docs exist and are substantial', () => {
    for (const [name, body] of Object.entries({ threat, governance, boundaries, risk })) {
      expect(body.length, `${name} should be non-empty`).toBeGreaterThan(300);
    }
  });

  it('docs disclose the managed-RLS-pending gap honestly', () => {
    expect(flat).toContain('managed-postgres rls');
    expect(flat).toMatch(/not yet verified|unverified/);
  });

  it('docs state no SOC 2 certification', () => {
    expect(flat).toMatch(/not soc 2 certified|no soc 2 certification/);
  });

  it('docs state no public token and no DAO / token governance', () => {
    expect(flat).toContain('no public token');
    expect(governance.toLowerCase()).toContain('no dao exists');
    expect(governance.toLowerCase()).toContain('no token governance');
  });

  it('docs keep the honest negated framings (not production-ready / not decentralized)', () => {
    expect(flat).toMatch(/not production-ready|no production-readiness/);
    expect(flat).toContain('not decentralized');
    expect(flat).toContain('impossible to shut down'); // appears only in a "refuse to claim" context
  });

  it('docs contain NO purchase CTA / price-return / DEX-yield MARKETING', () => {
    expect(CTA.test(corpus)).toBe(false);
    expect(PRICE.test(corpus)).toBe(false);
    expect(MARKETING.test(corpus)).toBe(false);
  });

  it('/trust references the threat + governance docs (no token CTA)', () => {
    expect(trustPage).toContain('THREAT_MODEL.md');
    expect(trustPage).toContain('GOVERNANCE_POSTURE.md');
    expect(trustPage.toLowerCase()).not.toMatch(CTA);
  });
});
