import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { InMemoryRepository } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { ApiHandlers, type ApiRequest } from './handlers.js';

/**
 * V-4b — public trust feed (`GET /public/trust-feed`, unauthenticated).
 * Safety: tenant comes ONLY from server config, never the request (no
 * enumeration); deny-by-default empty; public projection + redaction-passed
 * proofs only; aggregate reputation (no ids). No writes.
 */

const PUBLIC_TENANT = '11111111-1111-1111-1111-111111111111';
const OTHER_TENANT = '22222222-2222-2222-2222-222222222222';
const ENV_KEY = 'COGNITIA_PUBLIC_TENANT_ID';

const ts = '2026-06-14T00:00:00.000Z';

function publicSafeProof(tenant: string, over: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    tenant_id: tenant,
    kind: 'skill_demo',
    subject_type: 'skill',
    subject_id: randomUUID(),
    evidence_tag: 'verified_fact' as const,
    evidence_ref: 'secret-evidence-ref',
    verifier_ref: 'secret-verifier-ref',
    summary_public: 'Public-safe summary.',
    details_private: { secret: 'do-not-leak' },
    public_safe: true,
    redaction_check_passed_at: ts,
    supersedes_proof_id: null,
    external_attestation_ref: null,
    created_at: ts,
    ...over,
  };
}

let repo: InMemoryRepository;
let handlers: ApiHandlers;
const req = (): ApiRequest => ({ traceId: 'trace-public' }); // no tenant, no role

beforeEach(async () => {
  delete process.env[ENV_KEY];
  repo = new InMemoryRepository();
  handlers = new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true }));
});
afterEach(() => {
  delete process.env[ENV_KEY];
});

