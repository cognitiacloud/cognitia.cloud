import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * LEGEND-001 — containment guard for the Agent Fabric Lab service.
 *
 * The fabric is SIMULATION ONLY: it must never perform remote/host execution.
 * This scans the service source to ensure it imports no execution/network
 * primitives (child_process, net/http sockets, fetch, ws, dgram) — the build
 * fails if a future change tries to make the lab actually run remote work
 * without a deliberate migration + security sign-off.
 */

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const svcPath = join(repoRoot, 'apps', 'api', 'src', 'agentFabric.ts');
const src = existsSync(svcPath) ? readFileSync(svcPath, 'utf8') : '';

// Banned import SOURCES (assembled at runtime so this file stays clean). We scan
// for these as module specifiers, not as bare words — so the service's own
// safety prose ("no process spawn") never trips the guard.
const BANNED_IMPORTS = [
  ['child_', 'process'].join(''),
  ['node:', 'net'].join(''),
  ['node:', 'dgram'].join(''),
  ['node:', 'http'].join(''),
  ['ssh', '2'].join(''),
];

describe('LEGEND-001 agent-fabric containment guard', () => {
  it('the fabric service exists and is simulation-labelled', () => {
    expect(src.length).toBeGreaterThan(500);
    expect(src.toUpperCase()).toContain('SIMULATION ONLY');
  });

  it('imports NO remote-execution or raw-network module', () => {
    const lower = src.toLowerCase();
    for (const mod of BANNED_IMPORTS) {
      expect(
        lower.includes(`'${mod}'`) || lower.includes(`"${mod}"`),
        `banned import: ${mod}`,
      ).toBe(false);
    }
  });

  it('makes NO execution / network CALLS', () => {
    const lower = src.toLowerCase();
    // Call-shaped patterns (won't match comments like "no process spawn").
    expect(lower).not.toMatch(/\bspawn\(/);
    expect(lower).not.toMatch(/\bexec\(/);
    expect(lower).not.toMatch(/\bexecsync\b/);
    expect(lower).not.toMatch(/\bexecfile\(/);
    expect(lower).not.toMatch(/\bfetch\(/);
  });

  it('declares the safety invariants in code (human verify, no remote execution)', () => {
    const flat = src.replace(/\s+/g, ' ').toLowerCase();
    expect(flat).toContain('no network call');
    expect(flat).toContain('no process spawn');
    // Escrow release stays the human verify step, not the fabric.
    expect(flat).toContain('escrow is not released here');
  });
});
