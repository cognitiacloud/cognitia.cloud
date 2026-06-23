/**
 * Cognitia Brain Harness — Model registry + fail-closed policy engine.
 *
 * This module decides whether a given (task, provider, model) combination is
 * allowed to run for a workspace. It is the safety core of the harness and is
 * deliberately PURE and fail-closed (mirroring `closer/automationReleaseGate.ts`):
 * any unknown/missing input is treated as NOT satisfied, and the default
 * outcome is `blocked`.
 *
 * It enforces, in order: provider-enabled, mode vs locality (local-only blocks
 * external; external-api required for external), workspace allow/block lists,
 * task→model capability match, per-task cost ceiling, latency tier, privacy
 * ceiling, and high-risk human-approval. No IO, no provider calls.
 */

import {
  LATENCY_RANK,
  PRIVACY_RANK,
  type BrainLatencyTier,
  type BrainPrivacyLevel,
  type BrainTask,
} from './taskRegistry.js';
import type { ModelDescriptor, ProviderDescriptor } from './providers/brainProvider.js';

/** Routing mode for a workspace. */
export type BrainMode =
  /** Only the in-process mock may run (default; safest). */
  | 'mock'
  /** Only `mock` + `local` providers may run; external egress is blocked. */
  | 'local-only'
  /** External providers are permitted (subject to all other checks). */
  | 'external-api';

/**
 * The provider/model registry. In V1 only `mock` is `enabled`. Every other
 * provider is present (so it shows up in `models:list` and policy explanations)
 * but disabled, carrying ONLY the names of the env vars a future real
 * implementation would read.
 */
export const PROVIDER_REGISTRY: Record<string, ProviderDescriptor> = {
  mock: {
    id: 'mock',
    kind: 'mock',
    locality: 'mock',
    enabled: true,
    envVarNames: [],
    models: [
      {
        id: 'mock-small',
        capabilities: ['classification', 'summarization', 'extraction'],
        costPer1kTokensUsd: 0,
        latencyTier: 'realtime',
        maxPrivacyLevel: 'restricted',
      },
      {
        id: 'mock-large',
        capabilities: [
          'reasoning',
          'long_context',
          'code',
          'json_mode',
          'classification',
          'summarization',
          'web_research',
          'extraction',
        ],
        costPer1kTokensUsd: 0,
        latencyTier: 'standard',
        maxPrivacyLevel: 'restricted',
      },
    ],
  },
  ollama: {
    id: 'ollama',
    kind: 'ollama',
    locality: 'local',
    enabled: false,
    envVarNames: ['OLLAMA_BASE_URL'],
    models: [
      {
        id: 'llama3.1:8b',
        capabilities: ['reasoning', 'summarization', 'classification', 'extraction', 'code'],
        costPer1kTokensUsd: 0,
        latencyTier: 'standard',
        // Local models may process the most sensitive data (no third-party egress).
        maxPrivacyLevel: 'restricted',
      },
    ],
  },
  openrouter: {
    id: 'openrouter',
    kind: 'openrouter',
    locality: 'external',
    enabled: false,
    envVarNames: ['OPENROUTER_API_KEY'],
    models: [
      {
        id: 'openrouter/auto',
        capabilities: [
          'reasoning',
          'long_context',
          'code',
          'json_mode',
          'classification',
          'summarization',
          'web_research',
          'extraction',
        ],
        costPer1kTokensUsd: 0.006,
        latencyTier: 'standard',
        // External providers may not process restricted data.
        maxPrivacyLevel: 'confidential',
      },
    ],
  },
  openai: {
    id: 'openai',
    kind: 'openai',
    locality: 'external',
    enabled: false,
    envVarNames: ['OPENAI_API_KEY'],
    models: [
      {
        id: 'gpt-4o-mini',
        capabilities: ['reasoning', 'code', 'json_mode', 'classification', 'summarization'],
        costPer1kTokensUsd: 0.0006,
        latencyTier: 'realtime',
        maxPrivacyLevel: 'confidential',
      },
    ],
  },
  anthropic: {
    id: 'anthropic',
    kind: 'anthropic',
    locality: 'external',
    enabled: false,
    envVarNames: ['ANTHROPIC_API_KEY'],
    models: [
      {
        id: 'claude-family',
        capabilities: [
          'reasoning',
          'long_context',
          'code',
          'json_mode',
          'summarization',
          'extraction',
        ],
        costPer1kTokensUsd: 0.003,
        latencyTier: 'standard',
        maxPrivacyLevel: 'confidential',
      },
    ],
  },
  deepseek: {
    id: 'deepseek',
    kind: 'deepseek',
    locality: 'external',
    enabled: false,
    envVarNames: ['DEEPSEEK_API_KEY'],
    models: [
      {
        id: 'deepseek-chat',
        capabilities: ['reasoning', 'code', 'classification', 'summarization'],
        costPer1kTokensUsd: 0.0008,
        latencyTier: 'standard',
        maxPrivacyLevel: 'internal',
      },
    ],
  },
  xai: {
    id: 'xai',
    kind: 'xai',
    locality: 'external',
    enabled: false,
    envVarNames: ['XAI_API_KEY'],
    models: [
      {
        id: 'grok-family',
        capabilities: ['reasoning', 'web_research', 'classification', 'summarization'],
        costPer1kTokensUsd: 0.005,
        latencyTier: 'standard',
        maxPrivacyLevel: 'internal',
      },
    ],
  },
  cli: {
    id: 'cli',
    kind: 'cli',
    locality: 'local',
    enabled: false,
    // A local CLI runner reads no API key; it would shell out to a local binary.
    // Disabled by default regardless.
    envVarNames: [],
    models: [
      {
        id: 'cli-runner',
        capabilities: ['reasoning', 'summarization', 'code'],
        costPer1kTokensUsd: 0,
        latencyTier: 'batch',
        maxPrivacyLevel: 'restricted',
      },
    ],
  },
};

