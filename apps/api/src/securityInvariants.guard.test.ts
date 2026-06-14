import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { OWNER_ONLY_HANDLERS, MUTATING_HANDLERS } from './authzMatrix.js';

/**
 * Security-invariant guards (Item 1). These FAIL the build if a core guarantee
 * is structurally weakened in apps/api/src/server.ts — so a future edit can't
 * silently drop authentication, rate limiting, the x-tenant-id ban, or the
 * fail-closed startup guards. Source-level checks, not behavior (behavior is in
 * security.regression.test.ts).
 */

const here = dirname(fileURLToPath(import.meta.url));
const server = readFileSync(join(here, 'server.ts'), 'utf8');

/** Routes intentionally NOT session-authenticated (own auth / liveness). */
const UNAUTH_ALLOWLIST = new Set([
  '/health', // liveness; reports DB connectivity
  '/webhooks/hubspot', // HMAC-signature gated
  '/webhooks/inbound-lead', // 501 seam / signed
  '/jobs/crm-sync', // 501 seam / signed
]);

describe('security invariants — server.ts', () => {
  it('every route is session-authenticated unless explicitly allowlisted', () => {
    const lines = server.split('\n');
    const offenders: string[] = [];
    const routeRe = /\b(?:app|webhookScope)\.(get|post|put|delete)\(\s*'([^']+)'/;
    lines.forEach((line, i) => {
      const m = routeRe.exec(line);
      if (!m) return;
      const path = m[2]!;
      // The handler dispatch may be on this line or the next two.
      const block = [line, lines[i + 1] ?? '', lines[i + 2] ?? ''].join('\n');
      const authed = /sendAuthed\(/.test(block);
      if (!authed && !UNAUTH_ALLOWLIST.has(path)) {
        offenders.push(`${path} (line ${i + 1})`);
      }
    });
    expect(offenders).toEqual([]);
  });

  it('a global rate limit is registered (abuse/DoS protection)', () => {
    expect(/app\.register\(\s*rateLimit/.test(server)).toBe(true);
    expect(/max:\s*opts\.rateLimitMax/.test(server)).toBe(true);
  });

  it('only /health opts out of rate limiting', () => {
    const optOuts = server
      .split('\n')
      .filter((l) => /rateLimit:\s*false/.test(l) && /app\.(get|post|put|delete)\(/.test(l));
    expect(optOuts).toHaveLength(1);
    expect(optOuts[0]).toContain("'/health'");
  });

  it('the operator request shape never trusts x-tenant-id (only the webhook shape may)', () => {
    // x-tenant-id may appear ONLY inside toWebhookReq (signature-gated) — never
    // in toReq or sendAuthed, where the tenant comes from the verified session.
    const toReq = server.slice(server.indexOf('const toReq'), server.indexOf('const fullUri'));
    const sendAuthed = server.slice(
      server.indexOf('const sendAuthed'),
      server.indexOf('// --- health'),
    );
    expect(toReq.includes('x-tenant-id')).toBe(false);
    expect(sendAuthed.includes('x-tenant-id')).toBe(false);
    // And the webhook shape DOES (documented, signature-gated) — proving the
    // ban is scoped, not accidental.
    expect(server.includes("headerStr(request.headers['x-tenant-id'])")).toBe(true);
  });

  it('fail-closed startup guards are present (RLS role + secrets in production)', () => {
    expect(server.includes('assertEnforcedRlsRole')).toBe(true);
    expect(server.includes('isProductionDeploy')).toBe(true);
    expect(server.includes('SecretConfigError')).toBe(true);
    expect(server.includes('requireKeyBytes')).toBe(true);
  });
});

describe('authz surface — every privileged handler is in the tested manifest (Item 3)', () => {
  // Map each handler name to the role gate it directly invokes, by scanning each
  // handler body until the next handler. A NEW directly-gated handler that isn't
  // in authzMatrix.ts (and thus has no negative test) fails this guard.
  const handlersSrc = readFileSync(join(here, 'handlers.ts'), 'utf8');
  // Internal helpers (not HTTP route handlers) that legitimately gate; excluded.
  const NON_ROUTE_GATED = new Set(['batchDecide']);

  function gatedHandlers(gate: string): string[] {
    const names: string[] = [];
    const lines = handlersSrc.split('\n');
    let cur: string | null = null;
    for (const line of lines) {
      const m = /^\s{2}(?:async\s+)?([a-zA-Z]+)\(req/.exec(line);
      if (m) cur = m[1]!;
      if (cur && new RegExp(`${gate}\\(req\\)`).test(line)) {
        names.push(cur);
        cur = null; // first gate wins
      }
    }
    return names.filter((n) => !NON_ROUTE_GATED.has(n));
  }

  it('every requireOwner handler is in OWNER_ONLY_HANDLERS', () => {
    const owners = new Set(gatedHandlers('requireOwner'));
    const manifest = new Set<string>(OWNER_ONLY_HANDLERS);
    const missing = [...owners].filter((n) => !manifest.has(n));
    expect(missing).toEqual([]); // a privileged handler with no negative test
  });

  it('every requireMutatingRole handler is in MUTATING_HANDLERS (or delegates via batch*)', () => {
    const mutating = new Set(gatedHandlers('requireMutatingRole'));
    const manifest = new Set<string>([...MUTATING_HANDLERS, 'batchApprove', 'batchReject']);
    const missing = [...mutating].filter((n) => !manifest.has(n));
    expect(missing).toEqual([]);
  });
});
