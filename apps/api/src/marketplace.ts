import { randomUUID } from 'node:crypto';
import type { Repository, MarketplaceListingRow, WorkOrderRow, AgentActionRow } from '@cognitia/db';
import { marketplaceListingCreate, orderFromListing } from '@cognitia/core';
import { createWorkOrder, WorkerAtcRequiredError } from './agentEconomy.js';
import {
  proposeWorkOrderAgentAction,
  EconomyPermissionDeniedError,
} from './agentEconomyActions.js';
import { SkillVersionYankedError } from './skillproof.js';
import { AgentNotFoundError } from './atc.js';

/**
 * AGENT-ECONOMY-004 — the internal marketplace skeleton + tier-aware
 * matching. INTERNAL ONLY (0018 check-locks visibility): this is how agents,
 * SkillProof versions, and work flow find each other inside the lab — never
 * a public surface, never a payment system, never a token venue.
 *
 * Matching doctrine:
 *   - SkillProof tier DOMINATES the ranking (tier ≥ 2 is the bar for
 *     verified work — surfaced as `eligible_for_verified_work`);
 *   - reputation (verified_fact-backed by construction) breaks tier ties;
 *   - verified completed work orders break reputation ties;
 *   - yanked versions and ATC-less agents never match (suppressed, with the
 *     reason stated — honest surface, nothing silently vanishes).
 *
 *   match_score = proof_tier * 1000 + reputation * 10 + verified_orders
 */

export interface MarketplaceMatch {
  listing: MarketplaceListingRow;
  skill: { id: string; name: string; slug: string };
  version: { id: string; version: string; proof_tier: number };
  agent: { id: string; name: string; slug: string };
  atc_active: boolean;
  reputation_score: number;
  verified_work_orders: number;
  match_score: number;
  /** SkillProof bar for verified work: tier >= 2. */
  eligible_for_verified_work: boolean;
}

export interface MarketplaceView {
  matches: MarketplaceMatch[];
  /** Active listings that cannot match right now, with the reason. */
  suppressed: Array<{ listing_id: string; reason: string }>;
  withdrawn_count: number;
  ranking_rule: string;
}

/** List a skill version on the internal marketplace (trust-gated). */
export async function createListing(
  repo: Repository,
  tenantId: string,
  body: unknown,
  actorRef: string,
): Promise<MarketplaceListingRow> {
  const input = marketplaceListingCreate.parse({
    ...(body as Record<string, unknown>),
    tenant_id: tenantId,
  });
  const agent = await repo.getAgent(tenantId, input.agent_id);
  if (!agent) throw new AgentNotFoundError(input.agent_id);
  // Listable = trusted: an ACTIVE Agent Trust Credential is required.
  const atcs = await repo.listAtcsByAgent(tenantId, input.agent_id);
  if (!atcs.some((a) => a.status === 'active')) {
    throw new WorkerAtcRequiredError(input.agent_id);
  }
  const version = await repo.getSkillVersion(tenantId, input.skill_version_id);
  if (!version) throw new ListingTargetError(`skill version not found: ${input.skill_version_id}`);
  if (version.yanked) throw new SkillVersionYankedError(input.skill_version_id);

  const ts = new Date().toISOString();
  const listing = await repo.insertMarketplaceListing({
    id: randomUUID(),
    tenant_id: tenantId,
    agent_id: input.agent_id,
    skill_id: version.skill_id,
    skill_version_id: input.skill_version_id,
    price_credits: input.price_credits,
    summary: input.summary ?? null,
    status: 'active',
    visibility: 'internal',
    created_at: ts,
    updated_at: ts,
  });
  await repo.insertAuditEvent({
    id: randomUUID(),
    tenant_id: tenantId,
    actor_ref: actorRef,
    action: 'economy.listing.created.v1',
    subject_ref: `marketplace_listing:${listing.id}`,
    detail: {
      agent_id: input.agent_id,
      skill_version_id: input.skill_version_id,
      price_credits: input.price_credits,
    },
    occurred_at: ts,
    created_at: ts,
  });
  return listing;
}

