import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository } from '@cognitia/db';
import { createGtmServices } from '@cognitia/agents';
import { ApiHandlers, type ApiRequest } from './handlers.js';
import { registerAgent, issueAtc } from './atc.js';
import { openAccount, transfer } from './credits.js';
import { createProof } from './proofs.js';
import { ECONOMY_PERMISSION_KEYS } from './agentEconomyActions.js';

/**
 * AGENT-ECONOMY-004 — internal marketplace skeleton + tier-aware matching.
 * Listings are INTERNAL only (0018 check-locked); matching ranks SkillProof
 * tier first (tier ≥ 2 = eligible for verified work), then reputation, then
 * verified work orders; yanked versions and ATC-less agents never match;
 * ordering from a listing creates a normal escrow-disciplined work order and
 * (when permitted) files the worker's accept ask on the Action Ledger.
 */

const TENANT = '11111111-1111-1111-1111-111111111111';
const TENANT_B = '22222222-2222-2222-2222-222222222222';

const asRole = (
  role: 'viewer' | 'operator' | 'owner',
  over: Partial<ApiRequest> = {},
): ApiRequest => ({ tenantId: TENANT, role, traceId: 'trace-market', ...over });
const operator = (over: Partial<ApiRequest> = {}) => asRole('operator', over);
const owner = (over: Partial<ApiRequest> = {}) => asRole('owner', over);

interface Seller {
  agentId: string;
  skillId: string;
  versionId: string;
}

interface Lab {
  repo: InMemoryRepository;
  handlers: ApiHandlers;
  requesterId: string;
  tier0: Seller;
  tier2: Seller;
  noAtc: Seller;
}

async function makeSeller(
  repo: InMemoryRepository,
  slug: string,
  opts: { atc: boolean; tier: number; acceptPermission?: boolean },
): Promise<Seller> {
  const actor = 'user:test';
  const trace = 'trace-market';
  const { agent } = await registerAgent(
    repo,
    TENANT,
    { name: `Seller ${slug}`, slug: `seller-${slug}`, kind: 'internal_ops' },
    actor,
    trace,
  );
  if (opts.atc) await issueAtc(repo, TENANT, agent.id, { claims: {} }, actor, trace);
  if (opts.acceptPermission) {
    const ts = new Date().toISOString();
    await repo.upsertAgentPermission({
      id: randomUUID(),
      tenant_id: TENANT,
      agent_id: agent.id,
      action_key: ECONOMY_PERMISSION_KEYS.accept,
      effect: 'allow',
      constraints: {},
      created_at: ts,
      updated_at: ts,
    });
  }
  const ts = new Date().toISOString();
  const skill = await repo.upsertSkill({
    id: randomUUID(),
    tenant_id: TENANT,
    name: `Skill ${slug}`,
    slug: `skill-${slug}`,
    category: 'analysis',
    description: null,
    visibility: 'internal',
    namespace: 'cognitia.core',
    source_path: null,
    owner_agent_id: agent.id,
    created_at: ts,
    updated_at: ts,
  });
  const version = await repo.insertSkillVersion({
    id: randomUUID(),
    tenant_id: TENANT,
    skill_id: skill.id,
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
  });
  if (opts.tier >= 2) {
    // Tier >= 2 requires a verified_fact skill proof (0013 trigger + mirror).
    const proof = await createProof(
      repo,
      TENANT,
      {
        kind: 'skill_demo',
        subject_type: 'skill',
        subject_id: skill.id,
        evidence_tag: 'verified_fact',
        evidence_ref: `eval:${skill.id}`,
        verifier_ref: 'verifier:economy-lab',
      },
      actor,
      trace,
    );
    await repo.insertSkillProof({
      id: randomUUID(),
      tenant_id: TENANT,
      skill_id: skill.id,
      agent_id: agent.id,
      proof_id: proof.id,
      tier: 'T2_verified',
      evidence_tag: 'verified_fact',
      created_at: ts,
      updated_at: ts,
    });
    await repo.setSkillVersionTier(TENANT, version.id, opts.tier);
  }
  return { agentId: agent.id, skillId: skill.id, versionId: version.id };
}

