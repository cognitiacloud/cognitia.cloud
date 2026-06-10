import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * RDM-1 — README honesty guard. The root README's capability table claims each
 * governance behavior is backed by a test "that fails in CI if the behavior
 * regresses." This test enforces exactly that: every `*.test.ts` file cited in
 * the README must exist in the repo. If a cited test is renamed or deleted, the
 * README is lying — and this fails, forcing the doc and the code back in sync.
 * Coherence between docs and implementation, mechanically enforced.
 */

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

describe('RDM-1 — README evidence pointers resolve', () => {
  it('every *.test.ts cited in the README exists in the repo', () => {
    const readme = readFileSync(join(REPO_ROOT, 'README.md'), 'utf8');
    // Pull every `something.test.ts` token mentioned in the capability table.
    const cited = [...new Set(readme.match(/[A-Za-z0-9._-]+\.test\.ts/g) ?? [])];
    expect(cited.length, 'README should cite test files as evidence').toBeGreaterThanOrEqual(15);

    const missing: string[] = [];
    for (const name of cited) {
      // Resolve by basename anywhere under apps/ or packages/.
      const hit = findByName(REPO_ROOT, name);
      if (!hit) missing.push(name);
    }
    expect(missing, `README cites test files that do not exist: ${missing.join(', ')}`).toEqual([]);
  });
});

/** Shallow, dependency-free search for a test file by basename under apps/ + packages/. */
function findByName(root: string, basename: string): boolean {
  // Known locations are flat enough that explicit roots keep this fast + simple.
  const searchRoots = [
    'apps/api/src',
    'apps/web/src/lib',
    'packages/integrations/src/hubspot',
    'packages/evals/src',
    'packages/agents/src/mira',
    'packages/db/src',
  ];
  for (const dir of searchRoots) {
    if (existsSync(join(root, dir, basename))) return true;
  }
  return false;
}
