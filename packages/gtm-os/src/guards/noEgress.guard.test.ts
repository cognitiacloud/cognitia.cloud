import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Static no-egress guard. The substrate is mock-only: production source must
 * import no network/vendor module and make no outbound call. Test files are
 * excluded (they may reference `fetch` to spy on it); the runtime no-egress
 * proof lives in the engine e2e test.
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

const FORBIDDEN_IMPORTS: RegExp[] = [
  /from\s+['"]node:(http|https|net|tls|dgram|dns)['"]/,
  /from\s+['"](axios|node-fetch|undici|got|superagent|nodemailer|@sendgrid\/mail|twilio|googleapis|@hubspot\/api-client|puppeteer|playwright|apify|ws)['"]/,
  /require\(\s*['"](node:)?(http|https|net|tls|dgram|dns|axios|node-fetch|nodemailer|twilio)['"]\s*\)/,
];

const FORBIDDEN_CALLS: RegExp[] = [
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /new\s+WebSocket\b/,
  /\.(get|post|put|patch|delete)\s*\(\s*['"]https?:\/\//,
];

describe('no live egress (static source scan)', () => {
  it('finds production source to scan', () => {
    expect(productionFiles.length).toBeGreaterThan(0);
  });

  it('imports no network or vendor module', () => {
    const offenders: string[] = [];
    for (const file of productionFiles) {
      const text = readFileSync(file, 'utf8');
      for (const re of FORBIDDEN_IMPORTS) if (re.test(text)) offenders.push(`${file} :: ${re}`);
    }
    expect(offenders).toEqual([]);
  });

  it('makes no outbound network call', () => {
    const offenders: string[] = [];
    for (const file of productionFiles) {
      const text = readFileSync(file, 'utf8');
      for (const re of FORBIDDEN_CALLS) if (re.test(text)) offenders.push(`${file} :: ${re}`);
    }
    expect(offenders).toEqual([]);
  });
});
