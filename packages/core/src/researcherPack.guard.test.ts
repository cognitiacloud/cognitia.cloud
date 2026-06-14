import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * VISIBILITY-002 — guards for the public researcher pack + SECURITY.md.
 * Ensures the public-safe diligence docs exist, keep the required honest
 * caveats, and carry no token-purchase CTA / price-return language. Banned
 * promotional needles are assembled at runtime so this file never contains them
 * verbatim.
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const publicDir = join(repoRoot, 'docs', 'cognitia', 'public');

const read = (p: string) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const security = read(join(repoRoot, 'SECURITY.md'));
const pack = read(join(publicDir, 'RESEARCHER_PACK.md'));
const verify = read(join(publicDir, 'VERIFY_IT_YOURSELF.md'));
const tokenStatus = read(join(publicDir, 'TOKEN_STATUS_AND_GATES.md'));
const claims = read(join(publicDir, 'CLAIMS_WE_DO_NOT_MAKE.md'));
const order = read(join(publicDir, 'RESEARCHER_REVIEW_ORDER.md'));
const standards = read(join(publicDir, 'STANDARDS_ALIGNMENT.md'));

// Purchase-CTA + hype needles (assembled at runtime).
const CTA = /buy now|buy token|purchase token|mint now|token sale is live/i;
const HYPE = [
  ['get in', 'early'].join(' '),
  ['to the', 'moon'].join(' '),
  ['pre', 'sale'].join(''),
];
const PRICE = /\bapy\b|guaranteed return|expected return|price target|\$\s?\d/i;

describe('VISIBILITY-002 researcher pack guards', () => {
  it('all public-safe diligence docs exist (+ root SECURITY.md)', () => {
    for (const [name, body] of Object.entries({
      'SECURITY.md': security,
      'RESEARCHER_PACK.md': pack,
      'VERIFY_IT_YOURSELF.md': verify,
      'TOKEN_STATUS_AND_GATES.md': tokenStatus,
      'CLAIMS_WE_DO_NOT_MAKE.md': claims,
      'RESEARCHER_REVIEW_ORDER.md': order,
      'STANDARDS_ALIGNMENT.md': standards,
    })) {
      expect(body.length, `${name} should exist and be non-empty`).toBeGreaterThan(100);
    }
  });

  it('token status is unambiguous and gated', () => {
    expect(tokenStatus.toLowerCase()).toContain('no public token exists');
    expect(tokenStatus.toLowerCase()).toContain('may never');
    expect(tokenStatus).toContain('NOT PASSED');
  });

  it('claims-we-do-not-make keeps the honest caveats', () => {
    const c = claims.toLowerCase();
    expect(c).toContain('not production-ready');
    expect(c).toContain('not soc 2 certified');
    expect(c).toContain('not decentralized in production');
    expect(c).toContain('not yet'); // managed RLS / audit not yet
  });

  it('verify-it-yourself is reproducible + carries the RLS caveat', () => {
    expect(verify).toContain('pnpm check');
    expect(verify).toContain('490');
    expect(verify).toContain('0015');
    const flat = verify.toLowerCase().replace(/\s+/g, ' ');
    expect(flat).toContain('row-level security');
    expect(flat).toContain('not yet verified');
  });

  it('SECURITY.md has a disclosure contact, no funded bounty promise, and caveats', () => {
    expect(security.toLowerCase()).toContain('security@cognitia.cloud');
    expect(security.toLowerCase()).toContain('no paid bug bounty');
    expect(security.toLowerCase()).toContain('not legal advice');
    expect(security.toLowerCase()).toContain('not production-deployed');
    expect(security.toLowerCase()).toContain('not soc 2 certified');
    // Must NOT promise an active/funded bounty.
    expect(security.toLowerCase()).not.toMatch(/we offer a bug bounty|bug bounty program/);
  });

  it('researcher pack links the other docs and uses evidence tags', () => {
    expect(pack).toContain('verified_fact');
    for (const ref of [
      'VERIFY_IT_YOURSELF.md',
      'TOKEN_STATUS_AND_GATES.md',
      'CLAIMS_WE_DO_NOT_MAKE.md',
      'SECURITY.md',
    ]) {
      expect(pack).toContain(ref);
    }
  });

  it('positive docs carry NO purchase CTA / price-return / hype language', () => {
    // The token-status and claims docs legitimately negate hype words, so they
    // are excluded from the strict affirmative scan.
    for (const body of [pack, verify, standards, order]) {
      const lower = body.toLowerCase();
      expect(CTA.test(lower)).toBe(false);
      expect(PRICE.test(lower)).toBe(false);
      for (const needle of HYPE) expect(lower).not.toContain(needle);
    }
  });

  it('standards alignment never claims live compliance / mainnet', () => {
    const s = standards.toLowerCase();
    const plain = s.replace(/[*_`]/g, ''); // strip markdown emphasis
    expect(s).toContain('designed for compatibility');
    expect(s).toContain('needs verification before public use');
    // The banned phrases may appear only in a negated/quoted context ("does not
    // claim to be ..."); guard against AFFIRMATIVE compliance/mainnet claims.
    expect(plain).toContain('does not claim');
    expect(s).not.toMatch(
      /is erc-8004 compliant|is live on mainnet|we are certified|fully compliant/,
    );
  });
});
