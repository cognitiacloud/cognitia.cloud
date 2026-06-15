import { describe, it, expect } from 'vitest';
import { InMemoryRepository } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { ApiHandlers } from './handlers.js';
import { buildServer } from './server.js';
import { HmacSessionVerifier, signSession, type Role } from './auth.js';

const SESSION_SECRET = 'session-secret';
const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';

const ts = '2026-06-06T00:00:00.000Z';

function app() {
  const repo = new InMemoryRepository();
  // Seed tenant A so Mira has a candidate to propose against.
  repo.seedAccount({
    id: 'acc-a',
    tenant_id: TENANT_A,
    name: 'Acme',
    domain: 'acme.com',
    industry: 'SaaS',
    employee_count: 100,
    region: 'NA',
    fit_score: 0.9,
    timing_score: 0.8,
    attributes: {},
    created_at: ts,
    updated_at: ts,
  });
  repo.seedContact({
    id: 'ct-a',
    tenant_id: TENANT_A,
    account_id: 'acc-a',
    full_name: 'Ada',
    title: 'VP Eng',
    persona: 'champion',
    email_hash: 'sha256:ada',
    phone_hash: null,
    is_suppressed: false,
    attributes: {},
    created_at: ts,
    updated_at: ts,
  });
  const handlers = new ApiHandlers(repo, createGtmServices({ repo }), {});
  return buildServer(handlers, { verifier: new HmacSessionVerifier(SESSION_SECRET) });
}

function session(tenantId: string, role: Role = 'operator') {
  return `Bearer ${signSession(SESSION_SECRET, { tenantId, userRef: 'user:x', role }, 3_600_000)}`;
}

describe('server auth — tenant from session, not headers', () => {
  it('rejects operator routes with no session (401)', async () => {
    const res = await app().inject({ method: 'GET', url: '/accounts' });
    expect(res.statusCode).toBe(401);
  });

  it('a forged x-tenant-id cannot override the session tenant', async () => {
    const server = app();
    // Session for tenant A, but attacker spoofs x-tenant-id = B.
    const run = await server.inject({
      method: 'POST',
      url: '/agent-runs/mira',
      headers: {
        'content-type': 'application/json',
        authorization: session(TENANT_A),
        'x-tenant-id': TENANT_B, // ignored
      },
      payload: JSON.stringify({ objective: 'outbound' }),
    });
    expect(run.statusCode).toBe(201);

    // The run + its actions are scoped to A; B (even spoofed) sees nothing.
    const asA = await server.inject({
      method: 'GET',
      url: '/agent-actions?status=proposed',
      headers: { authorization: session(TENANT_A) },
    });
    expect((asA.json() as { actions: unknown[] }).actions.length).toBeGreaterThan(0);

    const asB = await server.inject({
      method: 'GET',
      url: '/agent-actions?status=proposed',
      headers: { authorization: session(TENANT_B), 'x-tenant-id': TENANT_A },
    });
    expect((asB.json() as { actions: unknown[] }).actions).toHaveLength(0);
  });

  it('a viewer session cannot run/approve/execute (403)', async () => {
    const res = await app().inject({
      method: 'POST',
      url: '/agent-runs/mira',
      headers: {
        'content-type': 'application/json',
        authorization: session(TENANT_A, 'viewer'),
      },
      payload: JSON.stringify({ objective: 'outbound' }),
    });
    expect(res.statusCode).toBe(403);
  });

  it('an invalid/expired token is rejected (401)', async () => {
    const res = await app().inject({
      method: 'GET',
      url: '/accounts',
      headers: { authorization: 'Bearer not-a-valid-token' },
    });
    expect(res.statusCode).toBe(401);
  });
});