async function makeLab(): Promise<Lab> {
  const repo = new InMemoryRepository();
  const handlers = new ApiHandlers(repo, createGtmServices({ repo, v1Mode: true }));
  const actor = 'user:test';
  const { agent: requester } = await registerAgent(
    repo,
    TENANT,
    { name: 'Buyer', slug: 'market-buyer', kind: 'internal_ops' },
    actor,
    'trace-market',
  );
  const treasury = await openAccount(
    repo,
    TENANT,
    { owner_type: 'system', owner_id: randomUUID() },
    actor,
  );
  const buyerAccount = await openAccount(
    repo,
    TENANT,
    { owner_type: 'agent', owner_id: requester.id },
    actor,
  );
  await transfer(
    repo,
    TENANT,
    {
      from_account_id: treasury.id,
      to_account_id: buyerAccount.id,
      amount: 500,
      reason_code: 'grant',
      idempotency_key: 'grant-market',
    },
    actor,
  );
  const tier2 = await makeSeller(repo, 'verified', { atc: true, tier: 2, acceptPermission: true });
  const tier0 = await makeSeller(repo, 'claimed', { atc: true, tier: 0 });
  const noAtc = await makeSeller(repo, 'untrusted', { atc: false, tier: 0 });
  return { repo, handlers, requesterId: requester.id, tier0, tier2, noAtc };
}

const list = (lab: Lab, seller: Seller, price = 50) =>
  lab.handlers.createMarketplaceListing(
    operator({
      body: { agent_id: seller.agentId, skill_version_id: seller.versionId, price_credits: price },
    }),
  );
const listingIdOf = (res: { body: unknown }) =>
  (res.body as { listing: { id: string } }).listing.id;

