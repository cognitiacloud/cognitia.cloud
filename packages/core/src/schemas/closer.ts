import { z } from 'zod';
import { uuid } from './common.js';
import { evidenceTag } from './trust.js';

/**
 * Sales Closer Intelligence Engine schemas (Phase 1: domain foundation).
 *
 * The engine extends the GTM platform: accounts = dealerships, contacts = people
 * (PII hashed only), signals = website/funnel/intent, agent_runs = pipeline runs,
 * agent_actions = approval-gated outreach/vendor actions, proofs = evidence.
 *
 * Doctrine mirrored from packages/db migrations 0020/0021 and from the proof
 * evidence rules (schemas/trust.ts) — keep both in sync:
 *   - source_risk is explicit; a 'disallowed' source can never be active;
 *   - every closer brief claim carries an evidence_tag, and a verified_fact claim
 *     requires an evidence_ref (no fabricated facts).
 */

/** How a scrape source is classified for legal/safety review. */
export const closerSourceRisk = z.enum([
  'safe_public_website_crawl',
  'prototype_only',
  'legal_review_required',
  'disallowed',
]);
export type CloserSourceRisk = z.infer<typeof closerSourceRisk>;

/** Account fit tiers (A best … D worst). */
export const closerTier = z.enum(['A', 'B', 'C', 'D']);
export type CloserTier = z.infer<typeof closerTier>;

export const closerBriefStatus = z.enum(['draft', 'approved', 'sent']);
export type CloserBriefStatus = z.infer<typeof closerBriefStatus>;

/** The four scoring dimensions (0..1). */
export const closerScoreDimensions = z.object({
  fit: z.number().min(0).max(1),
  intent: z.number().min(0).max(1),
  timing: z.number().min(0).max(1),
  reachability: z.number().min(0).max(1),
});
export type CloserScoreDimensions = z.infer<typeof closerScoreDimensions>;

/**
 * A single grounded claim in a closer brief. Every claim is evidence-tagged; a
 * verified_fact must point at an evidence_ref. No fabricated names/titles/
 * emails/phones/pricing are introduced here — that is a brief-generation concern
 * (Phase 3) but the tag is the contract the whole pipeline honors.
 */
export const closerClaim = z
  .object({
    text: z.string().min(1),
    evidence_tag: evidenceTag,
    evidence_ref: z.string().min(1).optional(),
    confidence: z.number().min(0).max(1).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.evidence_tag === 'verified_fact' && !value.evidence_ref) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['evidence_ref'],
        message: 'verified_fact claim requires evidence_ref',
      });
    }
  });
export type CloserClaim = z.infer<typeof closerClaim>;

/** Structured body of a closer brief (the markdown is rendered separately). */
export const closerBriefStructured = z.object({
  pains: z.array(z.string()).default([]),
  hooks: z.array(z.string()).default([]),
  objections: z.array(z.string()).default([]),
  talk_track: z.array(z.string()).default([]),
  recommended_offer: z.string().optional(),
});
export type CloserBriefStructured = z.infer<typeof closerBriefStructured>;

/** Input for creating a Sales Closer source (Apify import config). */
export const closerSourceCreate = z
  .object({
    tenant_id: uuid,
    label: z.string().min(1),
    apify_actor_id: z.string().min(1),
    input: z.record(z.unknown()).default({}),
    source_risk: closerSourceRisk,
    max_results: z.number().int().positive().default(100),
    schedule: z.string().optional(),
    active: z.boolean().default(true),
  })
  .superRefine((value, ctx) => {
    if (value.active && value.source_risk === 'disallowed') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['active'],
        message: 'a disallowed source cannot be active',
      });
    }
  });
export type CloserSourceCreate = z.infer<typeof closerSourceCreate>;
