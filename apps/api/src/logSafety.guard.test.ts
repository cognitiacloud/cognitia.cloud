import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * OBS-1 — PII-safe logging assertion (gates CI).
 *
 * All runtime logging must flow through the redacting `log()` sink in
 * packages/core/src/logging.ts (allowlisted keys + forbidden-key redaction).
 * A raw `console.*` call bypasses redaction and could leak PII/secrets into
 * log aggregation. This guard scans every non-test source file in apps/ and
 * packages/ and fails the build on any console call site outside the explicit
 * allowlist below.
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');

/**
 * The only files allowed to call console.*:
 *  - the redacting sink itself (it IS the console writer);
 *  - the API bootstrap line (structured JSON, static fields only, pre-handler).
 * Additions require review — they widen the unredacted surface.
 */
const ALLOWED = new Set(['packages/core/src/logging.ts', 'apps/api/src/server.ts']);

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.next', 'coverage']);
const SOURCE_FILE = /\.(ts|tsx)$/;
const TEST_FILE = /\.(test|spec)\.(ts|tsx)$/;
const CONSOLE_CALL = /console\.(log|info|warn|error|debug|trace)\(/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(entry)) walk(full, out);
    } else if (SOURCE_FILE.test(entry) && !TEST_FILE.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('OBS-1 — PII-safe logging guard', () => {
  it('no console.* call site exists outside the redacting sink + declared bootstrap', () => {
    const roots = [join(repoRoot, 'apps'), join(repoRoot, 'packages')];
    const offenders: string[] = [];
    for (const root of roots) {
      for (const file of walk(root)) {
        const rel = relative(repoRoot, file).split('\\').join('/');
        if (ALLOWED.has(rel)) continue;
        const lines = readFileSync(file, 'utf8').split('\n');
        lines.forEach((line, i) => {
          if (CONSOLE_CALL.test(line)) offenders.push(`${rel}:${i + 1}`);
        });
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the allowlisted bootstrap line logs structured JSON with static fields only', () => {
    const server = readFileSync(join(repoRoot, 'apps/api/src/server.ts'), 'utf8');
    const consoleLines = server.split('\n').filter((l) => CONSOLE_CALL.test(l));
    // Exactly one bootstrap call, and it must be JSON.stringify of a literal.
    expect(consoleLines).toHaveLength(1);
    expect(consoleLines[0]).toContain('JSON.stringify');
    expect(consoleLines[0]).not.toMatch(/req|body|token|secret|email/i);
  });
});
