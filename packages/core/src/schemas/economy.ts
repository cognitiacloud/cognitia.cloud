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
