import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { closerClaim, closerSourceCreate } from './schemas/closer.js';

/**
 * Sales Closer doctrine guards (Phase 1):
 *   - every brief claim is evidence-tagged; verified_fact requires evidence_ref;
 *   - the closer tables store NO raw contact PII (hash-only doctrine);
 *   - a disallowed source can never be active (mock-safe by default);
 *   - Phase-1 containment: the closer/apify code paths make no real vendor or
 *     network calls yet (the dirs may not exist; if they do, they must be inert).
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const migrationsDir = join(repoRoot, 'packages', 'db', 'migrations');
const CLOSER_MIGRATIONS = ['0020_closer_sources_runs.sql', '0021_closer_profiles_briefs.sql'];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

describe('closer evidence doctrine', () => {
  it('accepts a verified_fact claim only with an evidence_ref', () => {
    expect(
      closerClaim.safeParse({ text: 'Operates 3 rooftops', evidence_tag: 'verified_fact' }).success,
    ).toBe(false);
    expect(
      closerClaim.safeParse({
        text: 'Operates 3 rooftops',
        evidence_tag: 'verified_fact',
        evidence_ref: 'signal:abc',
      }).success,
    ).toBe(true);
  });

  it('accepts inference/unknown claims without an evidence_ref', () => {
    expect(
      closerClaim.safeParse({ text: 'May be evaluating a CRM', evidence_tag: 'unknown' }).success,
    ).toBe(true);
    expect(
      closerClaim.safeParse({
        text: 'Likely high intent',
        evidence_tag: 'likely_inference',
        confidence: 0.6,
      }).success,
    ).toBe(true);
  });
});

describe('closer source safety', () => {
  it('rejects an active disallowed source and allows it only when inactive', () => {
    const base = {
      tenant_id: '11111111-1111-1111-1111-111111111111',
      label: 'x',
      apify_actor_id: 'apify/x',
      source_risk: 'disallowed' as const,
    };
    expect(closerSourceCreate.safeParse({ ...base, active: true }).success).toBe(false);
    expect(closerSourceCreate.safeParse({ ...base, active: false }).success).toBe(true);
  });
});

describe('closer PII-hash-only doctrine', () => {
  it('the closer migrations declare no raw contact PII columns', () => {
    const banned = /\b(email|phone|full_name)\b/i;
    const offenders = CLOSER_MIGRATIONS.filter((file) =>
      banned.test(readFileSync(join(migrationsDir, file), 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});

describe('closer Phase-1 containment', () => {
  it('closer/apify code paths make no real vendor or network calls yet', () => {
    const dirs = [
      join(repoRoot, 'packages', 'agents', 'src', 'closer'),
      join(repoRoot, 'packages', 'integrations', 'src', 'apify'),
    ].filter(existsSync);
    // Production source only (tests legitimately import fakes/clients later).
    const banned = /\b(fetch|child_process|node:net|node:http|ApifyClient|new\s+Anthropic)\b/;
    const offenders: string[] = [];
    for (const dir of dirs) {
      for (const file of walk(dir)) {
        if (!/\.(ts|tsx|js|mjs)$/.test(file) || /\.test\.|__fixtures__|fake/i.test(file)) continue;
        if (banned.test(readFileSync(file, 'utf8'))) offenders.push(relative(repoRoot, file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
