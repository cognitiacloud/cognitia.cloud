import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository, type SkillVersionRow } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { ApiHandlers, type ApiRequest } from './handlers.js';
import { registerAgent, issueAtc } from './atc.js';

/**
 * AGENT-ECONOMY-004 — internal Marketplace Lab. Listings are discoverable,
 * internal-only offers; matching ranks active listings as `likely_inference`
 * proposals (never guarantees); work orders can be created from listings,
 * reusing the existing governed work-order path. A listing never moves credits
 * or reputation by itself. No public marketplace, no token, no real payments.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const actor = 'user:test';
const trace = 'trace-economy';

const asRole = (
  role: 'viewer' | 'operator' | 'owner',
  over: Partial<ApiRequest> = {},
): ApiRequest => ({
  tenantId: TENANT,
  role,
  traceId: trace,
  ...over,
});
const operator = (over: Partial<ApiRequest> = {}) => asRole('operator', over);

interface Market {
  repo: InMemoryRepository;
  handlers: ApiHandlers;
  requesterId: string;
  ownerAgentId: string; // active ATC + reputation
  tier0VersionId: string;
  tier1VersionId: string;
  tier3VersionId: string;
  yankedVersionId: string;
}

async function makeVersion(
  repo: InMemoryRepository,
  skillId: string,
  over: Partial<SkillVersionRow>,
): Promise<string> {
  const ts = new Date().toISOString();
  const v = await repo.insertSkillVersion({
    id: randomUUID(),
    tenant_id: TENANT,
    skill_id: skillId,
    version: '1.0.0',
    spec: {},
    status: 'active',
    manifest_hash: null,
    content_hash: null,
    metadata: {},
    proof_tier: 0,
    yanked: false,
    yank_reason: null,
    created_at: ts,
    updated_at: ts,
    ...over,
  });
  return v.id;
}

async function makeMarket(): Promise<Market> {
  const repo = new InMemoryRepository();
  const handlers = new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true }));

  const { agent: requester } = await registerAgent(
    repo,
    TENANT,
    { name: 'Requester', slug: 'requester', kind: 'internal_ops' },
    actor,
    trace,
  );
  const { agent: ownerAgent } = await registerAgent(
    repo,
    TENANT,
    { name: 'Worker', slug: 'worker', kind: 'internal_ops' },
    actor,
    trace,
  );
  await issueAtc(
    repo,
    TENANT,
    ownerAgent.id,
    { claims: { scope: ['skill.execute'] } },
    actor,
    trace,
  );

  // Reputation snapshot for the owner agent (so matching can use it).
  const ts = new Date().toISOString();
  await repo.insertReputationSnapshot({
    id: randomUUID(),
    tenant_id: TENANT,
    agent_id: ownerAgent.id,
    score: 40,
    computed_at: ts,
    inputs_hash: 'h',
    created_at: ts,
  });

  const skill = await repo.upsertSkill({
    id: randomUUID(),
    tenant_id: TENANT,
    name: 'Research Brief',
    slug: 'research-brief',
    category: 'analysis',
    description: null,
    visibility: 'internal',
    namespace: 'cognitia.core',
    source_path: null,
    owner_agent_id: ownerAgent.id,
    created_at: ts,
    updated_at: ts,
  });

  return {
    repo,
    handlers,
    requesterId: requester.id,
    ownerAgentId: ownerAgent.id,
    tier0VersionId: await makeVersion(repo, skill.id, { proof_tier: 0 }),
    tier1VersionId: await makeVersion(repo, skill.id, { proof_tier: 1 }),
    tier3VersionId: await makeVersion(repo, skill.id, { proof_tier: 3 }),
    yankedVersionId: await makeVersion(repo, skill.id, { proof_tier: 2, yanked: true }),
  };
}

type ListingBody = Record<string, unknown>;
async function create(m: Market, body: ListingBody) {
  return m.handlers.createListing(operator({ body }));
}
function listingOf(res: { body: unknown }) {
  return (res.body as { listing: { id: string; [k: string]: unknown } }).listing;
}

const baseListing = (over: ListingBody = {}): ListingBody => ({
  listing_type: 'skill_execution',
  title: 'Produce a research brief',
  visibility: 'internal',
  proof_required: true,
  ...over,
});

describe('AGENT-ECONOMY-004 — listing creation + rules', () => {
  let m: Market;
  beforeEach(async () => {
    m = await makeMarket();
  });

  it('a listing can be created internal-only', async () => {
    const res = await create(m, baseListing({ visibility: 'internal', status: 'active' }));
    expect(res.status).toBe(201);
    expect(listingOf(res).visibility).toBe('internal');
    expect(listingOf(res).status).toBe('active');
  });

  it('a listing cannot be public (rejected at validation)', async () => {
    const res = await create(m, baseListing({ visibility: 'public' })).catch((e) => e);
    expect(res.status).toBe(400);
  });

  it('a listing cannot carry a token price (no such field; stripped)', async () => {
    const res = await create(m, baseListing({ token_price: 100, price: 5, stake: true }));
    expect(res.status).toBe(201);
    const listing = listingOf(res);
    expect(Object.keys(listing)).not.toContain('token_price');
    expect(Object.keys(listing)).not.toContain('price');
    expect(Object.keys(listing)).not.toContain('stake');
  });

  it('a yanked skill version cannot back an active listing', async () => {
    const res = await create(
      m,
      baseListing({ status: 'active', skill_version_id: m.yankedVersionId }),
    ).catch((e) => e);
    expect(res.status).toBe(409);
  });

  it('an agent without an active ATC cannot own an active listing', async () => {
    // Find the owner's ATC and revoke it.
    const atcs = await m.repo.listAtcsByAgent(TENANT, m.ownerAgentId);
    await m.repo.updateAtcStatus(TENANT, atcs[0]!.id, 'revoked');
    const res = await create(
      m,
      baseListing({ status: 'active', owner_agent_id: m.ownerAgentId }),
    ).catch((e) => e);
    expect(res.status).toBe(409);
  });

  it('tier 0 skills can only be listed active for internal work', async () => {
    const tenantScoped = await create(
      m,
      baseListing({ status: 'active', visibility: 'tenant', skill_version_id: m.tier0VersionId }),
    ).catch((e) => e);
    expect(tenantScoped.status).toBe(409);
    const internal = await create(
      m,
      baseListing({ status: 'active', visibility: 'internal', skill_version_id: m.tier0VersionId }),
    );
    expect(internal.status).toBe(201);
  });

  it('creating a listing does NOT create positive reputation by itself', async () => {
    const before = await m.repo.listReputationEvents(TENANT, m.ownerAgentId);
    await create(m, baseListing({ status: 'active', owner_agent_id: m.ownerAgentId }));
    const after = await m.repo.listReputationEvents(TENANT, m.ownerAgentId);
    expect(after.length).toBe(before.length); // no reputation event from listing
  });
});

describe('AGENT-ECONOMY-004 — matching (likely_inference, never a guarantee)', () => {
  let m: Market;
  let workOrderId: string;

  beforeEach(async () => {
    m = await makeMarket();
    const wo = await m.handlers.createWorkOrder(
      operator({
        body: { requester_agent_id: m.requesterId, title: 'Need a brief', requested_credits: 100 },
      }),
    );
    workOrderId = (wo.body as { work_order: { id: string } }).work_order.id;
  });

  const matchOf = async () => {
    const res = await m.handlers.workOrderMatches(operator({ params: { id: workOrderId } }));
    return res.body as {
      evidence_tag: string;
      matches: Array<{
        listing_id: string;
        match_score: number;
        blockers: string[];
        evidence_tag: string;
      }>;
    };
  };

  it('every match is tagged likely_inference (a proposal, not a guarantee)', async () => {
    await create(
      m,
      baseListing({
        status: 'active',
        owner_agent_id: m.ownerAgentId,
        skill_version_id: m.tier1VersionId,
      }),
    );
    const result = await matchOf();
    expect(result.evidence_tag).toBe('likely_inference');
    expect(result.matches.every((x) => x.evidence_tag === 'likely_inference')).toBe(true);
  });

  it('a yanked listing is never matched', async () => {
    const res = await create(
      m,
      baseListing({ status: 'active', skill_version_id: m.tier1VersionId }),
    );
    const id = listingOf(res).id as string;
    await m.handlers.yankListing(operator({ params: { id } }));
    const result = await matchOf();
    expect(result.matches.find((x) => x.listing_id === id)).toBeUndefined();
  });

  it('a listing whose skill version is yanked is blocked, not matchable', async () => {
    // Simulate a version yanked AFTER its listing went active: insert an active
    // listing row directly (the service correctly refuses to ACTIVATE a
    // yanked-skill listing; this models the post-activation safety yank).
    const ts = new Date().toISOString();
    const blockedId = randomUUID();
    await m.repo.insertMarketplaceListing({
      id: blockedId,
      tenant_id: TENANT,
      listing_type: 'skill_execution',
      title: 'stale listing',
      description: null,
      status: 'active',
      visibility: 'internal',
      owner_agent_id: null,
      skill_version_id: m.yankedVersionId,
      workflow_ref: null,
      required_proof_tier: null,
      minimum_reputation_score: null,
      requested_credits_min: null,
      requested_credits_max: null,
      allowed_tenant_scope: 'tenant',
      risk_level: 'low',
      proof_required: true,
      created_at: ts,
      updated_at: ts,
    });
    const result = await matchOf();
    const blocked = result.matches.find((x) => x.listing_id === blockedId);
    expect(blocked?.blockers).toContain('skill_version_yanked');
    expect(blocked?.match_score).toBe(0);
  });

  it('a listing whose owner ATC is revoked is blocked', async () => {
    const res = await create(
      m,
      baseListing({
        status: 'active',
        owner_agent_id: m.ownerAgentId,
        skill_version_id: m.tier1VersionId,
      }),
    );
    const id = listingOf(res).id as string;
    const atcs = await m.repo.listAtcsByAgent(TENANT, m.ownerAgentId);
    await m.repo.updateAtcStatus(TENANT, atcs[0]!.id, 'revoked');
    const result = await matchOf();
    expect(result.matches.find((x) => x.listing_id === id)?.blockers).toContain(
      'owner_atc_not_active',
    );
  });

  it('a higher-tier skill ranks above a lower-tier one when other factors are equal', async () => {
    const low = listingOf(
      await create(m, baseListing({ status: 'active', skill_version_id: m.tier1VersionId })),
    ).id as string;
    const high = listingOf(
      await create(m, baseListing({ status: 'active', skill_version_id: m.tier3VersionId })),
    ).id as string;
    const result = await matchOf();
    const matchable = result.matches.filter((x) => x.blockers.length === 0);
    const lowIdx = matchable.findIndex((x) => x.listing_id === low);
    const highIdx = matchable.findIndex((x) => x.listing_id === high);
    expect(highIdx).toBeLessThan(lowIdx); // higher tier ranked first
    expect(matchable[highIdx]!.match_score).toBeGreaterThan(matchable[lowIdx]!.match_score);
  });

  it('reputation contributes to the match score', async () => {
    // Owner WITH reputation (40) vs a fresh owner with none, same tier.
    const { agent: poor } = await registerAgent(
      m.repo,
      TENANT,
      { name: 'Poor', slug: 'poor', kind: 'internal_ops' },
      actor,
      trace,
    );
    await issueAtc(m.repo, TENANT, poor.id, { claims: { scope: ['skill.execute'] } }, actor, trace);
    const rich = listingOf(
      await create(
        m,
        baseListing({
          status: 'active',
          owner_agent_id: m.ownerAgentId,
          skill_version_id: m.tier1VersionId,
        }),
      ),
    ).id as string;
    const poorId = listingOf(
      await create(
        m,
        baseListing({
          status: 'active',
          owner_agent_id: poor.id,
          skill_version_id: m.tier1VersionId,
        }),
      ),
    ).id as string;
    const result = await matchOf();
    const richScore = result.matches.find((x) => x.listing_id === rich)!.match_score;
    const poorScore = result.matches.find((x) => x.listing_id === poorId)!.match_score;
    expect(richScore).toBeGreaterThan(poorScore);
  });
});

describe('AGENT-ECONOMY-004 — create work order from listing', () => {
  let m: Market;
  let activeListingId: string;

  beforeEach(async () => {
    m = await makeMarket();
    const res = await create(
      m,
      baseListing({
        status: 'active',
        skill_version_id: m.tier1VersionId,
        proof_required: true,
        requested_credits_min: 50,
        requested_credits_max: 200,
      }),
    );
    activeListingId = listingOf(res).id as string;
  });

  const createWo = (id: string, credits = 100) =>
    m.handlers.createWorkOrderFromListing(
      operator({
        params: { id },
        body: { requester_agent_id: m.requesterId, requested_credits: credits },
      }),
    );

  it('creates a work order from an active listing, linked to it', async () => {
    const res = await createWo(activeListingId);
    expect(res.status).toBe(201);
    const wo = (res.body as { work_order: { id: string; listing_id: string; status: string } })
      .work_order;
    expect(wo.listing_id).toBe(activeListingId);
    expect(wo.status).toBe('proposed');
  });

  it('fails to create a work order from a yanked listing', async () => {
    await m.handlers.yankListing(operator({ params: { id: activeListingId } }));
    const res = await createWo(activeListingId).catch((e) => e);
    // handler throws HttpError (status 409) for a not-active listing
    expect(res.status).toBe(409);
  });

  it('preserves proof_required from the listing onto the work order', async () => {
    const res = await createWo(activeListingId);
    const wo = (res.body as { work_order: { proof_required: boolean } }).work_order;
    expect(wo.proof_required).toBe(true);
  });

  it('rejects credits outside the listing range', async () => {
    const res = await createWo(activeListingId, 10).catch((e) => e);
    expect(res.status).toBe(422);
  });

  it('does not reserve escrow at creation (escrow happens at accept)', async () => {
    const res = await createWo(activeListingId);
    const wo = (res.body as { work_order: { escrow_status: string } }).work_order;
    expect(wo.escrow_status).toBe('none');
  });
});

describe('AGENT-ECONOMY-004 — doctrine guards (no public/token/payment surface)', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const read = (p: string) => readFileSync(join(here, p), 'utf8');

  it('no public marketplace, payment, or token route exists in the server', () => {
    const server = read('server.ts');
    // Every marketplace route is under the internal /agent-economy/ namespace.
    const forbidden = [
      '/marketplace/public',
      '/pay',
      '/checkout',
      '/stripe',
      '/token',
      '/swap',
      '/stake',
    ];
    for (const f of forbidden) expect(server.includes(f)).toBe(false);
  });

  it('the marketplace summary states the locked posture', async () => {
    const m = await makeMarket();
    const res = await m.handlers.marketplaceSummary(operator());
    const body = res.body as { token_public_status: string; legal_gate: string; rail: string };
    expect(body.token_public_status).toBe('disabled');
    expect(body.legal_gate).toBe('not_passed');
    expect(body.rail).toBe('internal_credits');
  });

  it('the marketplace service carries no token/payment/investment language', () => {
    const svc = read('marketplace.ts').toLowerCase();
    for (const phrase of [
      'buy token',
      'pay in token',
      'apy',
      'staking rewards',
      'public sale',
      'get in early',
    ]) {
      expect(svc.includes(phrase)).toBe(false);
    }
  });
});