/** Per-workspace routing policy. */
export interface WorkspaceBrainPolicy {
  workspaceId: string;
  /** Routing mode (default `mock`). */
  mode: BrainMode;
  /** Hard ceiling: external providers blocked unless `external-api` mode too. */
  allowExternal: boolean;
  /** Per-run cost ceiling in USD; a task may tighten this further. */
  costCeilingUsd: number;
  /** Strictest latency tier the workspace will tolerate. */
  maxLatencyTier: BrainLatencyTier;
  /** Highest data sensitivity the workspace permits to leave to any provider. */
  maxPrivacyLevel: BrainPrivacyLevel;
  /** When true, high-risk tasks require explicit human approval to execute. */
  requireApprovalForHighRisk: boolean;
  /** Preferred provider tried first. */
  preferredProvider?: string;
  /** Ordered fallback providers tried after the preferred one. */
  fallbackChain?: string[];
  /** If set, only these providers may run for the workspace. */
  allowedProviders?: string[];
  /** Providers explicitly forbidden for the workspace. */
  blockedProviders?: string[];
}

/**
 * A safe, conservative default policy: mock-only, no external egress, tight
 * cost, approval required for high-risk. Workspaces opt into more.
 */
export function defaultWorkspacePolicy(workspaceId: string): WorkspaceBrainPolicy {
  return {
    workspaceId,
    mode: 'mock',
    allowExternal: false,
    costCeilingUsd: 0.1,
    maxLatencyTier: 'batch',
    maxPrivacyLevel: 'restricted',
    requireApprovalForHighRisk: true,
    preferredProvider: 'mock',
    fallbackChain: ['mock'],
  };
}

/** Stable codes for the first failing (or passing) policy check. */
export type BrainPolicyDecisionCode =
  | 'allow'
  | 'requires_approval'
  | 'provider_disabled'
  | 'mode_blocks_external'
  | 'mode_blocks_local'
  | 'provider_not_allowed'
  | 'provider_blocked'
  | 'capability_mismatch'
  | 'cost_ceiling_exceeded'
  | 'latency_tier_exceeded'
  | 'privacy_level_exceeded'
  | 'unknown_task';