export async function setListingStatus(
  repo: Repository,
  tenantId: string,
  listingId: string,
  status: 'active' | 'withdrawn',
  actorRef: string,
): Promise<MarketplaceListingRow> {
  const current = await repo.getMarketplaceListing(tenantId, listingId);
  if (!current) throw new ListingNotFoundError(listingId);
  if (status === 'active') {
    // Re-activation re-runs the yank gate (0018 trigger is the backstop).
    const version = await repo.getSkillVersion(tenantId, current.skill_version_id);
    if (!version || version.yanked) throw new SkillVersionYankedError(current.skill_version_id);
  }
  const updated = await repo.updateMarketplaceListingStatus(tenantId, listingId, status);
  if (!updated) throw new ListingNotFoundError(listingId);
  const ts = new Date().toISOString();
  await repo.insertAuditEvent({
    id: randomUUID(),
    tenant_id: tenantId,
    actor_ref: actorRef,
    action:
      status === 'withdrawn' ? 'economy.listing.withdrawn.v1' : 'economy.listing.reactivated.v1',
    subject_ref: `marketplace_listing:${listingId}`,
    detail: {},
    occurred_at: ts,
    created_at: ts,
  });
  return updated;
}

/** The tier-aware matching view over active listings. */
export async function buildMarketplaceView(
  repo: Repository,
  tenantId: string,
): Promise<MarketplaceView> {
  const [listings, agents, skills, reputationEvents, workOrders] = await Promise.all([
    repo.listMarketplaceListings(tenantId),
    repo.listAgents(tenantId),
    repo.listSkills(tenantId),
    repo.listReputationEvents(tenantId),
    repo.listWorkOrders(tenantId),
  ]);
  const agentById = new Map(agents.map((a) => [a.id, a]));
  const skillById = new Map(skills.map((s) => [s.id, s]));

  const matches: MarketplaceMatch[] = [];
  const suppressed: Array<{ listing_id: string; reason: string }> = [];
  let withdrawnCount = 0;

  for (const listing of listings) {
    if (listing.status === 'withdrawn') {
      withdrawnCount += 1;
      continue;
    }
    const version = await repo.getSkillVersion(tenantId, listing.skill_version_id);
    if (!version || version.yanked) {
      suppressed.push({ listing_id: listing.id, reason: 'skill version yanked' });
      continue;
    }
    const agent = agentById.get(listing.agent_id);
    if (!agent) {
      suppressed.push({ listing_id: listing.id, reason: 'agent missing' });
      continue;
    }
    const atcs = await repo.listAtcsByAgent(tenantId, listing.agent_id);
    const atcActive = atcs.some((a) => a.status === 'active');
    if (!atcActive) {
      suppressed.push({ listing_id: listing.id, reason: 'no active Agent Trust Credential' });
      continue;
    }
    const reputation = reputationEvents
      .filter((e) => e.agent_id === listing.agent_id)
      .reduce((sum, e) => sum + Number(e.delta), 0);
    const verifiedOrders = workOrders.filter(
      (w) => w.worker_agent_id === listing.agent_id && w.status === 'verified',
    ).length;
    const skill = skillById.get(listing.skill_id);
    matches.push({
      listing,
      skill: { id: listing.skill_id, name: skill?.name ?? 'unknown', slug: skill?.slug ?? '' },
      version: { id: version.id, version: version.version, proof_tier: version.proof_tier },
      agent: { id: agent.id, name: agent.name, slug: agent.slug },
      atc_active: atcActive,
      reputation_score: reputation,
      verified_work_orders: verifiedOrders,
      // Tier dominates; reputation breaks ties; verified orders break those.
      match_score: version.proof_tier * 1000 + reputation * 10 + verifiedOrders,
      eligible_for_verified_work: version.proof_tier >= 2,
    });
  }
  matches.sort((a, b) => b.match_score - a.match_score);
  return {
    matches,
    suppressed,
    withdrawn_count: withdrawnCount,
    ranking_rule:
      'match_score = proof_tier*1000 + reputation*10 + verified_work_orders; tier >= 2 marks eligible_for_verified_work',
  };
}

