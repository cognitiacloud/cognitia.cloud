import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * AUDIT-BOOKLET-001B — documentation guard for the Agent Fabric Lab.
 *
 * The Agent Fabric Lab v0 is BUILT but is internal/operator-only and
 * SIMULATION-ONLY. These checks keep the docs honest: they must say
 * simulation-only and must NOT claim real remote execution, a built Tailscale
 * integration, decentralized/unstoppable/production-ready status, or token
 * payments. The docs deliberately *negate* those things, so the must-not checks
 * target only AFFIRMATIVE claims (which never appear, even via the negations).
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const read = (...rel: string[]) => {
  const p = join(repoRoot, ...rel);
  return existsSync(p) ? readFileSync(p, 'utf8') : '';
};

const legend = read('docs', 'cognitia', 'execution', 'LEGEND_001_AGENT_FABRIC_LAB.md');
const booklet = read(
  'docs',
  'cognitia',
  'audits',
  'AUDIT_BOOKLET_001',
  'COGNITIA_SYSTEM_BOOKLET_V1.md',
);
const inventory = read(
  'docs',
  'cognitia',
  'audits',
  'AUDIT_BOOKLET_001',
  'COMPLETE_FEATURE_INVENTORY.md',
);
const boundaries = read('docs', 'cognitia', 'public', 'TRUST_BOUNDARIES.md');
const pack = read('docs', 'cognitia', 'public', 'RESEARCHER_PACK.md');

const docs = { legend, booklet, inventory, boundaries, pack };
const corpus = Object.values(docs).join('\n').toLowerCase();
const flat = corpus.replace(/\s+/g, ' ');

// AFFIRMATIVE-unsafe needles. Each is shaped so the docs' honest negations
// ("does not execute remote commands", "Tailscale connector remains future",
// "not production-deployed", "does not make Cognitia unstoppable", "no token
// payments") do NOT match.
const REMOTE_EXEC =
  /executes? real remote|now executes? remote|real remote execution (is|are|now)[^.\n]{0,24}(built|live|enabled|supported|available|production)/;
const TAILSCALE_BUILT =
  /tailscale[^.\n]{0,40}\b(is|now)\b[^.\n]{0,24}\b(built|integrated|connected|enabled|live|wired)\b/;
const UNSTOPPABLE = /\bis unstoppable\b|cannot be shut down|impossible to shut down/;
const PRODUCTION_READY = /\bis production-ready\b|\bnow production-ready\b/;
const DECENTRALIZED = /\b(is|now|fully) decentralized\b/;
const TOKEN_PAYMENT =
  /token payments? (are|is|now)[^.\n]{0,24}(supported|enabled|live|built|available)|pays? in tokens?|token transfers? (are|is)[^.\n]{0,24}(supported|enabled|live)/;

describe('AUDIT-BOOKLET-001B agent-fabric docs guard', () => {
  it('the fabric docs all exist and are substantial', () => {
    for (const [name, body] of Object.entries(docs)) {
      expect(body.length, `${name} should be non-empty`).toBeGreaterThan(300);
    }
  });

  it('the primary fabric doc states simulation-only', () => {
    expect(legend.toLowerCase()).toMatch(/simulation[- ]only/);
  });

  it('the docs disclose that there is no real remote execution', () => {
    expect(flat).toMatch(
      /no (uncontrolled |real )?remote execution|does not execute remote|no real remote/,
    );
    // And the simulation framing is present in the corpus.
    expect(flat).toContain('simulation');
  });

  it('the docs frame Tailscale + cloud routing as NOT integrated yet', () => {
    expect(flat).toContain('tailscale');
    expect(TAILSCALE_BUILT.test(corpus), 'must not claim Tailscale is built/integrated').toBe(
      false,
    );
  });

  it('the docs make NO affirmative real-remote-execution claim', () => {
    expect(REMOTE_EXEC.test(corpus)).toBe(false);
  });

  it('the docs make NO decentralized / unstoppable / production-ready claim', () => {
    expect(DECENTRALIZED.test(corpus)).toBe(false);
    expect(UNSTOPPABLE.test(corpus)).toBe(false);
    expect(PRODUCTION_READY.test(corpus)).toBe(false);
  });

  it('the docs imply NO token payments in the fabric', () => {
    expect(TOKEN_PAYMENT.test(corpus)).toBe(false);
    // The honest framing (escrow stays a human verify) should be present.
    expect(flat).toMatch(/no token payments|escrow (release )?(is still |stays )?(the )?human/);
  });
});