/** Outcome of evaluating one (task, provider, model) candidate. */
export interface BrainPolicyDecision {
  allowed: boolean;
  blocked: boolean;
  requiresApproval: boolean;
  decisionCode: BrainPolicyDecisionCode;
  reasons: string[];
}

export interface EvaluateBrainPolicyInput {
  task: BrainTask;
  provider: ProviderDescriptor;
  model: ModelDescriptor;
  workspacePolicy: WorkspaceBrainPolicy;
  /** Whether a human approval has been supplied for this run. */
  approvalGranted?: boolean;
}

function blocked(
  code: BrainPolicyDecisionCode,
  reason: string,
  requiresApproval = false,
): BrainPolicyDecision {
  return { allowed: false, blocked: true, requiresApproval, decisionCode: code, reasons: [reason] };
}

/**
 * Evaluate a single candidate, fail-closed. Returns the FIRST failing check, or
 * `allow`. Checks are ordered cheapest/most-fundamental first.
 */
export function evaluateBrainPolicy(input: EvaluateBrainPolicyInput): BrainPolicyDecision {
  const { task, provider, model, workspacePolicy: wp, approvalGranted } = input;

  // 1) Provider must be enabled (V1: only mock).
  if (!provider.enabled) {
    return blocked('provider_disabled', `provider "${provider.id}" is disabled`);
  }

  // 2) Mode vs locality.
  if (provider.locality === 'external') {
    if (wp.mode === 'local-only' || wp.mode === 'mock' || !wp.allowExternal) {
      return blocked(
        'mode_blocks_external',
        `mode "${wp.mode}" / allowExternal=${wp.allowExternal} forbids external provider "${provider.id}"`,
      );
    }
  }
  if (provider.locality === 'local' && wp.mode === 'mock') {
    return blocked('mode_blocks_local', `mode "mock" forbids local provider "${provider.id}"`);
  }

  // 3) Workspace allow/block lists.
  if (wp.blockedProviders?.includes(provider.id)) {
    return blocked('provider_blocked', `provider "${provider.id}" is on the workspace blocklist`);
  }
  if (wp.allowedProviders && !wp.allowedProviders.includes(provider.id)) {
    return blocked(
      'provider_not_allowed',
      `provider "${provider.id}" is not on the workspace allowlist`,
    );
  }

  // 4) Capability match: model must offer every required capability.
  const missing = task.requiredCapabilities.filter((c) => !model.capabilities.includes(c));
  if (missing.length > 0) {
    return blocked(
      'capability_mismatch',
      `model "${model.id}" missing capabilities: ${missing.join(', ')}`,
    );
  }

  // 5) Cost ceiling — the tighter of task and workspace ceilings.
  const ceiling = Math.min(task.costCeilingUsd, wp.costCeilingUsd);
  const estCost = estimateRunCostUsd(model);
  if (estCost > ceiling) {
    return blocked(
      'cost_ceiling_exceeded',
      `estimated $${estCost.toFixed(4)} exceeds ceiling $${ceiling.toFixed(4)}`,
    );
  }

  // 6) Latency tier — model must meet the stricter of task and workspace tiers.
  const requiredTier = stricterLatency(task.defaultLatencyTier, wp.maxLatencyTier);
  if (LATENCY_RANK[model.latencyTier] < LATENCY_RANK[requiredTier]) {
    return blocked(
      'latency_tier_exceeded',
      `model latency "${model.latencyTier}" cannot meet required "${requiredTier}"`,
    );
  }

  // 7) Privacy ceiling — the task's data sensitivity must not exceed what either
  //    the model or the workspace permits.
  const dataPrivacy = task.defaultPrivacy;
  if (PRIVACY_RANK[dataPrivacy] > PRIVACY_RANK[model.maxPrivacyLevel]) {
    return blocked(
      'privacy_level_exceeded',
      `task privacy "${dataPrivacy}" exceeds model max "${model.maxPrivacyLevel}"`,
    );
  }
  if (PRIVACY_RANK[dataPrivacy] > PRIVACY_RANK[wp.maxPrivacyLevel]) {
    return blocked(
      'privacy_level_exceeded',
      `task privacy "${dataPrivacy}" exceeds workspace max "${wp.maxPrivacyLevel}"`,
    );
  }

  // 8) Human approval for high-risk / approval-required tasks.
  const needsApproval =
    task.requiresHumanApproval || (task.riskLevel === 'high' && wp.requireApprovalForHighRisk);
  if (needsApproval && !approvalGranted) {
    return {
      allowed: false,
      blocked: false,
      requiresApproval: true,
      decisionCode: 'requires_approval',
      reasons: [`task "${task.id}" is ${task.riskLevel}-risk and requires human approval`],
    };
  }

  return {
    allowed: true,
    blocked: false,
    requiresApproval: false,
    decisionCode: 'allow',
    reasons: ['all policy checks passed'],
  };
}

