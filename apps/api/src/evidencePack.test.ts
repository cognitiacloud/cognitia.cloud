import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EVIDENCE_PACK, renderEvidenceJson, type ControlEvidence } from './evidencePack.js';

/**
 * Item 5 — machine-readable evidence pack guards.
 *
 * Two things must hold for the pack to be trustworthy:
 *   1. DRIFT: the committed docs/security/evidence-pack.json must match the
 *      typed source of truth (apps/api/src/evidencePack.ts). Compared on
 *      canonical content (parse + re-stringify) so the check is independent of
 *      how prettier wraps the JSON lines.
 *   2. NO FABRICATION: every file referenced by `enforced_by`/`tests` must
 *      actually exist on disk, and every security/compliance control must cite
 *      at least one test. Evidence that points at a missing file is worse than
 *      no evidence.
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const jsonPath = join(repoRoot, 'docs', 'security', 'evidence-pack.json');

const canonical = (s: string): string => JSON.stringify(JSON.parse(s), null, 2) + '\n';

describe('evidence pack — drift guard', () => {
  it('committed JSON matches the typed source of truth (regenerate with pnpm evidence:gen)', () => {
    expect(existsSync(jsonPath)).toBe(true);
    expect(canonical(readFileSync(jsonPath, 'utf8'))).toBe(renderEvidenceJson());
  });

  it('schema is the expected version and every control id is unique', () => {
    expect(EVIDENCE_PACK.schema_version).toBe('evidence.v1');
    const ids = EVIDENCE_PACK.controls.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThan(0);
  });
});

describe('evidence pack — no fabricated evidence', () => {
  const referenced = (c: ControlEvidence): string[] => [...c.enforced_by, ...c.tests];

  it.each(EVIDENCE_PACK.controls)('control "$id" references only files that exist', (control) => {
    for (const rel of referenced(control)) {
      expect(existsSync(join(repoRoot, rel)), `${control.id} -> missing ${rel}`).toBe(true);
    }
  });

  it('every control names at least one enforcing source file', () => {
    for (const c of EVIDENCE_PACK.controls) {
      expect(c.enforced_by.length, `${c.id} has no enforced_by`).toBeGreaterThan(0);
    }
  });

  it('every security/compliance control is backed by at least one test', () => {
    for (const c of EVIDENCE_PACK.controls) {
      if (c.category === 'security' || c.category === 'compliance') {
        expect(c.tests.length, `${c.id} (${c.category}) has no test`).toBeGreaterThan(0);
      }
    }
  });

  it('a residual, when present, carries a kind and a non-empty note', () => {
    for (const c of EVIDENCE_PACK.controls) {
      if (c.residual !== null) {
        expect(['infra', 'policy', 'decision']).toContain(c.residual.kind);
        expect(c.residual.note.length, `${c.id} residual note empty`).toBeGreaterThan(0);
      }
    }
  });
});