describe('Public trust feed (V-4b)', () => {
  const SAFE_EMPTY = {
    agents_with_reputation: 0,
    total_events: 0,
    positive_events: 0,
  };

  it('deny-by-default: with no public tenant configured, returns an empty feed (not an error)', async () => {
    const res = await handlers.publicTrustFeed(req());
    expect(res.status).toBe(200);
    const body = res.body as { configured: boolean; proofs: unknown[]; reputation: unknown };
    expect(body.configured).toBe(false);
    expect(body.proofs).toHaveLength(0);
    expect(body.reputation).toEqual(SAFE_EMPTY);
  });

  it('hardening: a malformed (non-UUID) public tenant env is treated as unconfigured — never reaches the repo', async () => {
    // A real public_safe row exists; but the env is garbage, so it must NOT be served.
    await repo.insertProof(publicSafeProof(PUBLIC_TENANT));
    // Spy: if validation works, the repo is never queried for a malformed tenant.
    let listProofsCalled = false;
    const originalListProofs = repo.listProofs.bind(repo);
    repo.listProofs = (async (...args: Parameters<typeof originalListProofs>) => {
      listProofsCalled = true;
      return originalListProofs(...args);
    }) as typeof repo.listProofs;

    for (const bad of ['not-a-uuid', '123', `${PUBLIC_TENANT}-extra`, 'DROP TABLE proofs', '   ']) {
      process.env[ENV_KEY] = bad;
      const res = await handlers.publicTrustFeed(req());
      expect(res.status).toBe(200);
      const body = res.body as { configured: boolean; proofs: unknown[]; reputation: unknown };
      expect(body.configured).toBe(false);
      expect(body.proofs).toHaveLength(0);
      expect(body.reputation).toEqual(SAFE_EMPTY);
    }
    expect(listProofsCalled).toBe(false); // malformed env never reaches repository/DB code
  });

  it('hardening: an internal/DB error never leaks a DB-shaped message — falls back to safe empty', async () => {
    process.env[ENV_KEY] = PUBLIC_TENANT; // valid UUID, so we get past validation
    repo.listProofs = (async () => {
      throw new Error('relation "proofs" does not exist: connection refused at 10.0.0.1:5432');
    }) as typeof repo.listProofs;

    const res = await handlers.publicTrustFeed(req());
    expect(res.status).toBe(200);
    const body = res.body as { configured: boolean; proofs: unknown[]; reputation: unknown };
    expect(body.configured).toBe(false);
    expect(body.proofs).toHaveLength(0);
    expect(body.reputation).toEqual(SAFE_EMPTY);
    // No DB-shaped internals anywhere in the response.
    const json = JSON.stringify(body);
    expect(json).not.toMatch(/relation|connection refused|5432|10\.0\.0\.1|does not exist/i);
  });

  it('serves ONLY public_safe + redaction-passed proofs, public projection only (no private fields)', async () => {
    await repo.insertProof(publicSafeProof(PUBLIC_TENANT));
    // Not public_safe → excluded.
    await repo.insertProof(
      publicSafeProof(PUBLIC_TENANT, {
        id: randomUUID(),
        public_safe: false,
        redaction_check_passed_at: null,
        evidence_ref: null,
        verifier_ref: null,
      }),
    );
    process.env[ENV_KEY] = PUBLIC_TENANT;

    const res = await handlers.publicTrustFeed(req());
    const body = res.body as { configured: boolean; proofs: Array<Record<string, unknown>> };
    expect(body.configured).toBe(true);
    expect(body.proofs).toHaveLength(1);
    const p = body.proofs[0]!;
    // Public projection keys only.
    expect(Object.keys(p).sort()).toEqual(
      ['created_at', 'evidence_tag', 'id', 'kind', 'summary_public', 'supersedes_proof_id'].sort(),
    );
    // Never leak private fields or tenant/subject.
    const json = JSON.stringify(body);
    expect(json).not.toContain('do-not-leak');
    expect(json).not.toContain('secret-evidence-ref');
    expect(json).not.toContain('secret-verifier-ref');
    expect(json).not.toContain('details_private');
    expect(json).not.toContain(PUBLIC_TENANT); // tenant id never appears
  });

  it('takes the tenant ONLY from server config — a request-supplied tenant cannot enumerate', async () => {
    // Seed public_safe proofs in OTHER_TENANT; configure PUBLIC_TENANT (empty).
    await repo.insertProof(publicSafeProof(OTHER_TENANT));
    process.env[ENV_KEY] = PUBLIC_TENANT;

    // Caller tries to point the feed at OTHER_TENANT via the request.
    const res = await handlers.publicTrustFeed({
      traceId: 't',
      tenantId: OTHER_TENANT,
      role: 'owner',
    } as ApiRequest);
    const body = res.body as { proofs: unknown[] };
    expect(body.proofs).toHaveLength(0); // ignored caller tenant; read the empty configured one
  });

  it('reputation is an aggregate summary only — no agent ids or per-agent scores', async () => {
    process.env[ENV_KEY] = PUBLIC_TENANT;
    const res = await handlers.publicTrustFeed(req());
    const body = res.body as { reputation: Record<string, unknown> };
    expect(Object.keys(body.reputation).sort()).toEqual(
      ['agents_with_reputation', 'positive_events', 'total_events'].sort(),
    );
    // No agent identifier surface in the reputation object.
    expect(JSON.stringify(body.reputation)).not.toMatch(/agent_id|[0-9a-f]{8}-[0-9a-f]{4}/i);
  });

  it('V-5: exposes freshness/cache metadata + a Cache-Control header (configured)', async () => {
    process.env[ENV_KEY] = PUBLIC_TENANT;
    const res = await handlers.publicTrustFeed(req());
    expect(res.status).toBe(200);
    expect(res.headers?.['cache-control']).toBe('public, max-age=60');
    const body = res.body as Record<string, unknown>;
    for (const key of [
      'configured',
      'generated_at',
      'feed_version',
      'cache_ttl_seconds',
      'source',
      'proof_limit',
      'proof_count_returned',
      'truncated',
      'proofs',
      'reputation',
    ]) {
      expect(body).toHaveProperty(key);
    }
    expect(body.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(body.cache_ttl_seconds).toBe(60);
    expect(body.proof_limit).toBe(50);
  });

  it('V-5: the safe-empty feed also carries metadata + Cache-Control', async () => {
    delete process.env[ENV_KEY]; // unconfigured
    const res = await handlers.publicTrustFeed(req());
    expect(res.headers?.['cache-control']).toBe('public, max-age=60');
    const body = res.body as Record<string, unknown>;
    expect(body.configured).toBe(false);
    expect(body.feed_version).toBe(1);
    expect(body.proof_count_returned).toBe(0);
    expect(body.truncated).toBe(false);
  });

  it('V-5: proof feed is bounded to the limit and reports truncated=true', async () => {
    // Seed more public_safe proofs than the limit.
    const LIMIT = 50;
    for (let i = 0; i < LIMIT + 2; i++) {
      await repo.insertProof(
        publicSafeProof(PUBLIC_TENANT, {
          id: randomUUID(),
          created_at: `2026-06-${10}T00:00:0${0}.00${i}Z`,
        }),
      );
    }
    process.env[ENV_KEY] = PUBLIC_TENANT;
    const res = await handlers.publicTrustFeed(req());
    const body = res.body as {
      proofs: unknown[];
      proof_count_returned: number;
      truncated: boolean;
    };
    expect(body.proofs).toHaveLength(LIMIT);
    expect(body.proof_count_returned).toBe(LIMIT);
    expect(body.truncated).toBe(true);
  });

  it('V-5: reputation aggregate is sourced from countReputation (no event bodies)', async () => {
    // Two agents, one verified_fact proof; +3, +2, -1 ⇒ 2 agents, 3 events, 2 positive.
    const verified = await repo.insertProof(publicSafeProof(PUBLIC_TENANT, { id: randomUUID() }));
    const a1 = randomUUID();
    const a2 = randomUUID();
    const mkEvent = (agentId: string, delta: number) => ({
      id: randomUUID(),
      tenant_id: PUBLIC_TENANT,
      agent_id: agentId,
      proof_id: verified.id,
      delta,
      reason_code: delta > 0 ? 'verified_delivery' : 'dispute_refund',
      created_at: ts,
    });
    await repo.insertReputationEvent(mkEvent(a1, 3));
    await repo.insertReputationEvent(mkEvent(a2, 2));
    await repo.insertReputationEvent(mkEvent(a1, -1));
    process.env[ENV_KEY] = PUBLIC_TENANT;

    const res = await handlers.publicTrustFeed(req());
    const body = res.body as { reputation: Record<string, number> };
    expect(body.reputation).toEqual({
      agents_with_reputation: 2,
      total_events: 3,
      positive_events: 2,
    });
    // Still no agent ids anywhere in the response.
    expect(JSON.stringify(body.reputation)).not.toContain(a1);
    expect(JSON.stringify(body.reputation)).not.toContain(a2);
  });
});