/** Estimate the USD cost of a single nominal run (~1k in + ~0.5k out tokens). */
export function estimateRunCostUsd(model: ModelDescriptor): number {
  const nominalThousands = 1.5; // 1000 in + 500 out
  return Number((model.costPer1kTokensUsd * nominalThousands).toFixed(6));
}

function stricterLatency(a: BrainLatencyTier, b: BrainLatencyTier): BrainLatencyTier {
  return LATENCY_RANK[a] >= LATENCY_RANK[b] ? a : b;
}

/** Per-provider treatment under a workspace policy (for `policy:explain`). */
export interface ProviderPolicyExplanation {
  provider: string;
  kind: string;
  locality: string;
  enabled: boolean;
  /** Whether the mode/lists would even permit this provider before task checks. */
  permittedByMode: boolean;
  reason: string;
}

/** A scannable explanation of how a workspace policy treats every provider. */
export interface WorkspacePolicyExplanation {
  workspaceId: string;
  mode: BrainMode;
  allowExternal: boolean;
  costCeilingUsd: number;
  maxLatencyTier: BrainLatencyTier;
  maxPrivacyLevel: BrainPrivacyLevel;
  requireApprovalForHighRisk: boolean;
  preferredProvider?: string;
  fallbackChain: string[];
  providers: ProviderPolicyExplanation[];
}

/**
 * Explain — independent of any single task — which providers the workspace mode
 * and allow/block lists would permit. Useful for the `policy:explain` CLI.
 */
export function explainWorkspacePolicy(
  wp: WorkspaceBrainPolicy,
  registry: Record<string, ProviderDescriptor> = PROVIDER_REGISTRY,
): WorkspacePolicyExplanation {
  const providers: ProviderPolicyExplanation[] = Object.values(registry).map((p) => {
    let permitted = true;
    let reason = 'permitted by mode and lists';
    if (!p.enabled) {
      permitted = false;
      reason = 'provider disabled in V1';
    } else if (p.locality === 'external' && (!wp.allowExternal || wp.mode !== 'external-api')) {
      permitted = false;
      reason = `external provider blocked by mode "${wp.mode}"`;
    } else if (p.locality === 'local' && wp.mode === 'mock') {
      permitted = false;
      reason = 'local provider blocked by mock mode';
    } else if (wp.blockedProviders?.includes(p.id)) {
      permitted = false;
      reason = 'on workspace blocklist';
    } else if (wp.allowedProviders && !wp.allowedProviders.includes(p.id)) {
      permitted = false;
      reason = 'not on workspace allowlist';
    }
    return {
      provider: p.id,
      kind: p.kind,
      locality: p.locality,
      enabled: p.enabled,
      permittedByMode: permitted,
      reason,
    };
  });

  return {
    workspaceId: wp.workspaceId,
    mode: wp.mode,
    allowExternal: wp.allowExternal,
    costCeilingUsd: wp.costCeilingUsd,
    maxLatencyTier: wp.maxLatencyTier,
    maxPrivacyLevel: wp.maxPrivacyLevel,
    requireApprovalForHighRisk: wp.requireApprovalForHighRisk,
    preferredProvider: wp.preferredProvider,
    fallbackChain: wp.fallbackChain ?? ['mock'],
    providers,
  };
}
