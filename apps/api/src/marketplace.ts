import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type {
  Repository,
  MarketplaceListingRow,
  WorkOrderRow,
  SkillVersionRow,
} from '@cognitia/db';
import { createWorkOrder } from './agentEconomy.js';

/**
 * AGENT-ECONOMY-004 — internal Marketplace Lab service.
 *
 * Listings are discoverable, internal-only OFFERS (agent service / skill /
 * workflow). Matching scores active listings against a work order's needs and
 * returns RANKED candidates. Two doctrine rules are absolute:
 *
 *   1. A listing never moves credits or reputation by itself. Only completed,
 *      verified_fact-proven work does (the 0016/0010 triggers still own payout).
 *   2. A match result is a PROPOSAL, not a guarantee — every match is tagged
 *      `likely_inference` (never `verified_fact`). Scores rank; they don't pay.
 *
 * Visibility is internal | tenant | private only — there is no public
 * marketplace, and there is no price field anywhere (internal credits estimate
 * range only).
 */

const LISTING_TYPES = [
  'agent_service',
  'skill_execution',
  'workflow',
  'verifier_service',
  'research_task',
  'gtm_task',
  'support_task',
  'internal_only',
] as const;

const listingCreate = z.object({
  listing_type: z.enum(LISTING_TYPES),
  title: z.string().min(1),
  description: z.string().optional(),
  // 'public' is intentionally not a member: a public listing is unrepresentable.
  visibility: z.enum(['internal', 'tenant', 'private']).default('internal'),
  status: z.enum(['draft', 'active']).default('draft'),
  owner_agent_id: z.string().uuid().optional(),
  skill_version_id: z.string().uuid().optional(),
  workflow_ref: z.string().optional(),
  required_proof_tier: z.number().int().min(0).max(4).optional(),
  minimum_reputation_score: z.number().int().optional(),
  requested_credits_min: z.number().int().min(0).optional(),
  requested_credits_max: z.number().int().min(0).optional(),
  allowed_tenant_scope: z.enum(['internal', 'tenant', 'private']).default('tenant'),
  risk_level: z.enum(['none', 'low', 'medium', 'high']).default('low'),
  // A listing MUST declare its proof requirement (no implicit default-away).
  proof_required: z.boolean(),
});

export class ListingNotFoundError extends Error {}
export class ListingNotActiveError extends Error {}
export class ListingValidationError extends Error {}
export class ListingRuleError extends Error {}
export class ListingVisibilityError extends Error {}
export class ListingCreditsRangeError extends Error {}

/** The shape returned for one scored listing against a work order. */
export interface ListingMatch {
  listing_id: string;
  match_score: number;
  match_reasons: string[];
  blockers: string[];
  /** Always likely_inference: a match ranks, it never proves or guarantees. */
  evidence_tag: 'likely_inference';
}

async function latestReputation(
  repo: Repository,
  tenantId: string,
  agentId: string,
): Promise<number> {
  const snaps = await repo.listReputationSnapshots(tenantId, agentId);
  if (snaps.length === 0) return 0;
  return snaps.reduce((a, b) => (a.computed_at >= b.computed_at ? a : b)).score;
}

async function ownerAtcActive(
  repo: Repository,
  tenantId: string,
  agentId: string,
): Promise<boolean> {
  const atcs = await repo.listAtcsByAgent(tenantId, agentId);
  return atcs.some((a) => a.status === 'active');
}

/**
 * Activation rules (run when a listing becomes active). Kept in the service
 * (cross-table) on top of the structural DB CHECKs. Throws ListingRuleError.
 */
