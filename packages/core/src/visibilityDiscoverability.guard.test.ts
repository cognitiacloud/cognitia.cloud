import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * VISIBILITY-003 — guards for diligence discoverability. The researcher pack must
 * be findable from the README + an entrypoints index, and `/trust` must carry
 * diligence-framed metadata — all with no token-purchase CTA / price-return /
 * sale language. Banned needles are assembled at runtime.
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const read = (p: string) => (existsSync(p) ? readFileSync(p, 'utf8') : '');

const readme = read(join(repoRoot, 'README.md'));
const entrypoints = read(join(repoRoot, 'docs', 'cognitia', 'public', 'RESEARCHER_ENTRYPOINTS.md'));
const trustPage = read(join(repoRoot, 'apps', 'web', 'src', 'app', 'trust', 'page.tsx'));

const CTA = /buy now|buy token|purchase token|mint now|token sale is live/i;
const HYPE = [
  ['get in', 'early'].join(' '),
  ['to the', 'moon'].join(' '),
  ['pre', 'sale'].join(''),
];
const PRICE = /\bapy\b|guaranteed return|expected return|price target|\$\s?\d/i;

describe('VISIBILITY-003 discoverability guards', () => {
  it('README links the researcher pack + security policy + trust surface', () => {
    for (const ref of [
      '/trust',
      'SECURITY.md',
      'RESEARCHER_PACK.md',
      'VERIFY_IT_YOURSELF.md',
      'TOKEN_STATUS_AND_GATES.md',
      'CLAIMS_WE_DO_NOT_MAKE.md',
    ]) {
      expect(readme).toContain(ref);
    }
  });

  it('the README trust section carries NO purchase CTA / price-return / hype', () => {
    // Scan only the trust & diligence section to avoid unrelated matches.
    const lower = readme.toLowerCase();
    const start = lower.indexOf('trust & diligence');
    const section = start >= 0 ? lower.slice(start, start + 2000) : lower;
    expect(CTA.test(section)).toBe(false);
    expect(PRICE.test(section)).toBe(false);
    for (const needle of HYPE) expect(section).not.toContain(needle);
    expect(section).toContain('no token sale'); // explicit restraint, present
  });

  it('entrypoints index exists, lists the pack, and keeps standing caveats', () => {
    expect(entrypoints.length).toBeGreaterThan(100);
    for (const ref of ['RESEARCHER_PACK.md', 'VERIFY_IT_YOURSELF.md', 'SECURITY.md']) {
      expect(entrypoints).toContain(ref);
    }
    const lower = entrypoints.toLowerCase();
    expect(lower).toContain('not yet verified'); // managed RLS caveat
    expect(entrypoints).toContain('NOT PASSED'); // token gates
  });

  it('/trust carries diligence-framed metadata with no sale/investment wording', () => {
    expect(trustPage).toContain('Cognitia Trust & Proof');
    expect(trustPage.toLowerCase()).toContain('proof-backed agent economy diligence surface');
    // The metadata description string itself must not sell.
    const descMatch = trustPage.match(/description:\s*\n?\s*'([^']+)'/);
    const desc = (descMatch?.[1] ?? '').toLowerCase();
    expect(desc.length).toBeGreaterThan(20);
    expect(desc).not.toMatch(/buy|sale|invest|presale|apy|yield|price target/);
    // And it still affirms no public token.
    expect(desc).toContain('no public token');
  });

  it('/trust still references the researcher resources (no token CTA)', () => {
    expect(trustPage).toContain('Researcher resources');
    expect(trustPage).toContain('RESEARCHER_PACK.md');
    expect(trustPage.toLowerCase()).not.toMatch(CTA);
  });
});
