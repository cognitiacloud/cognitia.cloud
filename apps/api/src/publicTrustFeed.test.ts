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
  it('deny-by-default: with no public tenant configured, returns an empty feed (not an error)', async () => {
    const res = await handlers.publicTrustFeed(req());
    expect(res.status).toBe(200);
    const body = res.body as { configured: boolean; proofs: unknown[]; reputation: unknown };
    expect(body.configured).toBe(false);
    expect(body.proofs).toHaveLength(0);
    expect(body.reputation).toEqual({
      agents_with_reputation: 0,
      total_events: 0,
      positive_events: 0,
    });
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
});
