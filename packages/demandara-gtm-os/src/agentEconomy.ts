import { z } from 'zod';
import { evidenceLabel } from './types.js';

/**
 * Agent-economy COMPATIBILITY layer (09_AGENT_ECONOMY_SAFE_INTERNAL_CONTEXT.md).
 *
 * Internal work/reputation/credit concepts as TYPES ONLY. There is no token,
 * crypto, wallet, escrow, stablecoin, live payment, marketplace, or
 * securities-language implementation here, and none is authorized. The
 * forbidden list is exported so tests and reviews can assert the boundary.
 */

export const AGENT_ECONOMY_FORBIDDEN_FEATURES = [
  'public_token_launch',
  'crypto_or_wallet_integration',
  'escrow_or_stablecoin',
  'live_payment_integration',
  'marketplace_claims',
  'public_reputation_scoring',
  'investment_or_yield_language',
] as const;

/** This build implements no payment behavior of any kind. */
export const AGENT_ECONOMY_PAYMENTS_IMPLEMENTED = false as const;

/** A task/action/event performed by an agent — local ledger material only. */
export const agentWorkEventSchema = z.object({
  workEventId: z.string().min(1),
  agentId: z.string().min(1),
  kind: z.string().min(1),
  occurredAt: z.string().min(1),
  proofReceiptId: z.string().min(1).optional(),
  evidenceLabel,
});
export type AgentWorkEvent = z.infer<typeof agentWorkEventSchema>;

/** Stable internal identity for an agent/process (design/local schema only). */
export const agentPassportSchema = z.object({
  agentId: z.string().min(1),
  role: z.string().min(1),
  allowedScopes: z.array(z.string()).default([]),
  deniedScopes: z.array(z.string()).default([]),
  workEventIds: z.array(z.string()).default([]),
  proofEventIds: z.array(z.string()).default([]),
  reviewEventIds: z.array(z.string()).default([]),
  blockedAttemptIds: z.array(z.string()).default([]),
  modelToolRoute: z.string().min(1).default('mock'),
  evidenceHash: z.string().min(1).optional(),
});
export type AgentPassport = z.infer<typeof agentPassportSchema>;