export interface OrderFromListingResult {
  work_order: WorkOrderRow;
  /** The worker's accept ask on the Action Ledger, when one could be filed. */
  accept_ask: AgentActionRow | null;
  accept_ask_blocked: string | null;
}

/**
 * Create a work order directly from a listing: price + skill version come
 * from the listing; the listing's agent is the intended worker. When
 * requested (default) and permitted, the worker's ACCEPT ask is filed on the
 * Action Ledger (AGENT-ECONOMY-003) — approval still human, escrow still
 * reserved only through the safe path at execution.
 */
export async function createWorkOrderFromListing(
  repo: Repository,
  tenantId: string,
  listingId: string,
  body: unknown,
  actorRef: string,
  traceId: string,
): Promise<OrderFromListingResult> {
  const input = orderFromListing.parse(body ?? {});
  const listing = await repo.getMarketplaceListing(tenantId, listingId);
  if (!listing) throw new ListingNotFoundError(listingId);
  if (listing.status !== 'active') throw new ListingNotActiveError(listingId);
  const version = await repo.getSkillVersion(tenantId, listing.skill_version_id);
  if (!version || version.yanked) throw new SkillVersionYankedError(listing.skill_version_id);
  const skill = await repo.getSkill(tenantId, listing.skill_id);

  const workOrder = await createWorkOrder(
    repo,
    tenantId,
    {
      requester_agent_id: input.requester_agent_id,
      title: input.title ?? `Marketplace order: ${skill?.name ?? 'skill'} v${version.version}`,
      description: input.description,
      skill_version_id: listing.skill_version_id,
      requested_credits: Number(listing.price_credits),
      proof_required: input.proof_required,
    },
    actorRef,
  );

  let acceptAsk: AgentActionRow | null = null;
  let blocked: string | null = null;
  if (input.file_accept_ask) {
    try {
      const proposed = await proposeWorkOrderAgentAction(
        repo,
        tenantId,
        workOrder.id,
        'accept',
        { agent_id: listing.agent_id },
        actorRef,
        traceId,
      );
      acceptAsk = proposed.action;
    } catch (err) {
      // Honest, non-fatal: the order exists; the ask needs the worker's
      // permission/ATC first. Anything else is a real error.
      if (err instanceof EconomyPermissionDeniedError || err instanceof WorkerAtcRequiredError) {
        blocked = err.message;
      } else {
        throw err;
      }
    }
  }

  const ts = new Date().toISOString();
  await repo.insertAuditEvent({
    id: randomUUID(),
    tenant_id: tenantId,
    actor_ref: actorRef,
    action: 'economy.work_order.from_listing.v1',
    subject_ref: `work_order:${workOrder.id}`,
    detail: {
      listing_id: listingId,
      worker_agent_id: listing.agent_id,
      price_credits: Number(listing.price_credits),
      accept_ask_id: acceptAsk?.id ?? null,
      accept_ask_blocked: blocked,
    },
    occurred_at: ts,
    created_at: ts,
  });
  return { work_order: workOrder, accept_ask: acceptAsk, accept_ask_blocked: blocked };
}

export class ListingNotFoundError extends Error {
  constructor(id: string) {
    super(`marketplace listing not found: ${id}`);
    this.name = 'ListingNotFoundError';
  }
}
export class ListingNotActiveError extends Error {
  constructor(id: string) {
    super(`marketplace listing ${id} is not active`);
    this.name = 'ListingNotActiveError';
  }
}
export class ListingTargetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ListingTargetError';
  }
}