async function assertActivatable(
  repo: Repository,
  tenantId: string,
  listing: Pick<
    MarketplaceListingRow,
    'visibility' | 'owner_agent_id' | 'skill_version_id' | 'proof_required' | 'risk_level'
  >,
): Promise<void> {
  // A listing must declare a proof requirement (belt-and-braces with zod).
  if (typeof listing.proof_required !== 'boolean') {
    throw new ListingRuleError('a listing must declare its proof requirement');
  }
  let skill: SkillVersionRow | null = null;
  if (listing.skill_version_id) {
    skill = await repo.getSkillVersion(tenantId, listing.skill_version_id);
    if (!skill) throw new ListingRuleError('skill version not found');
    // Yanked skill versions cannot be listed active.
    if (skill.yanked) throw new ListingRuleError('a yanked skill version cannot be listed active');
    // Tier 0 skills can only be listed for internal/simulated work.
    if (skill.proof_tier === 0 && listing.visibility !== 'internal') {
      throw new ListingRuleError('tier 0 skills can only be listed for internal work');
    }
  }
  // Revoked/suspended ATC agents cannot list active services.
  if (listing.owner_agent_id) {
    const active = await ownerAtcActive(repo, tenantId, listing.owner_agent_id);
    if (!active) {
      throw new ListingRuleError('the owner agent has no active ATC; cannot list active services');
    }
  }
}

export async function createListing(
  repo: Repository,
  tenantId: string,
  body: unknown,
): Promise<MarketplaceListingRow> {
  let input: z.infer<typeof listingCreate>;
  try {
    input = listingCreate.parse(body);
  } catch (err) {
    throw new ListingValidationError(err instanceof Error ? err.message : 'invalid listing');
  }
  if (
    input.requested_credits_min != null &&
    input.requested_credits_max != null &&
    input.requested_credits_min > input.requested_credits_max
  ) {
    throw new ListingValidationError('requested_credits_min must be <= requested_credits_max');
  }
  if (input.status === 'active') {
    await assertActivatable(repo, tenantId, {
      visibility: input.visibility,
      owner_agent_id: input.owner_agent_id ?? null,
      skill_version_id: input.skill_version_id ?? null,
      proof_required: input.proof_required,
      risk_level: input.risk_level,
    });
  }
  const ts = new Date().toISOString();
  return repo.insertMarketplaceListing({
    id: randomUUID(),
    tenant_id: tenantId,
    listing_type: input.listing_type,
    title: input.title,
    description: input.description ?? null,
    status: input.status,
    visibility: input.visibility,
    owner_agent_id: input.owner_agent_id ?? null,
    skill_version_id: input.skill_version_id ?? null,
    workflow_ref: input.workflow_ref ?? null,
    required_proof_tier: input.required_proof_tier ?? null,
    minimum_reputation_score: input.minimum_reputation_score ?? null,
    requested_credits_min: input.requested_credits_min ?? null,
    requested_credits_max: input.requested_credits_max ?? null,
    allowed_tenant_scope: input.allowed_tenant_scope,
    risk_level: input.risk_level,
    proof_required: input.proof_required,
    created_at: ts,
    updated_at: ts,
  });
}

async function setListingStatus(
  repo: Repository,
  tenantId: string,
  id: string,
  status: 'active' | 'paused' | 'yanked' | 'archived',
): Promise<MarketplaceListingRow> {
  const listing = await repo.getMarketplaceListing(tenantId, id);
  if (!listing) throw new ListingNotFoundError(`listing ${id} not found`);
  if (status === 'active') {
    await assertActivatable(repo, tenantId, listing);
  }
  const updated = await repo.updateMarketplaceListingStatus(tenantId, id, status);
  if (!updated) throw new ListingNotFoundError(`listing ${id} not found`);
  return updated;
}

export const activateListing = (repo: Repository, t: string, id: string) =>
  setListingStatus(repo, t, id, 'active');
export const pauseListing = (repo: Repository, t: string, id: string) =>
  setListingStatus(repo, t, id, 'paused');
export const yankListing = (repo: Repository, t: string, id: string) =>
  setListingStatus(repo, t, id, 'yanked');

/**
 * Score every ACTIVE listing against a work order's needs. Yanked/paused/draft
 * listings are not candidates at all (status filter) — so a yanked listing is
 * never matched. A returned listing with a non-empty `blockers` array is NOT
 * matchable (e.g. its skill version is yanked, its owner's ATC is revoked, or
 * the credits don't fit). Matchable listings rank first, by descending score.
 * Every result is `likely_inference`.
 */
