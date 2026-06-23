/**
 * Cognitia Brain Harness V1 — workspace model policy (fail-closed).
 *
 * STATUS: MOCK / SANDBOX. Pure, deterministic decision function. Models the
 * governance a workspace imposes on which model may serve a task: allow-lists,
 * cost ceiling, latency tier, local-only mode, and data-classification ↔ privacy
 * tier. Mirrors the fail-closed style of `security/releaseGate.ts`.
 *
 * This module makes NO provider call and reads NO secret.
 */
import {
  DATA_CLASSIFICATION_MIN_PRIVACY,
  LATENCY_TIER_RANK,
  PRIVACY_TIER_RANK,
  type DataClassification,
  type LatencyTier,
  type ModelDescriptor,
  type ProviderId,
} from './modelProvider.js';

/** Per-workspace policy governing model selection. */
export interface WorkspaceModelPolicy {
  /** Provider ids the workspace permits. Empty = none permitted (fail closed). */
  allowedProviders: readonly ProviderId[];
  /** Optional `providerId/modelId` allow-list. Omitted = any model of an allowed provider. */
  allowedModels?: readonly string[];
  /** When true, only `location: 'local'` models may run (blocks external APIs). */
  localOnly: boolean;
  /** Maximum blended USD cost per 1K tokens a model may carry. */
  costCeilingPer1kUsd: number;
  /** Slowest latency tier permitted. */
  maxLatencyTier: LatencyTier;
  /** Data classifications the workspace allows routing at all. Empty = all. */
  allowedDataClassifications?: readonly DataClassification[];
  /** Whether high-risk tasks require an explicit approval flag to run. */
  requireApprovalForHighRisk: boolean;
}

/** Canonical key for a model in an allow-list / receipt. */
export function modelKey(providerId: string, modelId: string): string {
  return `${providerId}/${modelId}`;
}

export interface ModelPolicyContext {
  policy: WorkspaceModelPolicy;
  dataClassification: DataClassification;
}

export interface ModelPolicyDecision {
  allow: boolean;
  /** Stable, machine-readable block reasons (empty when allowed). */
  reasons: readonly string[];
}

/**
 * Evaluate whether `descriptor` may serve a task under `policy` for the given
 * data classification. Pure and order-stable. Disabled-provider state is
 * enforced by the router, not here (policy is governance only).
 */
export function evaluateModelPolicy(
  descriptor: ModelDescriptor,
  ctx: ModelPolicyContext,
): ModelPolicyDecision {
  const { policy, dataClassification } = ctx;
  const reasons: string[] = [];

  if (!policy.allowedProviders.includes(descriptor.providerId)) {
    reasons.push('provider_not_allowed');
  }

  if (
    policy.allowedModels &&
    policy.allowedModels.length > 0 &&
    !policy.allowedModels.includes(modelKey(descriptor.providerId, descriptor.modelId))
  ) {
    reasons.push('model_not_allowed');
  }

  if (policy.localOnly && descriptor.location !== 'local') {
    reasons.push('local_only_policy');
  }

  if (descriptor.costPer1kTokensUsd > policy.costCeilingPer1kUsd) {
    reasons.push('cost_ceiling_exceeded');
  }

  if (LATENCY_TIER_RANK[descriptor.latencyTier] > LATENCY_TIER_RANK[policy.maxLatencyTier]) {
    reasons.push('latency_tier_exceeded');
  }

  if (
    policy.allowedDataClassifications &&
    policy.allowedDataClassifications.length > 0 &&
    !policy.allowedDataClassifications.includes(dataClassification)
  ) {
    reasons.push('data_classification_not_allowed');
  }

  const requiredPrivacy = DATA_CLASSIFICATION_MIN_PRIVACY[dataClassification];
  if (PRIVACY_TIER_RANK[descriptor.privacyTier] < requiredPrivacy) {
    reasons.push('data_classification_requires_higher_privacy');
  }

  return { allow: reasons.length === 0, reasons };
}

/**
 * A conservative default policy: mock-only, local-only, zero cost ceiling,
 * fast latency, no high-risk auto-run. Useful as a safe baseline in tests/docs.
 */
export function defaultLocalOnlyPolicy(): WorkspaceModelPolicy {
  return {
    allowedProviders: ['mock'],
    localOnly: true,
    costCeilingPer1kUsd: 0,
    maxLatencyTier: 'fast',
    requireApprovalForHighRisk: true,
  };
}
