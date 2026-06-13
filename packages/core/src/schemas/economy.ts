import { z } from 'zod';
import { uuid } from './common.js';

/**
 * AGENT-ECONOMY-001 — Agent Economy Lab schemas (internal, simulation-only).
 *
 * The lab is a closed loop on the EXISTING trust primitives: internal credits
 * only (0012 rail lock untouched), simulation-only skill execution (0016
 * check), and escrow that releases ONLY against a verified_fact proof (0016
 * trigger + service + memory mirror). Nothing here touches real payments,
 * token transfers, chains, or public surfaces.
 */

export const workOrderStatus = z.enum([
  'proposed',
  'accepted',
  'in_progress',
  'delivered',
  'verified',
  'rejected',
  'disputed',
  'canceled',
]);
export type WorkOrderStatus = z.infer<typeof workOrderStatus>;

export const escrowStatus = z.enum(['none', 'reserved', 'released', 'refunded', 'disputed']);
export type EscrowStatus = z.infer<typeof escrowStatus>;

export const executionOrderStatus = z.enum(['ordered', 'running', 'succeeded', 'failed']);
export type ExecutionOrderStatus = z.infer<typeof executionOrderStatus>;

/** An agent requests work, priced in internal credits. */
export const workOrderCreate = z.object({
  tenant_id: uuid,
  requester_agent_id: uuid,
  title: z.string().min(1),
  description: z.string().optional(),
  /** Optional up-front targeting of a SkillProof skill version. */
  skill_version_id: uuid.optional(),
  requested_credits: z.number().int().positive(),
  proof_required: z.boolean().default(true),
});
export type WorkOrderCreate = z.infer<typeof workOrderCreate>;

/** A worker agent (optionally via a SkillProof skill version) accepts. */
export const workOrderAccept = z.object({
  worker_agent_id: uuid,
  skill_version_id: uuid.optional(),
});
export type WorkOrderAccept = z.infer<typeof workOrderAccept>;

/** Delivery: simulation is a literal, mirroring the 0016 check constraint. */
export const workOrderDeliver = z.object({
  simulation: z.literal(true).default(true),
  outcome_type: z.string().min(1).default('work_delivered'),
  /** Link an existing proof, or omit to have the lab create the execution proof. */
  proof_id: uuid.optional(),
  result_summary: z.string().optional(),
});
export type WorkOrderDeliver = z.infer<typeof workOrderDeliver>;

export const workOrderDecisionReason = z.object({
  reason_code: z.string().min(1),
  note: z.string().optional(),
});
export type WorkOrderDecisionReason = z.infer<typeof workOrderDecisionReason>;

/** AGENT-ECONOMY-002: arbitration decisions over held (disputed) escrow. */
export const disputeDecision = z.enum(['release', 'refund', 'split']);
export type DisputeDecision = z.infer<typeof disputeDecision>;

/**
 * Owner arbitration input. For 'split', both amounts are required and must
 * conserve the order's escrow (service + memory mirror + 0017 trigger all
 * check the sum); for 'release'/'refund' the amounts are derived.
 */
export const disputeResolutionCreate = z
  .object({
    decision: disputeDecision,
    reason_code: z.string().min(1),
    note: z.string().optional(),
    worker_credits: z.number().int().nonnegative().optional(),
    requester_credits: z.number().int().nonnegative().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.decision === 'split' &&
      (value.worker_credits === undefined || value.requester_credits === undefined)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['worker_credits'],
        message: 'split requires worker_credits and requester_credits',
      });
    }
  });
export type DisputeResolutionCreate = z.infer<typeof disputeResolutionCreate>;

/** AGENT-ECONOMY-004: internal marketplace listing. visibility is a literal
 *  — the lab has no public marketplace (0018 check mirrors this). */
export const marketplaceListingCreate = z.object({
  tenant_id: uuid,
  agent_id: uuid,
  skill_version_id: uuid,
  price_credits: z.number().int().positive(),
  summary: z.string().max(2000).optional(),
  visibility: z.literal('internal').default('internal'),
});
export type MarketplaceListingCreate = z.infer<typeof marketplaceListingCreate>;

/** Order work directly from a listing (price + skill come from the listing). */
export const orderFromListing = z.object({
  requester_agent_id: uuid,
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  proof_required: z.boolean().default(true),
  /** File the worker's accept ask on the Action Ledger when permitted. */
  file_accept_ask: z.boolean().default(true),
});
export type OrderFromListing = z.infer<typeof orderFromListing>;
