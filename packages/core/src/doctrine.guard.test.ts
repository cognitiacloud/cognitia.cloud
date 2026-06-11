import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Doctrine guards (docs/cognitia/ARCHITECTURE_LOCK_V1_1.md §1, §3, §5):
 *   - no public token/coin/staking surface exists in the web app;
 *   - the custom DID method name is banned everywhere;
 *   - the legacy passport product name never appears in code or app surfaces
 *     (internal docs may use it as shorthand per the Lock §1);
 *   - crypto/token docs live only under docs/cognitia/internal/.
 *
 * Forbidden strings are assembled at runtime so this file never contains the
 * literals it polices.
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', '.next', 'coverage', 'test_assets']);
const TEXT_EXTENSIONS = /\.(ts|tsx|js|mjs|jsx|json|md|sql|ya?ml|css|html|txt)$/i;
// Internal doctrine docs are allowed to NAME forbidden terms in order to ban them.
const DOCTRINE_DIR = join('docs', 'cognitia');

function walkFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) walkFiles(full, out);
    } else if (TEXT_EXTENSIONS.test(entry) && stats.size < 1_000_000) {
      out.push(full);
    }
  }
  return out;
}

function filesOutsideDoctrine(): string[] {
  return walkFiles(repoRoot).filter((file) => {
    const rel = relative(repoRoot, file);
    return !rel.startsWith(DOCTRINE_DIR + sep);
  });
}

describe('doctrine guards', () => {
  it('no public token/coin/staking/presale/airdrop route exists in the web app', () => {
    const appDir = join(repoRoot, 'apps', 'web', 'src', 'app');
    const offenders: string[] = [];
    const forbiddenSegment = new RegExp(
      `(^|[-_])(${['token', 'coin', 'staking', 'presale', 'airdrop'].join('|')})s?([-_]|$)`,
      'i',
    );
    const visit = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (!statSync(full).isDirectory()) continue;
        if (forbiddenSegment.test(entry)) offenders.push(relative(repoRoot, full));
        visit(full);
      }
    };
    visit(appDir);
    expect(offenders).toEqual([]);
  });

  it('the custom DID method name appears nowhere in the codebase', () => {
    const banned = ['did', 'cognitia'].join(':');
    const offenders = filesOutsideDoctrine().filter((file) =>
      readFileSync(file, 'utf8').includes(banned),
    );
    expect(offenders.map((f) => relative(repoRoot, f))).toEqual([]);
  });

  it('the legacy passport product name appears nowhere in code or app surfaces', () => {
    // Internal docs (docs/**) may use the shorthand; code, apps, packages,
    // hermes, and config must not (Lock §1: public name is ATC).
    const banned = ['agent', 'passport'].join(' ');
    const offenders = filesOutsideDoctrine().filter((file) => {
      const rel = relative(repoRoot, file);
      const selfPath = fileURLToPath(import.meta.url);
      if (rel.startsWith('docs' + sep) || file === selfPath) return false;
      return readFileSync(file, 'utf8').toLowerCase().includes(banned);
    });
    expect(offenders.map((f) => relative(repoRoot, f))).toEqual([]);
  });

  it('token/investment marketing language appears nowhere in the web app', () => {
    const phrases = ['get in early', 'presale', 'airdrop', 'staking rewards', 'to the moon'];
    const webDir = join(repoRoot, 'apps', 'web');
    const offenders = walkFiles(webDir).filter((file) => {
      const content = readFileSync(file, 'utf8').toLowerCase();
      return phrases.some((phrase) => content.includes(phrase));
    });
    expect(offenders.map((f) => relative(repoRoot, f))).toEqual([]);
  });
});
