import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  InMemoryRepository,
  verifyAuditChain,
  type ContactRow,
  type AuditEventRow,
} from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { FakeHubspotClient } from '@cognitia/integrations';
import { ApiHandlers, type ApiRequest } from './handlers.js';
import { buildServer } from './server.js';
import { HmacSessionVerifier, signSession, type Role } from './auth.js';
import { OWNER_ONLY_HANDLERS, MUTATING_HANDLERS } from './authzMatrix.js';

/**
 * Behavioral security regression suite (Item 1). Proves the controls FIRE:
 * rate-limit 429 + /health exemption; the owner-only / mutating-role authz
 * matrix; cross-tenant isolation at the handler boundary; and audit-chain
 * tamper detection. Each guarantee gets an executable regression test so it
 * cannot silently weaken.
 */

const SECRET = 'session-secret-at-least-32-chars-long!!';
const TENANT_A = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';
const ts = '2026-06-10T00:00:00.000Z';

function makeHandlers(repo: InMemoryRepository): ApiHandlers {
  return new ApiHandlers(
    repo,
    createGtmServices({ repo, v1Mode: true, hubspotClient: new FakeHubspotClient() }),
  );
}

/** Await a handler call expected to throw HttpError; return its status. */
const errStatus = (p: Promise<unknown>): Promise<number | undefined> =>
  p.then(
    () => undefined,
    (e) => (e as { status?: number }).status,
  );

// --- rate limiting actually fires ---------------------------------------------

describe('security regression — rate limiting fires (CWE-770)', () => {
  function app(max: number) {
    const repo = new InMemoryRepository();
    repo.seedAccount({
      id: 'acc-a',
      tenant_id: TENANT_A,
      name: 'Acme',
      domain: null,
      industry: null,
      employee_count: null,
      region: null,
      fit_score: null,
      timing_score: null,
      attributes: {},
      created_at: ts,
      updated_at: ts,
    });
    return buildServer(makeHandlers(repo), {
      verifier: new HmacSessionVerifier(SECRET),
      rateLimitMax: max,
    });
  }
  const session = () =>
    `Bearer ${signSession(SECRET, { tenantId: TENANT_A, userRef: 'u', role: 'operator' }, 3_600_000)}`;

  it('an authed route returns 429 once the per-client ceiling is exceeded', async () => {
    const server = app(2);
    const hit = () =>
      server.inject({
        method: 'GET',
        url: '/accounts',
        headers: { authorization: session() },
        remoteAddress: '203.0.113.7', // stable client key so the counter accumulates
      });
    expect((await hit()).statusCode).toBe(200);
    expect((await hit()).statusCode).toBe(200);
    expect((await hit()).statusCode).toBe(429); // ceiling exceeded
  });

  it('/health is exempt — it never 429s under the same pressure', async () => {
    const server = app(1);
    for (let i = 0; i < 5; i++) {
      const r = await server.inject({
        method: 'GET',
        url: '/health',
        remoteAddress: '203.0.113.8',
      });
      expect(r.statusCode).toBe(200);
    }
  });
});

// --- authz matrix --------------------------------------------------------------

describe('security regression — authz matrix', () => {
  let repo: InMemoryRepository;
  let handlers: ApiHandlers;
  const req = (role: Role, over: Partial<ApiRequest> = {}): ApiRequest => ({
    tenantId: TENANT_A,
    role,
    userRef: 'u',
    params: { id: 'x' },
    ...over,
  });

  beforeEach(() => {
    repo = new InMemoryRepository();
    handlers = makeHandlers(repo);
  });

  type Dispatch = Record<string, (r: ApiRequest) => Promise<unknown>>;
  const callHandler = (name: string, r: ApiRequest) => (handlers as unknown as Dispatch)[name]!(r);

  // EXHAUSTIVE: every owner-only handler rejects operator AND viewer (the role
  // gate runs first, before any body/param use, so a minimal req suffices).
  it.each(OWNER_ONLY_HANDLERS)('owner-only %s rejects operator and viewer (403)', async (name) => {
    for (const role of ['operator', 'viewer'] as const) {
      expect(await errStatus(callHandler(name, req(role, { body: {} })))).toBe(403);
    }
  });

  // EXHAUSTIVE: every mutating handler rejects viewer.
  it.each(MUTATING_HANDLERS)('mutating %s rejects viewer (403)', async (name) => {
    expect(await errStatus(callHandler(name, req('viewer', { body: {} })))).toBe(403);
  });

  it('an unauthenticated request (no tenant) is 401, not silently allowed', async () => {
    expect(await errStatus(handlers.auditTrail({} as ApiRequest))).toBe(401);
  });
});

// --- cross-tenant isolation at the handler boundary ---------------------------

describe('security regression — cross-tenant isolation', () => {
  it("tenant A cannot DSAR-export or erase tenant B's contact (404, not leaked)", async () => {
    const repo = new InMemoryRepository();
    const handlers = makeHandlers(repo);
    const contactB: ContactRow = {
      id: 'ct-b',
      tenant_id: TENANT_B,
      account_id: null,
      full_name: 'Bravo',
      title: null,
      persona: null,
      email_hash: 'sha256:b',
      phone_hash: null,
      is_suppressed: false,
      attributes: {},
      created_at: ts,
      updated_at: ts,
    };
    repo.seedContact(contactB);
    const asA = {
      tenantId: TENANT_A,
      role: 'owner' as const,
      userRef: 'u',
      params: { id: 'ct-b' },
    };
    expect(await errStatus(handlers.dsarExport(asA))).toBe(404);
    expect(await errStatus(handlers.dsarErase(asA))).toBe(404);
    // B's data is untouched.
    expect((await repo.getContact(TENANT_B, 'ct-b'))!.full_name).toBe('Bravo');
  });
});

// --- audit-chain tamper detection ---------------------------------------------

describe('security regression — audit-chain tamper evidence', () => {
  async function chain(repo: InMemoryRepository): Promise<AuditEventRow[]> {
    for (let i = 1; i <= 3; i++) {
      await repo.insertAuditEvent({
        id: randomUUID(),
        tenant_id: TENANT_A,
        actor_ref: 'user:op',
        action: `evt_${i}`,
        subject_ref: `agent_action:a${i}`,
        detail: {},
        occurred_at: `2026-06-1${i}T00:00:00.000Z`,
        created_at: `2026-06-1${i}T00:00:00.000Z`,
      });
    }
    return repo.listAuditEvents(TENANT_A);
  }

  it('a content mutation is detected (hash_mismatch); an intact chain verifies', async () => {
    const repo = new InMemoryRepository();
    const events = await chain(repo);
    expect(verifyAuditChain(events).ok).toBe(true);

    // Tamper: change an event's content but keep its stored hash.
    const tampered = events.map((e, i) => (i === 1 ? { ...e, action: 'forged' } : e));
    const v = verifyAuditChain(tampered);
    expect(v.ok).toBe(false);
    expect(v.failure).toBe('hash_mismatch');
  });

  it('a dropped event breaks the chain (broken_link)', async () => {
    const repo = new InMemoryRepository();
    const events = await chain(repo);
    const truncated = events.filter((_, i) => i !== 1); // drop the middle event
    const v = verifyAuditChain(truncated);
    expect(v.ok).toBe(false);
    expect(v.failure).toBe('broken_link');
  });
});