describe('Internal marketplace + tier-aware matching (AGENT-ECONOMY-004)', () => {
  let lab: Lab;
  beforeEach(async () => {
    lab = await makeLab();
  });

  it('ranks by tier first; tier >= 2 is eligible for verified work; ATC-less sellers are suppressed with the reason', async () => {
    await list(lab, lab.tier0, 10); // cheap but unproven
    await list(lab, lab.tier2, 90); // expensive but T2_verified

    // The untrusted seller cannot even list (active ATC required).
    await expect(list(lab, lab.noAtc)).rejects.toMatchObject({ status: 403 });
    // Force a listing in for the suppression path: issue ATC, list, revoke.
    const atc = await issueAtc(
      lab.repo,
      TENANT,
      lab.noAtc.agentId,
      { claims: {} },
      'user:test',
      'trace-market',
    );
    await list(lab, lab.noAtc, 5);
    await lab.repo.updateAtcStatus(TENANT, atc.id, 'revoked');

    const view = (await lab.handlers.getMarketplace(operator())).body as {
      matches: Array<{
        agent: { id: string };
        version: { proof_tier: number };
        match_score: number;
        eligible_for_verified_work: boolean;
      }>;
      suppressed: Array<{ reason: string }>;
      ranking_rule: string;
    };
    // Tier dominates price and everything else.
    expect(view.matches.map((m) => m.agent.id)).toEqual([lab.tier2.agentId, lab.tier0.agentId]);
    expect(view.matches[0]!.eligible_for_verified_work).toBe(true);
    expect(view.matches[1]!.eligible_for_verified_work).toBe(false);
    expect(view.matches[0]!.match_score).toBeGreaterThanOrEqual(2000);
    expect(view.suppressed).toHaveLength(1);
    expect(view.suppressed[0]!.reason).toMatch(/Agent Trust Credential/);
    expect(view.ranking_rule).toContain('proof_tier');
  });

  it('reputation breaks tier ties (verified work raises the match)', async () => {
    // Two tier-0 sellers; give one verified-work reputation via the full loop.
    const rival = await makeSeller(lab.repo, 'rival', { atc: true, tier: 0 });
    await list(lab, lab.tier0, 50);
    await list(lab, rival, 50);

    const created = await lab.handlers.createWorkOrder(
      operator({
        body: {
          requester_agent_id: lab.requesterId,
          title: 'Reputation builder',
          skill_version_id: rival.versionId,
          requested_credits: 50,
        },
      }),
    );
    const woId = (created.body as { work_order: { id: string } }).work_order.id;
    await lab.handlers.acceptWorkOrder(
      operator({ params: { id: woId }, body: { worker_agent_id: rival.agentId } }),
    );
    await lab.handlers.deliverWorkOrder(operator({ params: { id: woId }, body: {} }));
    await lab.handlers.verifyWorkOrder(owner({ params: { id: woId } }));

    const view = (await lab.handlers.getMarketplace(operator())).body as {
      matches: Array<{
        agent: { id: string };
        reputation_score: number;
        verified_work_orders: number;
      }>;
    };
    expect(view.matches[0]!.agent.id).toBe(rival.agentId);
    expect(view.matches[0]!.reputation_score).toBe(3);
    expect(view.matches[0]!.verified_work_orders).toBe(1);
  });

  it('yanked versions: cannot be listed, suppress existing listings, block re-activation', async () => {
    const id = listingIdOf(await list(lab, lab.tier0));
    await lab.repo.yankSkillVersion(TENANT, lab.tier0.versionId, 'defective');
    const view = (await lab.handlers.getMarketplace(operator())).body as {
      matches: unknown[];
      suppressed: Array<{ listing_id: string; reason: string }>;
    };
    expect(view.matches).toHaveLength(0);
    expect(view.suppressed[0]).toMatchObject({ listing_id: id, reason: 'skill version yanked' });
    // Withdraw works; re-activation of a yanked listing is refused.
    await lab.handlers.setMarketplaceListingStatus(operator({ params: { id } }), 'withdrawn');
    await expect(
      lab.handlers.setMarketplaceListingStatus(operator({ params: { id } }), 'active'),
    ).rejects.toMatchObject({ status: 409 });
    // New listings of the yanked version are refused too.
    await expect(list(lab, lab.tier0)).rejects.toMatchObject({ status: 409 });
  });

  it('ordering from a listing creates the work order at the listed price and files the accept ask when permitted', async () => {
    const id = listingIdOf(await list(lab, lab.tier2, 90));
    const res = await lab.handlers.orderFromListing(
      operator({ params: { id }, body: { requester_agent_id: lab.requesterId } }),
    );
    const body = res.body as {
      work_order: {
        id: string;
        requested_credits: number;
        skill_version_id: string;
        status: string;
      };
      accept_ask: { id: string; action_type: string; approval_status: string } | null;
      accept_ask_blocked: string | null;
    };
    expect(body.work_order.requested_credits).toBe(90);
    expect(body.work_order.skill_version_id).toBe(lab.tier2.versionId);
    expect(body.work_order.status).toBe('proposed');
    expect(body.accept_ask_blocked).toBeNull();
    expect(body.accept_ask?.action_type).toBe('economy.work_order.accept');
    expect(body.accept_ask?.approval_status).toBe('proposed'); // approval stays human

    // Approve + execute the ask: escrow reserves through the safe path only.
    await lab.handlers.approveAction(
      operator({
        params: { id: body.accept_ask!.id },
        body: { reason: { reason_code: 'meets_playbook' } },
      }),
    );
    await lab.handlers.executeEconomyAction(operator({ params: { id: body.accept_ask!.id } }));
    const wo = (await lab.repo.getWorkOrder(TENANT, body.work_order.id))!;
    expect(wo.status).toBe('accepted');
    expect(wo.worker_agent_id).toBe(lab.tier2.agentId);
    expect(wo.escrow_status).toBe('reserved');
  });

  it('ordering still works when the seller lacks the accept permission — the ask is honestly blocked', async () => {
    const id = listingIdOf(await list(lab, lab.tier0, 10)); // tier0 has no accept allow
    const res = await lab.handlers.orderFromListing(
      operator({ params: { id }, body: { requester_agent_id: lab.requesterId } }),
    );
    const body = res.body as {
      work_order: { status: string };
      accept_ask: unknown;
      accept_ask_blocked: string | null;
    };
    expect(body.work_order.status).toBe('proposed');
    expect(body.accept_ask).toBeNull();
    expect(body.accept_ask_blocked).toMatch(/deny-by-default/);
  });

  it('ordering from withdrawn listings is refused; RBAC + isolation hold; summary counts listings', async () => {
    const id = listingIdOf(await list(lab, lab.tier2));
    await lab.handlers.setMarketplaceListingStatus(operator({ params: { id } }), 'withdrawn');
    await expect(
      lab.handlers.orderFromListing(
        operator({ params: { id }, body: { requester_agent_id: lab.requesterId } }),
      ),
    ).rejects.toMatchObject({ status: 409 });

    await expect(
      lab.handlers.createMarketplaceListing(asRole('viewer', { body: {} })),
    ).rejects.toMatchObject({ status: 403 });
    const other = (await lab.handlers.getMarketplace(operator({ tenantId: TENANT_B }))).body as {
      matches: unknown[];
    };
    expect(other.matches).toHaveLength(0);

    const summary = (await lab.handlers.economySummary(operator())).body as {
      marketplace: { active_listings: number; withdrawn_listings: number; visibility: string };
    };
    expect(summary.marketplace.withdrawn_listings).toBe(1);
    expect(summary.marketplace.visibility).toBe('internal');
  });
});