export async function matchWorkOrderToListings(
  repo: Repository,
  tenantId: string,
  workOrderId: string,
): Promise<{ work_order_id: string; evidence_tag: 'likely_inference'; matches: ListingMatch[] }> {
  const wo = await repo.getWorkOrder(tenantId, workOrderId);
  if (!wo) throw new ListingNotFoundError(`work order ${workOrderId} not found`);

  const candidates = await repo.listMarketplaceListings(tenantId, { status: 'active' });
  const matches: ListingMatch[] = [];

  for (const listing of candidates) {
    const blockers: string[] = [];
    const reasons: string[] = [];
    let score = 0;

    // Skill version gate + tier base score.
    let tier = 0;
    if (listing.skill_version_id) {
      const sv = await repo.getSkillVersion(tenantId, listing.skill_version_id);
      if (!sv) blockers.push('skill_version_missing');
      else if (sv.yanked) blockers.push('skill_version_yanked');
      else {
        tier = sv.proof_tier;
        score += tier * 10;
        reasons.push(`skill_tier:${tier}`);
      }
    }

    // Owner agent: ATC must be active; reputation adds score.
    let reputation = 0;
    if (listing.owner_agent_id) {
      const agent = await repo.getAgent(tenantId, listing.owner_agent_id);
      if (!agent || ['suspended', 'retired'].includes(agent.status)) {
        blockers.push('owner_agent_inactive');
      }
      if (!(await ownerAtcActive(repo, tenantId, listing.owner_agent_id))) {
        blockers.push('owner_atc_not_active');
      } else {
        reputation = await latestReputation(repo, tenantId, listing.owner_agent_id);
        score += Math.max(0, Math.min(100, reputation)) * 0.5;
        if (reputation > 0) reasons.push(`reputation:${reputation}`);
      }
    }

    // Required proof tier on the listing itself.
    if (listing.required_proof_tier != null && tier < listing.required_proof_tier) {
      blockers.push('below_required_proof_tier');
    }
    // Minimum reputation declared by the listing.
    if (listing.minimum_reputation_score != null && reputation < listing.minimum_reputation_score) {
      blockers.push('below_minimum_reputation');
    }

    // Exact skill match with the work order's targeted skill version.
    if (wo.skill_version_id && listing.skill_version_id) {
      if (wo.skill_version_id === listing.skill_version_id) {
        score += 50;
        reasons.push('exact_skill_match');
      } else {
        score -= 10;
      }
    }

    // Credits range: the order's credits must fit the listing's estimate.
    if (
      listing.requested_credits_min != null &&
      wo.requested_credits < listing.requested_credits_min
    ) {
      blockers.push('credits_below_range');
    }
    if (
      listing.requested_credits_max != null &&
      wo.requested_credits > listing.requested_credits_max
    ) {
      blockers.push('credits_above_range');
    }
    if (
      (listing.requested_credits_min != null || listing.requested_credits_max != null) &&
      blockers.every((b) => !b.startsWith('credits_'))
    ) {
      reasons.push('credits_in_range');
    }

    // Proof requirement compatibility: a proof-required order needs a
    // proof-required listing.
    if (wo.proof_required && !listing.proof_required) {
      blockers.push('listing_does_not_require_proof');
    } else if (listing.proof_required) {
      reasons.push('proof_required');
    }

    // High-risk listings need approval before use — a soft flag, not an exclude.
    if (listing.risk_level === 'high') {
      score -= 5;
      reasons.push('high_risk_requires_approval');
    }

    matches.push({
      listing_id: listing.id,
      match_score: blockers.length > 0 ? 0 : Math.round(score),
      match_reasons: reasons,
      blockers,
      evidence_tag: 'likely_inference',
    });
  }

  matches.sort((a, b) => {
    const am = a.blockers.length === 0 ? 0 : 1;
    const bm = b.blockers.length === 0 ? 0 : 1;
    if (am !== bm) return am - bm; // matchable first
    return b.match_score - a.match_score;
  });

  return { work_order_id: workOrderId, evidence_tag: 'likely_inference', matches };
}

