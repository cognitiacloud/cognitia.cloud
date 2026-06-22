import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FIXTURE_LEADS } from '../fixtures/leads.js';
import { scanForRawPii } from '../pii/piiSafety.js';

/**
 * No-raw-PII guard. Neither production source nor the fixtures may contain
 * anything resembling real contact PII; only reserved `.example` / `555-01xx`
 * forms are allowed. (The runtime ledger/receipt PII proof lives in the engine
 * e2e test.)
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

describe('no raw PII', () => {
  it('production source contains no raw-PII-looking literals', () => {
    const offenders: { file: string; kind: string; sample: string }[] = [];
    for (const file of productionFiles) {
      for (const v of scanForRawPii(readFileSync(file, 'utf8'))) {
        offenders.push({ file, kind: v.kind, sample: v.sample });
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the fixture set contains no raw PII', () => {
    expect(scanForRawPii(FIXTURE_LEADS)).toEqual([]);
  });
});
