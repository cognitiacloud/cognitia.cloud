import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * V6A-DOCS-RECONCILE — guard for the V-6A RLS reconciliation.
 *
 * V-6A verified Row-Level Security by the Postgres engine on a **real, local
 * PostgreSQL 16** cluster under a restricted, non-superuser `app_user`. It did
 * NOT verify a hosted/managed provider (e.g. Supabase via PgBouncer), and it is
 * not a production-readiness or SOC 2 claim. These checks keep the reconciled
 * audit + public diligence docs honest:
 *   - they must disclose that hosted/managed-provider verification is still pending;
 *   - they must record the V-6A positive (real local PG16 + restricted app_user);
 *   - they must NOT claim production-ready, SOC 2 certified, or managed-provider
 *     verified (the docs deliberately negate these, so the must-not checks target
 *     only AFFIRMATIVE phrasings, which never appear even via the negations).
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');

const read = (...rel: string[]): string => {
  const p = join(repoRoot, ...rel);
  return existsSync(p) ? readFileSync(p, 'utf8') : '';
};

const auditDir = ['docs', 'cognitia', 'audits', 'AUDIT_BOOKLET_001'];
const publicDir = ['docs', 'cognitia', 'public'];
const execDir = ['docs', 'cognitia', 'execution'];

const docs = {
  booklet: read(...auditDir, 'COGNITIA_SYSTEM_BOOKLET_V1.md'),
  testBooklet: read(...auditDir, 'TEST_VERIFICATION_BOOKLET.md'),
  scorecard: read(...auditDir, 'READINESS_SCORECARD.md'),
  whatIsLeft: read(...auditDir, 'WHAT_IS_LEFT_TO_BUILD.md'),
  risk: read(...publicDir, 'RISK_REGISTER_PUBLIC.md'),
  pack: read(...publicDir, 'RESEARCHER_PACK.md'),
  verify: read(...publicDir, 'VERIFY_IT_YOURSELF.md'),
  boundaries: read(...publicDir, 'TRUST_BOUNDARIES.md'),
  threat: read(...publicDir, 'THREAT_MODEL.md'),
  apiSurfaces: read(...publicDir, 'API_AND_SURFACES.md'),
  pilotQueue: read(...execDir, 'NEXT_BUILD_PILOT_QUEUE.md'),
  prompts: read(...execDir, 'NEXT_PROMPTS_FOR_AGENTS.md'),
};

const corpus = Object.values(docs).join('\n').toLowerCase();
const flat = corpus.replace(/\s+/g, ' ');

// AFFIRMATIVE-unsafe needles. Shaped so the docs' honest negations ("not
// production-ready", "does not imply SOC 2 certification", "hosted/managed
// provider ... unverified") do NOT match.
const PRODUCTION_READY = /\b(is|are|now)\s+production[- ]ready\b/;
const SOC2_CERTIFIED = /\b(is|are|now|achieved|obtained|fully)\s+soc ?2[- ]?certif/;
const MANAGED_VERIFIED =
  /managed supabase verified|production rls verified|(hosted|managed)[- ](provider|supabase|postgres)\s+(is\s+)?verified\b/;

describe('V6A-DOCS-RECONCILE guard', () => {
  it('the reconciled docs all exist and are substantial', () => {
    for (const [name, body] of Object.entries(docs)) {
      expect(body.length, `${name} should be non-empty`).toBeGreaterThan(300);
    }
  });

  it('docs disclose that hosted/managed-provider RLS verification remains pending', () => {
    expect(flat).toMatch(/(hosted|managed)[- ](provider|postgres|supabase)/);
    expect(flat).toMatch(/pending|not yet verified|unverified|remains/);
  });

  it('docs record the V-6A positive (real local PG16 under a restricted app_user)', () => {
    expect(flat).toContain('postgresql 16');
    expect(flat).toContain('app_user');
    expect(flat).toMatch(/nosuperuser|non-superuser/);
    expect(flat).toContain('v-6a');
  });

  it('docs make NO affirmative production-ready claim', () => {
    expect(PRODUCTION_READY.test(corpus)).toBe(false);
  });

  it('docs make NO affirmative SOC 2 certified claim', () => {
    expect(SOC2_CERTIFIED.test(corpus)).toBe(false);
  });

  it('docs make NO affirmative managed/hosted-provider verified claim', () => {
    expect(MANAGED_VERIFIED.test(corpus)).toBe(false);
  });
});
