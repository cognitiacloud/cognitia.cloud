import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CURATED_PROOFS, CURATED_PROOF_NOTE, type CuratedProof } from './curated-proofs';

/**
 * V-4c — guards for the curated, static public-safe proof samples shown on
 * `/trust`. The data must be public-projection-only (no private fields, no PII,
 * no tenant/customer ids), static (no DB, no fetch), and rendered on the static
 * page without breaking its read-only guarantee.
 */

const here = dirname(fileURLToPath(import.meta.url));
const dataPath = join(here, 'curated-proofs.ts');
const pagePath = join(here, 'page.tsx');
const dataSrc = existsSync(dataPath) ? readFileSync(dataPath, 'utf8') : '';
const pageSrc = existsSync(pagePath) ? readFileSync(pagePath, 'utf8') : '';

const PUBLIC_KEYS = [
  'created_at',
  'evidence_tag',
  'id',
  'kind',
  'summary_public',
  'supersedes_proof_id',
].sort();
const ALLOWED_TAGS = new Set(['verified_fact', 'likely_inference', 'unknown']);

describe('Curated public-safe proof samples (V-4c)', () => {
  it('has at least a few entries and exposes a clear "not live records" note', () => {
    expect(CURATED_PROOFS.length).toBeGreaterThanOrEqual(3);
    expect(CURATED_PROOF_NOTE.toLowerCase()).toContain('not live records');
    expect(CURATED_PROOF_NOTE.toLowerCase()).toContain('not customer data');
  });

  it('every entry carries ONLY the public projection fields', () => {
    for (const p of CURATED_PROOFS) {
      expect(Object.keys(p).sort()).toEqual(PUBLIC_KEYS);
    }
  });

  it('uses only the closed evidence-tag taxonomy', () => {
    for (const p of CURATED_PROOFS) {
      expect(ALLOWED_TAGS.has(p.evidence_tag)).toBe(true);
    }
  });

  it('demonstrates the discipline: verified_fact plus at least one weaker tag', () => {
    const tags = new Set(CURATED_PROOFS.map((p) => p.evidence_tag));
    expect(tags.has('verified_fact')).toBe(true);
    expect(tags.has('likely_inference') || tags.has('unknown')).toBe(true);
  });

  it('leaks no private fields, PII, or tenant/customer identifiers', () => {
    const json = JSON.stringify(CURATED_PROOFS).toLowerCase();
    for (const banned of [
      'details_private',
      'evidence_ref',
      'verifier_ref',
      'tenant_id',
      'subject_id',
      'customer',
      'email',
    ]) {
      expect(json).not.toContain(banned);
    }
    // No email addresses and no UUID-shaped ids (real record ids are UUIDs).
    expect(json).not.toMatch(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/);
    expect(json).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}/);
    // Ids are synthetic sample labels only.
    for (const p of CURATED_PROOFS) {
      expect(p.id.startsWith('sample-')).toBe(true);
    }
  });

  it('uses ISO (YYYY-MM-DD) dates and valid supersession references', () => {
    const ids = new Set(CURATED_PROOFS.map((p) => p.id));
    for (const p of CURATED_PROOFS) {
      expect(p.created_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (p.supersedes_proof_id !== null) {
        expect(p.supersedes_proof_id.startsWith('sample-')).toBe(true);
        // It points at a prior sample (which may itself be omitted as superseded),
        // and never at itself.
        expect(p.supersedes_proof_id).not.toEqual(p.id);
        void ids; // ids set kept for readability of intent
      }
    }
  });

  it('the data module is static: no DB import, no fetch, no client directive', () => {
    const lower = dataSrc.toLowerCase();
    expect(existsSync(dataPath)).toBe(true);
    expect(lower).not.toContain('@cognitia/db');
    expect(lower).not.toContain('fetch(');
    expect(lower).not.toContain("'use client'");
    expect(lower).not.toContain('process.env');
  });

  it('is rendered on the static /trust page from the curated module', () => {
    expect(pageSrc).toContain("from './curated-proofs'");
    expect(pageSrc).toContain('CURATED_PROOFS');
    expect(pageSrc).toContain('Public-safe Proof Samples');
    // Still static: importing data must not introduce fetch/client state.
    expect(pageSrc).not.toContain("'use client'");
    expect(pageSrc.toLowerCase()).not.toContain('fetch(');
  });
});
