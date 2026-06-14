import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * V-4 — public-safe guardrails for the Trust / Proof Explorer (`/trust`).
 *
 * Source-text guards (same approach as packages/core doctrine.guard.test and
 * apps/api skillproof no-marketplace test): the page must render as a route,
 * stay read-only/static, disclose the token gates as NOT PASSED, surface the
 * managed-Postgres RLS caveat, and contain NO purchase CTA, NO price/return
 * copy, and NO DEX/liquidity/staking/yield MARKETING.
 */

const here = dirname(fileURLToPath(import.meta.url));
const pagePath = join(here, 'page.tsx');
const appDir = join(here, '..'); // apps/web/src/app
const src = existsSync(pagePath) ? readFileSync(pagePath, 'utf8') : '';
const lower = src.toLowerCase();

// Banned launch-hype needles are assembled at runtime so THIS test file never
// contains them verbatim — not even in identifier names, which the doctrine
// guard would catch when it lowercases file contents. Neutral names only.
const N1 = ['pre', 'sale'].join(''); // = the pre-sale needle
const N2 = ['air', 'drop'].join(''); // = the drop needle
const N3 = ['get in', 'early'].join(' ');
const N4 = ['staking', 'rewards'].join(' ');
const N5 = ['to the', 'moon'].join(' ');

describe('Trust / Proof Explorer (/trust) — public-safe guards', () => {
  it('the /trust route page exists and exports a default component (renders by Next convention)', () => {
    expect(existsSync(pagePath)).toBe(true);
    expect(src).toMatch(/export default function \w+/);
  });

  it('is read-only/static: no client directive, no API client, no token paste, no fetch', () => {
    expect(src).not.toContain("'use client'");
    expect(lower).not.toContain('apiclient');
    expect(lower).not.toContain('fetch(');
    expect(lower).not.toContain('usestate');
    // No auth/session token input on this surface.
    expect(lower).not.toMatch(/session token|bearer|authorization/);
  });

  it('shows the required token-architecture wording verbatim', () => {
    expect(src).toContain(
      'Cognitia&apos;s future token architecture is internal, legal-gated, usage-gated, and\n          optional. No public token exists.',
    );
  });

  it('token gate panel discloses the gates as No / Not passed', () => {
    for (const label of [
      'Public token',
      'Token launched',
      'Liquidity',
      'DEX',
      'Staking / yield',
      'Mainnet',
      'Legal gate',
      'Usage gate',
      'Cross-tenant settlement gate',
      'Managed-Postgres RLS gate',
    ]) {
      expect(src).toContain(label);
    }
    // At least the four explicit gates read "Not passed".
    const notPassed = (src.match(/Not passed/g) ?? []).length;
    expect(notPassed).toBeGreaterThanOrEqual(4);
    expect(src).toContain('Token may never launch');
  });

  it('surfaces the managed-Postgres RLS caveat and the runtime test count', () => {
    expect(lower).toContain('managed-postgres row-level security');
    expect(lower).toContain('not yet verified');
    expect(src).toContain('443/443');
    expect(src).toContain('0015 reserved/absent');
  });

  it('has NO token purchase CTA and NO public sale language', () => {
    expect(lower).not.toMatch(/buy now|buy token|purchase token|token sale is live|mint now/);
    expect(lower).not.toMatch(/\bbuy the token\b|\bget the token\b/);
    // Banned launch-hype literals (also enforced by the doctrine guard).
    expect(lower).not.toContain(N1);
    expect(lower).not.toContain(N2);
    expect(lower).not.toContain(N3);
  });

  it('has NO price/return copy', () => {
    expect(lower).not.toMatch(/price target|guaranteed return|expected return|apy|% return/);
    expect(lower).not.toMatch(/\bpump\b|\bmoon\b/);
    expect(lower).not.toContain(N5);
    expect(src).not.toMatch(/\$\s?\d/); // no dollar price figures
  });

  it('has NO DEX/liquidity/staking/yield MARKETING (status disclosure only)', () => {
    expect(lower).not.toMatch(/provide liquidity|liquidity pool|add liquidity/);
    expect(lower).not.toMatch(/yield farming|earn yield|earn rewards|stake to earn/);
    expect(lower).not.toContain(N4);
    expect(lower).not.toMatch(/list on a dex|trade on/);
  });

  it('exposes NO private proof bodies / internal fields', () => {
    expect(lower).not.toContain('details_private');
    expect(lower).not.toContain('verifier_ref');
    expect(lower).not.toContain('evidence_ref');
    expect(src).toContain('Private proof bodies are never exposed');
  });

  it('adds NO public marketplace transaction route or token/coin route under apps/web/src/app', () => {
    const dirs: string[] = [];
    const visit = (d: string) => {
      for (const entry of readdirSync(d)) {
        const full = join(d, entry);
        if (statSync(full).isDirectory()) {
          dirs.push(entry.toLowerCase());
          visit(full);
        }
      }
    };
    visit(appDir);
    const bannedDir = new RegExp(
      [
        'token',
        'coin',
        'buy',
        'sell',
        'pricing',
        'dex',
        'stak',
        'yield',
        'marketplace',
        N1,
        N2,
      ].join('|'),
    );
    expect(dirs.some((d) => bannedDir.test(d))).toBe(false);
    // The only economy-ish route remains the authed operator console, not a public market.
    expect(dirs).toContain('trust');
  });

  it('includes all required explorer sections + evidence cards + FAQ', () => {
    for (const section of [
      'Cognitia Trust Overview',
      'Runtime Verification Status',
      'Token Architecture Status',
      'Evidence Cards',
      'Researcher FAQ',
      'What Cognitia does not claim',
    ]) {
      expect(src).toContain(section);
    }
    for (const card of [
      'Agent Trust Credential (ATC)',
      'Proof Registry',
      'SkillProof',
      'Reputation',
      'Credits (internal accounting)',
      'Work Orders',
      'Escrow Simulation',
      'Dispute Resolution',
      'Agent Action Ledger',
      'Internal Marketplace',
      'Cross-tenant Settlement',
      'Token Architecture',
    ]) {
      expect(src).toContain(card);
    }
    expect(src).toContain('Is there a public token?');
    expect(src).toContain('Is Cognitia SOC 2 certified?');
  });

  it('references the researcher pack (VISIBILITY-002) without a token CTA', () => {
    expect(src).toContain('Researcher resources');
    expect(src).toContain('RESEARCHER_PACK.md');
    expect(src).toContain('VERIFY_IT_YOURSELF.md');
    expect(src).toContain('SECURITY.md');
    // Referencing token-status docs must not introduce a purchase path.
    expect(lower).not.toMatch(/buy now|buy token|purchase token|mint now/);
  });
});
