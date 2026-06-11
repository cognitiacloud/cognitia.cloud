import { z } from 'zod';
import { uuid, isoTimestamp } from './common.js';

/**
 * Cognitia v1.1 trust-layer schemas (Proof Registry, ATC, SkillProof,
 * Reputation, Lead Rescue, Credits, Wallet placeholders).
 *
 * Doctrine source: docs/cognitia/ARCHITECTURE_LOCK_V1_1.md. The invariants
 * encoded here (evidence-tag rules, publish gating, simulation-first,
 * placeholder-only wallets) are mirrored by DB constraints in migrations
 * 0009–0012 — keep both in sync.
 */

/** The evidence-integrity vocabulary. Everything important carries one. */
export const evidenceTag = z.enum(['verified_fact', 'likely_inference', 'unknown']);
export type EvidenceTag = z.infer<typeof evidenceTag>;

export const agentKind = z.enum(['front_desk', 'internal_ops', 'other']);
export const agentStatus = z.enum(['draft', 'active', 'suspended', 'retired']);
export const atcStatus = z.enum(['active', 'suspended', 'revoked', 'expired']);
export const permissionEffect = z.enum(['allow', 'deny']);
export const proofKind = z.enum([
  'lead_response',
  'booking',
  'skill_demo',
  'revenue_outcome',
  'system',
]);
export const skillTier = z.enum([
  'T0_claimed',
  'T1_demonstrated',
  'T2_verified',
  'T3_economically_proven',
]);
export const leadSource = z.enum(['sms_sim', 'sms_real', 'web', 'manual']);
export const piiStatus = z.enum(['raw', 'redacted', 'purged']);
export const leadOutcomeKind = z.enum(['rescued', 'booked', 'lost', 'no_response', 'in_progress']);
export const paymentRail = z.enum([
  'internal_credits',
  'stripe_card',
  'stablecoin',
  'other_future',
]);
export const walletChain = z.enum(['none', 'base', 'evm_other']);

/** Input for creating a proof. verified_fact must carry evidence + verifier. */
export const proofCreate = z
  .object({
    tenant_id: uuid,
    kind: proofKind,
    subject_type: z.string().min(1),
    subject_id: uuid,
    evidence_tag: evidenceTag,
    evidence_ref: z.string().min(1).optional(),
    verifier_ref: z.string().min(1).optional(),
    summary_public: z.string().optional(),
    details_private: z.record(z.unknown()).default({}),
    supersedes_proof_id: uuid.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.evidence_tag === 'verified_fact') {
      if (!value.evidence_ref) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['evidence_ref'],
          message: 'verified_fact requires evidence_ref',
        });
      }
      if (!value.verifier_ref) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['verifier_ref'],
          message: 'verified_fact requires verifier_ref',
        });
      }
    }
  });
export type ProofCreate = z.infer<typeof proofCreate>;

/** ATC claims payload: scope/vertical/policy refs only — never customer PII. */
export const atcClaims = z
  .object({
    scope: z.array(z.string()).default([]),
    vertical: z.string().optional(),
    policy_refs: z.array(z.string()).default([]),
  })
  // strict(): unknown keys are rejected, so customer fields (names, phones,
  // emails, addresses) can never ride along inside a credential.
  .strict();

/** Input for registering an agent (COG-004). */
export const agentCreate = z.object({
  tenant_id: uuid,
  name: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'slug must be lowercase kebab-case'),
  runtime_key: z.string().min(1).optional(),
  kind: agentKind.default('other'),
  description: z.string().optional(),
});
export type AgentCreate = z.infer<typeof agentCreate>;

export const atcCreate = z.object({
  tenant_id: uuid,
  agent_id: uuid,
  issuer: z.string().min(1).default('cognitia.internal'),
  subject_ref: z.string().min(1),
  claims: atcClaims.default({}),
  expires_at: isoTimestamp.optional(),
  /** Future ERC-8004 / EAS / existing-method DID ref. Never a custom DID. */
  external_ref: z.string().optional(),
});
export type AtcCreate = z.infer<typeof atcCreate>;

export const reputationEventCreate = z.object({
  tenant_id: uuid,
  agent_id: uuid,
  proof_id: uuid,
  delta: z.number(),
  reason_code: z.string().min(1),
});
export type ReputationEventCreate = z.infer<typeof reputationEventCreate>;

/**
 * Doctrine rule evaluated wherever reputation is written (DB trigger mirrors
 * it): a positive delta is only legal against a verified_fact proof.
 */
export function canApplyReputationDelta(delta: number, proofTag: EvidenceTag): boolean {
  return delta <= 0 || proofTag === 'verified_fact';
}

export const leadIntakeCreate = z.object({
  tenant_id: uuid,
  lead_id: uuid.optional(),
  source: leadSource,
  channel_ref: z.string().optional(),
  contact_name_enc: z.string().optional(),
  contact_phone_enc: z.string().optional(),
  contact_phone_hash: z.string().optional(),
  message_body_enc: z.string().optional(),
  received_at: isoTimestamp.optional(),
  consent_captured: z.boolean().default(false),
});
export type LeadIntakeCreate = z.infer<typeof leadIntakeCreate>;

export const leadOutcomeCreate = z.object({
  tenant_id: uuid,
  lead_intake_id: uuid,
  outcome: leadOutcomeKind,
  response_time_ms: z.number().int().nonnegative().optional(),
  booking_value_cents: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).default('CAD'),
  evidence_tag: evidenceTag,
  proof_id: uuid.optional(),
});
export type LeadOutcomeCreate = z.infer<typeof leadOutcomeCreate>;

/** A credits transfer: one balanced debit+credit pair, idempotent by key. */
export const creditsTransfer = z
  .object({
    tenant_id: uuid,
    from_account_id: uuid,
    to_account_id: uuid,
    amount: z.number().int().positive(),
    rail: paymentRail.default('internal_credits'),
    reason_code: z.string().min(1),
    idempotency_key: z.string().min(1),
  })
  .refine((value) => value.from_account_id !== value.to_account_id, {
    message: 'transfer requires two distinct accounts',
    path: ['to_account_id'],
  });
export type CreditsTransfer = z.infer<typeof creditsTransfer>;

/** v1.1 wallet bindings are inert placeholders only (Lane C, legal-gated). */
export const walletBindingCreate = z.object({
  tenant_id: uuid,
  owner_type: z.enum(['tenant', 'agent']),
  owner_id: uuid,
  chain: walletChain.default('none'),
  address: z.string().optional(),
  status: z.literal('placeholder').default('placeholder'),
});
export type WalletBindingCreate = z.infer<typeof walletBindingCreate>;
