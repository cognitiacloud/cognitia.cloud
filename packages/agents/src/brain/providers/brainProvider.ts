/**
 * Cognitia Brain Harness — Provider boundary contracts.
 *
 * A `BrainProvider` is the single integration boundary between the router and a
 * concrete model backend (mock, OpenRouter, Ollama/local, OpenAI, Anthropic,
 * DeepSeek, xAI/Grok, or a CLI runner). The router depends ONLY on this
 * interface — never on a vendor SDK — so the harness stays offline and
 * mock-safe. This mirrors the `closer/ports.ts` pattern used elsewhere in this
 * package.
 *
 * In V1 the only registered, enabled provider is the mock. Every other provider
 * ships as a `*.disabled.ts` stub whose `generate()` throws
 * {@link ProviderDisabledError} and whose descriptor carries `enabled: false`.
 */

import type {
  BrainLatencyTier,
  BrainPrivacyLevel,
  BrainTaskType,
  TaskCapability,
} from '../taskRegistry.js';

/** Backend family for a provider. */
export type ProviderKind =
  | 'mock'
  | 'openrouter'
  | 'ollama'
  | 'openai'
  | 'anthropic'
  | 'deepseek'
  | 'xai'
  | 'cli';

/**
 * Where a provider runs relative to the workspace boundary:
 * - `mock`     — in-process fake, no IO at all.
 * - `local`    — on-box / self-hosted (e.g. Ollama); no third-party egress.
 * - `external` — third-party hosted API; data leaves the boundary.
 */
export type ProviderLocality = 'mock' | 'local' | 'external';

/** Capabilities, cost, latency and privacy ceiling of a single model. */
export interface ModelDescriptor {
  /** Stable model id (e.g. `mock-small`, `gpt-4o-mini`). */
  id: string;
  /** Capabilities this model offers; a task's requirements must be a subset. */
  capabilities: TaskCapability[];
  /** Estimated USD per 1k total tokens. Mock/local are 0. */
  costPer1kTokensUsd: number;
  /** Latency tier this model can satisfy (most-demanding it can meet). */
  latencyTier: BrainLatencyTier;
  /** Highest data sensitivity this model is permitted to process. */
  maxPrivacyLevel: BrainPrivacyLevel;
}

/** Static description of a provider and its models (no live state). */
export interface ProviderDescriptor {
  /** Provider id used in registry keys and the ledger (e.g. `mock`). */
  id: string;
  kind: ProviderKind;
  locality: ProviderLocality;
  /** V1: only the mock provider is `true`. */
  enabled: boolean;
  /**
   * Names of the environment variables a real implementation WOULD read to
   * enable itself (e.g. `OPENROUTER_API_KEY`). Names only — values are never
   * read or logged in V1. Empty for mock.
   */
  envVarNames: string[];
  /** Models this provider exposes. */
  models: ModelDescriptor[];
}

/**
 * A unit of work handed to a provider. `input` is the prompt text; it is used
 * in-memory only and is NEVER persisted raw — the ledger stores a hash of it.
 */
export interface BrainRequest {
  taskType: BrainTaskType;
  /** Prompt/content to run. Hashed for the ledger; never stored raw. */
  input: string;
  /** Optional specific model id; otherwise the provider picks its first model. */
  model?: string;
  /** Optional non-PII routing metadata (workspace, trace id, etc.). */
  metadata?: Record<string, string>;
}

/** A provider's answer. `output` stays in memory; the ledger stores its hash. */
export interface BrainResponse {
  provider: string;
  model: string;
  output: string;
  tokensIn: number;
  tokensOut: number;
  costEstimateUsd: number;
  latencyMs: number;
}

/** The provider boundary the router depends on. */
export interface BrainProvider {
  readonly id: string;
  readonly descriptor: ProviderDescriptor;
  /** Execute a request. Disabled providers throw {@link ProviderDisabledError}. */
  generate(request: BrainRequest): Promise<BrainResponse>;
}

/**
 * Thrown by every `*.disabled.ts` provider's `generate()`. Its existence is the
 * runtime guarantee that no real provider can execute in V1: even if a disabled
 * provider were registered by mistake, calling it fails loudly instead of
 * touching the network.
 */
export class ProviderDisabledError extends Error {
  constructor(
    public readonly providerId: string,
    message?: string,
  ) {
    super(message ?? `brain provider "${providerId}" is disabled in V1`);
    this.name = 'ProviderDisabledError';
  }
}

/**
 * Best-effort readiness check for a disabled provider: reports, as a boolean
 * only, whether its env var(s) are present in the environment. It NEVER reads
 * or returns the value. Used by the CLI to show "would be configurable" without
 * leaking secrets.
 */
export function envReadiness(envVarNames: string[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const name of envVarNames) {
    out[name] = typeof process.env[name] === 'string' && process.env[name] !== '';
  }
  return out;
}
