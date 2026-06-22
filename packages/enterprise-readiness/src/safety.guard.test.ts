import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Mock-safe invariants for this package. Fails the build if a source file
 * introduces a live-egress call, a real-looking secret, or a `sent: true`
 * literal. This is the in-repo half of the safety scan (scripts/safety-scan.mjs
 * covers the wider tree).
 */

const here = dirname(fileURLToPath(import.meta.url));

function sources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (full.endsWith('.ts')) out.push(full);
  }
  return out;
}

// Live network egress primitives. Matched as call-sites, not as substrings of
// identifiers, so the detector heuristics in darkMode.ts don't self-trip.
const EGRESS = [/\bfetch\s*\(/, /\baxios\b/, /https?:\/\/(?!127\.0\.0\.1|localhost)/, /\bnet\.connect\b/];
const REAL_SECRET = [/sk-[A-Za-z0-9]{16,}/, /AKIA[0-9A-Z]{16}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/];
const SENT_TRUE = /\bsent\s*:\s*true\b/;

// Production source only. Test files legitimately contain negative cases
// (e.g. asserting `sent: true` is rejected), so they are scanned separately by
// scripts/safety-scan.mjs with case-aware rules.
const files = sources(here).filter((f) => !f.endsWith('.test.ts'));

test('no live network egress in source', () => {
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    for (const re of EGRESS) {
      assert.ok(!re.test(text), `live egress pattern ${re} found in ${f}`);
    }
  }
});

test('no real secrets in source', () => {
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    for (const re of REAL_SECRET) {
      assert.ok(!re.test(text), `secret pattern ${re} found in ${f}`);
    }
  }
});

test('no sent:true literal anywhere', () => {
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    assert.ok(!SENT_TRUE.test(text), `sent:true literal found in ${f}`);
  }
});
