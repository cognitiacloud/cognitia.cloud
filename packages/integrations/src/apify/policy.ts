import type { ApifyActorConfig, ApifyPolicyDecision, ApifySourceRisk } from './types.js';
import { HARD_MAX_APIFY_ITEMS } from './config.js';

/**
 * Source + actor policy (pure; no env, no I/O).
 *
 * Enum alignment with Phase-1 `closer_sources.source_risk`
 * (safe_public_website_crawl | prototype_only | legal_review_required | disallowed):
 * there is NO separate `blocked` value. A policy refusal therefore maps to
 * `disallowed` and the caller marks the scrape run `failed` (status enum is
 * queued|running|succeeded|failed — also no `blocked`). `legal_review_required`
 * (and high-risk maps/social actors classified as such) require an explicit
 * `humanReviewApproved` flag before they may run.
 */

/** Risk severity, low → high. */
const RISK_ORDER: Record<ApifySourceRisk, number> = {
  safe_public_website_crawl: 0,
  prototype_only: 1,
  legal_review_required: 2,
  disallowed: 3,
};

function mostSevereRisk(a: ApifySourceRisk, b: ApifySourceRisk): ApifySourceRisk {
  return RISK_ORDER[a] >= RISK_ORDER[b] ? a : b;
}

/**
 * Allowlisted prototype actors. Maps/social/platform actors are
 * `legal_review_required` + `prototype` — never production-ready by default.
 * (Generic prototype names; real production actors require legal review.)
 */
export const APIFY_ACTOR_ALLOWLIST: readonly ApifyActorConfig[] = [
  {
    id: 'dealership-website-profile',
    name: 'Dealership website / company profile',
    actorId: 'apify/website-content-crawler',
    category: 'website_profile',
    sourceType: 'public_website',
    riskLevel: 'safe_public_website_crawl',
    allowedUse: "Crawl a dealership's own public website for company-level profile data.",
    disallowedUse: 'Harvesting personal emails/phones; bypassing robots/ToS.',
    defaultInput: { maxCrawlPages: 5 },
    maxItems: 50,
    productionStatus: 'prototype',
    fieldsExpected: ['companyName', 'website', 'city', 'provinceOrState', 'country', 'category'],
    piiRisk: 'low',
    notes: 'Public website crawl; company-level fields only.',
  },
  {
    id: 'local-business-directory',
    name: 'Local business directory / map-style results',
    actorId: 'apify/google-places-scraper',
    category: 'maps',
    sourceType: 'maps_platform',
    riskLevel: 'legal_review_required',
    allowedUse: 'Prototype-only discovery of public business listings, under legal review.',
    disallowedUse: 'Production use without legal review; collecting personal contact PII.',
    defaultInput: { maxPlaces: 25 },
    maxItems: 25,
    productionStatus: 'prototype',
    fieldsExpected: ['accountName', 'website', 'city', 'provinceOrState', 'rating', 'reviewCount'],
    piiRisk: 'medium',
    notes: 'Maps/platform source: requires humanReviewApproved; not production-ready.',
  },
];

const ALLOWLIST_BY_ACTOR_ID = new Map(APIFY_ACTOR_ALLOWLIST.map((a) => [a.actorId, a]));

/** Resolve an allowlisted actor config by actorId, or null when unknown. */
export function getActorConfig(actorId: string): ApifyActorConfig | null {
  return ALLOWLIST_BY_ACTOR_ID.get(actorId) ?? null;
}

export function listAllowedActors(): readonly ApifyActorConfig[] {
  return APIFY_ACTOR_ALLOWLIST;
}

/** A source as the policy needs to see it (mirrors closer_sources columns). */
export interface ApifySourceView {
  active: boolean;
  source_risk: ApifySourceRisk;
}

export interface ApifyRequestContext {
  humanReviewApproved?: boolean;
}

/**
 * Validate that an actor + source + context may run. Pure and deterministic.
 * Returns a sanitized, enum-aligned reason on refusal.
 */
export function validateApifySourcePolicy(
  actor: ApifyActorConfig | null,
  source: ApifySourceView,
  ctx: ApifyRequestContext = {},
): ApifyPolicyDecision {
  if (!actor) return { ok: false, reason: 'unknown_actor' };
  if (!source.active) return { ok: false, reason: 'source_inactive' };

  const effectiveRisk = mostSevereRisk(source.source_risk, actor.riskLevel);
  if (effectiveRisk === 'disallowed') {
    return { ok: false, reason: 'blocked_by_policy:disallowed' };
  }
  if (effectiveRisk === 'legal_review_required' && !ctx.humanReviewApproved) {
    return { ok: false, reason: 'human_review_required' };
  }
  return { ok: true };
}

export function canRunApifySource(
  actor: ApifyActorConfig | null,
  source: ApifySourceView,
  ctx: ApifyRequestContext = {},
): boolean {
  return validateApifySourcePolicy(actor, source, ctx).ok;
}

export function explainApifyBlockReason(
  actor: ApifyActorConfig | null,
  source: ApifySourceView,
  ctx: ApifyRequestContext = {},
): string | null {
  const decision = validateApifySourcePolicy(actor, source, ctx);
  return decision.ok ? null : (decision.reason ?? 'blocked');
}

/**
 * Hard clamp on items per run:
 *   min(request, actorConfig, config, HARD_MAX_APIFY_ITEMS).
 * Undefined inputs are ignored; the result is always 1..HARD_MAX.
 */
export function resolveEffectiveMaxItems(inputs: {
  requestMax?: number;
  actorMax?: number;
  configMax?: number;
}): number {
  const candidates = [inputs.requestMax, inputs.actorMax, inputs.configMax, HARD_MAX_APIFY_ITEMS]
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0)
    .map((n) => Math.floor(n));
  const effective = Math.min(...candidates, HARD_MAX_APIFY_ITEMS);
  return Math.max(1, effective);
}
