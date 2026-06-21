import { describe, it, expect } from 'vitest';
import {
  getActorConfig,
  listAllowedActors,
  validateApifySourcePolicy,
  canRunApifySource,
  explainApifyBlockReason,
  resolveEffectiveMaxItems,
} from './policy.js';
import { HARD_MAX_APIFY_ITEMS } from './config.js';

const WEBSITE = 'apify/website-content-crawler';
const MAPS = 'apify/google-places-scraper';

describe('apify actor allowlist', () => {
  it('exposes prototype actors, none production-ready', () => {
    const actors = listAllowedActors();
    expect(actors.length).toBeGreaterThanOrEqual(2);
    expect(actors.every((a) => a.productionStatus !== 'production')).toBe(true);
  });

  it('rejects unknown actors', () => {
    expect(getActorConfig('apify/not-allowlisted')).toBeNull();
    const decision = validateApifySourcePolicy(getActorConfig('apify/not-allowlisted'), {
      active: true,
      source_risk: 'safe_public_website_crawl',
    });
    expect(decision).toEqual({ ok: false, reason: 'unknown_actor' });
  });

  it('classifies maps/social actors as legal_review_required (not production)', () => {
    const maps = getActorConfig(MAPS);
    expect(maps?.riskLevel).toBe('legal_review_required');
    expect(maps?.productionStatus).toBe('prototype');
  });
});

describe('apify source policy (Phase-1 enum aligned)', () => {
  const website = getActorConfig(WEBSITE);
  const maps = getActorConfig(MAPS);

  it('blocks a disallowed source (maps to disallowed)', () => {
    expect(explainApifyBlockReason(website, { active: true, source_risk: 'disallowed' })).toBe(
      'blocked_by_policy:disallowed',
    );
  });

  it('blocks an inactive source', () => {
    expect(
      explainApifyBlockReason(website, { active: false, source_risk: 'safe_public_website_crawl' }),
    ).toBe('source_inactive');
  });

  it('requires humanReviewApproved for a legal_review_required source', () => {
    const src = { active: true, source_risk: 'legal_review_required' as const };
    expect(canRunApifySource(website, src)).toBe(false);
    expect(explainApifyBlockReason(website, src)).toBe('human_review_required');
    expect(canRunApifySource(website, src, { humanReviewApproved: true })).toBe(true);
  });

  it('requires humanReviewApproved when the ACTOR is high-risk even if source is safe', () => {
    const src = { active: true, source_risk: 'safe_public_website_crawl' as const };
    expect(canRunApifySource(maps, src)).toBe(false);
    expect(canRunApifySource(maps, src, { humanReviewApproved: true })).toBe(true);
  });

  it('allows a safe active source with a safe actor', () => {
    expect(
      canRunApifySource(website, { active: true, source_risk: 'safe_public_website_crawl' }),
    ).toBe(true);
    expect(canRunApifySource(website, { active: true, source_risk: 'prototype_only' })).toBe(true);
  });
});

describe('resolveEffectiveMaxItems — hard clamp', () => {
  it('takes the minimum of request/actor/config', () => {
    expect(resolveEffectiveMaxItems({ requestMax: 10, actorMax: 50, configMax: 25 })).toBe(10);
    expect(resolveEffectiveMaxItems({ actorMax: 50, configMax: 25 })).toBe(25);
  });

  it('never exceeds HARD_MAX_APIFY_ITEMS', () => {
    expect(resolveEffectiveMaxItems({ requestMax: 9999, actorMax: 9999, configMax: 9999 })).toBe(
      HARD_MAX_APIFY_ITEMS,
    );
    expect(resolveEffectiveMaxItems({})).toBe(HARD_MAX_APIFY_ITEMS);
  });

  it('ignores non-positive inputs and floors at 1', () => {
    expect(resolveEffectiveMaxItems({ requestMax: 0, configMax: 25 })).toBe(25);
    expect(resolveEffectiveMaxItems({ requestMax: -5, actorMax: 7 })).toBe(7);
  });
});
