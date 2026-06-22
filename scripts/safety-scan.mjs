#!/usr/bin/env node
/**
 * Mock-safe safety scan (no live egress, no secrets, no live sends).
 *
 * Scans tracked source/docs for:
 *   - live network egress primitives in PRODUCTION source;
 *   - real-looking secrets anywhere;
 *   - `sent: true` literals in production source (dry-run actions must be false).
 *
 * Test files may legitimately contain negative cases (asserting that a real
 * secret or `sent: true` is rejected), so secret/egress/sent rules that would
 * false-positive on assertions are scoped to non-test source. Exits non-zero on
 * any violation. No network, no installs.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = process.cwd();
const SCAN_DIRS = ['packages', 'scripts', 'docs'];
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);

const EGRESS = [
  /\bfetch\s*\(/,
  /\baxios\b/,
  /\bgot\s*\(/,
  /\bnet\.connect\b/,
  /\bhttps?\.request\b/,
  /https?:\/\/(?!127\.0\.0\.1|localhost)[a-z0-9.-]+/i,
];
const REAL_SECRET = [
  /sk-[A-Za-z0-9]{20,}/,
  /xox[baprs]-[A-Za-z0-9]{10,}-[A-Za-z0-9-]{10,}/,
  /AKIA[0-9A-Z]{16}/,
  /AIza[0-9A-Za-z_-]{30,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
];
const SENT_TRUE = /\bsent\s*:\s*true\b/;

/** Allow regex-pattern definitions (the detectors themselves) to mention tokens. */
function isDetectorLine(line) {
  return /REAL_SECRET|EGRESS|SENT_TRUE|RE\s*=|regex|pattern/i.test(line);
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.git') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const violations = [];
for (const base of SCAN_DIRS) {
  for (const file of walk(join(ROOT, base))) {
    const ext = extname(file);
    const isCode = CODE_EXT.has(ext);
    const isMarkdown = ext === '.md';
    if (!isCode && !isMarkdown) continue;
    const isTest = /\.test\.[cm]?[jt]s$/.test(file);
    const isDetector = /safety-scan\.mjs$|safety\.guard\.test\.ts$/.test(file);
    const text = readFileSync(file, 'utf8');
    const lines = text.split('\n');

    lines.forEach((line, i) => {
      if (isDetector || isDetectorLine(line)) return;
      const at = `${file}:${i + 1}`;
      // Secrets: scan everything (markdown included).
      for (const re of REAL_SECRET) {
        if (re.test(line)) violations.push(`real_secret ${at}`);
      }
      if (isCode && !isTest) {
        for (const re of EGRESS) {
          if (re.test(line)) violations.push(`live_egress ${at}`);
        }
        if (SENT_TRUE.test(line)) violations.push(`sent_true ${at}`);
      }
    });
  }
}

if (violations.length > 0) {
  console.error('SAFETY SCAN FAILED:');
  for (const v of violations) console.error('  - ' + v);
  process.exit(1);
}
console.log('SAFETY SCAN PASSED: no live egress, no secrets, no live sends.');
