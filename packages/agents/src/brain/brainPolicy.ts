/**
 * Per-workspace brain policy + a pure model/policy evaluator.
 *
 * The policy is the safety envelope the router must satisfy before any (mock)
 * execution: which providers are allowed/blocked, a cost ceiling, a privacy
 * ceiling for external providers, a latency ceiling, a local-only switch, and a
 * high-risk approval requirement. Evaluation is a pure function — fail closed,
 * first failure wins — mirroring `channels/channelPolicy.ts`.
 */

import {
  latencyRank,
  privacyRank,
  type BrainTask,
  type LatencyTier,
  type ModelDescriptor,
  type PrivacyTier,
  type Provider,
} from './taskRegistry.js';

/** Stable reason codes for a per-model policy decision. */
export type PolicyReasonCode =
  | 'ok'
  | 'provider_blocked'
  | 'local_only'
  | 'privacy_tier_exceeded'
  | 'cost_ceiling_exceeded'
  | 'latency_tier_exceeded';

/** The routing policy a workspace configures for the brain. */
export interface WorkspaceBrainPolicy {
  /** If set, ONLY these providers are permitted (allowlist). */
  allowedProviders?: Provider[];
  /** Providers that are always denied (denylist), checked after the allowlist. */
  blockedProviders?: Provider[];
  /** Tie-break preference when several models survive policy. */
  preferredProvider?: Provider;
  /** Ordered provider preference used for selection + fallback ordering. */
  fallbackChain?: Provider[];
  /** Maximum per-call cost (USD) a selected model may have. */
  costCeilingUsd: number;
  /** Most sensitive data tier permitted to leave to an EXTERNAL provider. */
  privacyTier: PrivacyTier;
  /** Slowest acceptable latency tier. */
  latencyTier: LatencyTier;
  /** When true, only local-residency models are permitted. */
  localOnly: boolean;
  /** When true, high-risk tasks require approval before (mock) execution. */
  requireApprovalForHighRisk: boolean;
}

/**
 * Safe-by-default policy: external confidential allowed, modest cost ceiling,
 * high-risk approval required. Not local-only (callers tighten as needed).
 */
export const DEFAULT_BRAIN_POLICY: WorkspaceBrainPolicy = {
  costCeilingUsd: 0.05,
  privacyTier: 'confidential',
  latencyTier: 'batch',
  localOnly: false,
  requireApprovalForHighRisk: true,
};

/** The result of evaluating one model against the policy for a task. */
export interface ModelEvaluation {
  modelId: string;
  provider: Provider;
  allow: boolean;
  reasonCode: PolicyReasonCode;
  /** Human-readable `snake_case:detail` reason; empty string on allow. */
  reason: string;
}

/**
 * Evaluate a single candidate model against the workspace policy for a task.
 * Pure and fail-closed. Checks run in a fixed priority order and the first
 * failure wins, so the reasonCode is deterministic for a given input.
 */
export function evaluateModelAgainstPolicy(
  model: ModelDescriptor,
  task: BrainTask,
  policy: WorkspaceBrainPolicy,
): ModelEvaluation {
  const base = { modelId: model.id, provider: model.provider };

  // 1. Provider allow/deny.
  if (
    Array.isArray(policy.allowedProviders) &&
    policy.allowedProviders.length > 0 &&
    !policy.allowedProviders.includes(model.provider)
  ) {
    return {
      ...base,
      allow: false,
      reasonCode: 'provider_blocked',
      reason: `provider_blocked: "${model.provider}" is not in allowedProviders`,
    };
  }
  if (Array.isArray(policy.blockedProviders) && policy.blockedProviders.includes(model.provider)) {
    return {
      ...base,
      allow: false,
      reasonCode: 'provider_blocked',
      reason: `provider_blocked: "${model.provider}" is in blockedProviders`,
    };
  }

  // 2. Local-only: any external model is denied outright.
  if (policy.localOnly === true && model.residency === 'external') {
    return {
      ...base,
      allow: false,
      reasonCode: 'local_only',
      reason: 'local_only: policy permits local-residency models only',
    };
  }

  // 3. Privacy: for external models the effective ceiling is the stricter of
  //    the policy ceiling and what the model itself may handle. Local models
  //    keep data in-boundary, so the policy ceiling does not gate them (their
  //    own maxDataTier still does).
  const taskRank = privacyRank(task.dataTier);
  if (model.residency === 'external') {
    const effectiveCeiling = Math.min(
      privacyRank(policy.privacyTier),
      privacyRank(model.maxDataTier),
    );
    if (taskRank > effectiveCeiling) {
      return {
        ...base,
        allow: false,
        reasonCode: 'privacy_tier_exceeded',
        reason: `privacy_tier_exceeded: task data tier "${task.dataTier}" exceeds external ceiling`,
      };
    }
  } else if (taskRank > privacyRank(model.maxDataTier)) {
    return {
      ...base,
      allow: false,
      reasonCode: 'privacy_tier_exceeded',
      reason: `privacy_tier_exceeded: task data tier "${task.dataTier}" exceeds model maxDataTier "${model.maxDataTier}"`,
    };
  }

  // 4. Cost ceiling.
  if (model.costPerCallUsd > policy.costCeilingUsd) {
    return {
      ...base,
      allow: false,
      reasonCode: 'cost_ceiling_exceeded',
      reason: `cost_ceiling_exceeded: ${model.costPerCallUsd} > ceiling ${policy.costCeilingUsd}`,
    };
  }

  // 5. Latency ceiling.
  if (latencyRank(model.latencyTier) > latencyRank(policy.latencyTier)) {
    return {
      ...base,
      allow: false,
      reasonCode: 'latency_tier_exceeded',
      reason: `latency_tier_exceeded: model "${model.latencyTier}" slower than policy "${policy.latencyTier}"`,
    };
  }

  return { ...base, allow: true, reasonCode: 'ok', reason: '' };
}
