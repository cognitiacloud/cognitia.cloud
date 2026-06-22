import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Guard against prohibited financial / token vocabulary leaking into the
 * substrate. v0 has no token, payment, yield, liquidity, airdrop, investment,
 * or price-appreciation surface, and nothing here should imply one. Test files
 * are excluded (this file necessarily names the forbidden terms).
 */

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const productionFiles = walk(srcRoot).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'));

const FORBIDDEN: RegExp[] = [
  /\bairdrops?\b/i,
  /\byield\b/i,
  /\bliquidity\b/i,
  /\btokens?\b/i,
  /\bpayments?\b/i,
  /\binvest(ment|ments|or|ors|ing)?\b/i,
  /price\s*appreciation/i,
  /\bAPY\b/,
  /\bstaking\b/i,
];

describe('no prohibited financial/token language', () => {
  it('production source uses no prohibited financial vocabulary', () => {
    const offenders: string[] = [];
    for (const file of productionFiles) {
      const text = readFileSync(file, 'utf8');
      for (const re of FORBIDDEN) if (re.test(text)) offenders.push(`${file} :: ${re}`);
    }
    expect(offenders).toEqual([]);
  });
});