const createFromListing = z.object({
  requester_agent_id: z.string().uuid(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  requested_credits: z.number().int().positive(),
});

/**
 * Create a work order FROM a listing. Reuses the existing createWorkOrder
 * service (so every 0016 guard, the requester-active-agent check, and the
 * not-yanked-skill check all re-apply), then links the order back to the
 * listing. Escrow is NOT reserved here — that happens at accept, downstream,
 * unchanged. proof_required is inherited from the listing.
 */
export async function createWorkOrderFromListing(
  repo: Repository,
  tenantId: string,
  listingId: string,
  body: unknown,
  actorRef: string,
): Promise<WorkOrderRow> {
  const listing = await repo.getMarketplaceListing(tenantId, listingId);
  if (!listing) throw new ListingNotFoundError(`listing ${listingId} not found`);
  if (listing.status !== 'active') {
    throw new ListingNotActiveError(`listing ${listingId} is ${listing.status}, not active`);
  }
  let input: z.infer<typeof createFromListing>;
  try {
    input = createFromListing.parse(body);
  } catch (err) {
    throw new ListingValidationError(err instanceof Error ? err.message : 'invalid request');
  }

  // Visibility / scope: 'private' listings can only be requested by their owner.
  if (listing.visibility === 'private' && listing.owner_agent_id !== input.requester_agent_id) {
    throw new ListingVisibilityError('this private listing is not available to the requester');
  }

  // Requested credits must fit the listing's declared estimate range.
  if (
    listing.requested_credits_min != null &&
    input.requested_credits < listing.requested_credits_min
  ) {
    throw new ListingCreditsRangeError('requested_credits below the listing range');
  }
  if (
    listing.requested_credits_max != null &&
    input.requested_credits > listing.requested_credits_max
  ) {
    throw new ListingCreditsRangeError('requested_credits above the listing range');
  }

  const order = await createWorkOrder(
    repo,
    tenantId,
    {
      requester_agent_id: input.requester_agent_id,
      title: input.title ?? listing.title,
      description: input.description ?? listing.description ?? undefined,
      skill_version_id: listing.skill_version_id ?? undefined,
      requested_credits: input.requested_credits,
      // proof requirement is inherited from the listing.
      proof_required: listing.proof_required,
    },
    actorRef,
  );

  // Link the order to its listing (and the suggested worker, if the listing
  // names an owner agent — escrow stays untouched until accept).
  const linked = await repo.updateWorkOrder(tenantId, order.id, {
    listing_id: listing.id,
    ...(listing.listing_type === 'agent_service' && listing.owner_agent_id
      ? { worker_agent_id: listing.owner_agent_id }
      : {}),
  });
  return linked ?? order;
}

export interface MarketplaceSummaryView {
  description: string;
  token_public_status: 'disabled';
  legal_gate: 'not_passed';
  rail: 'internal_credits';
  listings: {
    total: number;
    by_status: Record<string, number>;
    by_type: Record<string, number>;
    by_visibility: Record<string, number>;
  };
}

export async function buildMarketplaceSummary(
  repo: Repository,
  tenantId: string,
): Promise<MarketplaceSummaryView> {
  const listings = await repo.listMarketplaceListings(tenantId);
  const tally = (key: keyof MarketplaceListingRow): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const l of listings) {
      const k = String(l[key]);
      out[k] = (out[k] ?? 0) + 1;
    }
    return out;
  };
  return {
    description:
      'Internal Marketplace Lab. Listings are discoverable offers; matches are likely_inference proposals, never guarantees. No public marketplace, no token, internal credits only.',
    token_public_status: 'disabled',
    legal_gate: 'not_passed',
    rail: 'internal_credits',
    listings: {
      total: listings.length,
      by_status: tally('status'),
      by_type: tally('listing_type'),
      by_visibility: tally('visibility'),
    },
  };
}
