import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { InMemoryRepository } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { ApiHandlers, type ApiRequest } from './handlers.js';
import { computeInputsHash } from './reputation.js';

/**
 * COG-008 — Reputation v0 (Command Book §E #2–#4 at the surface level, plus
 * snapshot reproducibility): score = Σ verified-backed deltas, recompute
 * appends reproducible snapshots, and no route exists to post reputation
 * events directly.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const here = dirname(fileURLToPath(import.meta.url));

const asRole = (
  role: 'viewer' | 'operator' | 'owner',
  over: Partial<ApiRequest> = {},
): ApiRequest => ({ tenantId: TENANT, role, traceId: 'trace-reputation', ...over });

describe('Reputation v0 (COG-008)', () => {
  let handlers: ApiHandlers;
  let repo: InMemoryRepository;
  let agentId: string;
  let leadId: string;

  beforeEach(async () => {
    repo = new InMemoryRepository();
    handlers = new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true }));
    const agent = await handlers.registerAgent(
      asRole('operator', { body: { name: 'Front Desk', slug: 'front-desk', kind: 'front_desk' } }),
    );
    agentId = (agent.body as { agent: { id: string } }).agent.id;
    const lead = await handlers.ingestLead(
      asRole('operator', {
        body: {
          source: 'manual',
          contact_phone: '604-555-0190',
          message_body: 'quote please',
          consent_captured: true,
        },
      }),
    );
    leadId = (lead.body as { lead: { id: string } }).lead.id;
  });

  const bookVerified = (ref: string, cents: number) =>
    handlers.createLeadOutcome(
      asRole('operator', {
        params: { id: leadId },
        body: {
          outcome: 'booked_job',
          evidence_tag: 'verified_fact',
          evidence_source: ref,
          booked_value_cents: cents,
          agent_id: agentId,
        },
      }),
    );

  it('score sums only proof-backed events; non-verified outcomes contribute nothing (#2–#4)', async () => {
    await bookVerified('crm:deal:r1', 100_000);
    await handlers.createLeadOutcome(
      asRole('operator', {
        params: { id: leadId },
        body: { outcome: 'booking_intent', evidence_tag: 'likely_inference', agent_id: agentId },
      }),
    );
    await handlers.createLeadOutcome(
      asRole('operator', {
        params: { id: leadId },
        body: { outcome: 'unknown', evidence_tag: 'unknown', agent_id: agentId },
      }),
    );

    const res = await handlers.getAgentReputation(asRole('viewer', { params: { id: agentId } }));
    const view = res.body as { score: number; event_count: number };
    expect(view.event_count).toBe(1); // only the verified_fact booking created an event
    expect(view.score).toBe(5); // booked_job delta
  });

  it('recompute appends a reproducible snapshot and is a no-op when current', async () => {
    await bookVerified('crm:deal:r2', 100_000);

    const first = await handlers.recomputeReputation(
      asRole('operator', { params: { id: agentId } }),
    );
    const firstBody = first.body as {
      snapshot: { score: number; inputs_hash: string };
      was_current: boolean;
    };
    expect(firstBody.was_current).toBe(false);
    expect(firstBody.snapshot.score).toBe(5);

    // Reproducible: the hash matches an independent recomputation.
    const events = await repo.listReputationEvents(TENANT, agentId);
    expect(firstBody.snapshot.inputs_hash).toBe(computeInputsHash(events));

    // Unchanged events → recompute is a no-op (no new snapshot row).
    const second = await handlers.recomputeReputation(
      asRole('operator', { params: { id: agentId } }),
    );
    expect((second.body as { was_current: boolean }).was_current).toBe(true);
    expect(await repo.listReputationSnapshots(TENANT, agentId)).toHaveLength(1);

    // New verified event → snapshot is stale, recompute appends.
    await bookVerified('crm:deal:r3', 50_000);
    const view = await handlers.getAgentReputation(asRole('viewer', { params: { id: agentId } }));
    expect((view.body as { snapshot_current: boolean }).snapshot_current).toBe(false);
    const third = await handlers.recomputeReputation(
      asRole('operator', { params: { id: agentId } }),
    );
    expect((third.body as { was_current: boolean }).was_current).toBe(false);
    expect(await repo.listReputationSnapshots(TENANT, agentId)).toHaveLength(2);
  });

  it('no route or handler exists to POST reputation events directly', async () => {
    const serverSrc = readFileSync(join(here, 'server.ts'), 'utf8');
    const postPaths = [...serverSrc.matchAll(/app\.post\('([^']+)'/g)].map((m) => m[1]!);
    expect(postPaths.some((p) => /reputation/.test(p) && !/recompute/.test(p))).toBe(false);

    const names = Object.getOwnPropertyNames(Object.getPrototypeOf(handlers));
    expect(names.some((n) => /reputation/i.test(n) && /(create|insert|post|add)/i.test(n))).toBe(
      false,
    );
  });

  it('reputation reads are viewer-allowed; recompute needs a mutating role; 404 on unknown agent', async () => {
    await expect(
      handlers.recomputeReputation(asRole('viewer', { params: { id: agentId } })),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      handlers.getAgentReputation(
        asRole('viewer', { params: { id: 'c0ffee00-0000-0000-0000-000000000000' } }),
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});
