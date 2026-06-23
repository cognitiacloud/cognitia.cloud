/**
 * Cognitia Brain Harness V1 — provider contract.
 *
 * STATUS: MOCK / SANDBOX (V1 is mock-safe and makes NO real provider calls).
 *
 * This module defines the model-agnostic provider interface the governed
 * {@link ./modelRouter ModelRouter} routes through, so agents never hardcode a
 * single LLM. It is designed for future OpenAI / Anthropic / DeepSeek / xAI /
 * OpenRouter and local (Ollama / vLLM / LM Studio) providers, but in V1 only the
 * deterministic mock provider is executable; every external/local provider is
 * registered as metadata only and fails closed (see `providers/*.disabled.ts`).
 *
 * Hard rules honored here: no network/`fetch`, no vendor SDK imports, no secrets.
 */

/** A provider namespace, e.g. `mock`, `openai`, `anthropic`, `ollama`. */
export type ProviderId = string;

/** A concrete model id within a provider, e.g. `mock-deterministic-1`. */
export type ModelId = string;

/**
 * Execution mode recorded on every usage receipt. V1 only ever executes
 * `mock`; the disabled providers carry `external_disabled` / `local_disabled`;
 * `local_ready` is reserved for when a local OpenAI-compatible endpoint is
 * explicitly configured out-of-band (still no code path in V1).
 */
export type ProviderMode = 'mock' | 'external_disabled' | 'local_disabled' | 'local_ready';

/** Capabilities a task may require and a model may advertise. */
export type ModelCapability =
  | 'text'
  | 'reasoning'
  | 'code'
  | 'tool_call'
  | 'structured_output'
  | 'vision'
  | 'long_context';

/** Coarse latency tier, ordered fast → slow. */
export type LatencyTier = 'fast' | 'standard' | 'slow';

export const LATENCY_TIERS = ['fast', 'standard', 'slow'] as const;

/** Rank for latency comparison (lower is faster). */
export const LATENCY_TIER_RANK: Readonly<Record<LatencyTier, number>> = {
  fast: 0,
  standard: 1,
  slow: 2,
};

/** Synthetic, deterministic latency per tier (ms) used by the mock harness. */
export const SYNTHETIC_LATENCY_MS: Readonly<Record<LatencyTier, number>> = {
  fast: 40,
  standard: 180,
  slow: 900,
};

/**
 * Privacy guarantee of where a model runs. `public` = external hosted API;
 * `private` = self-hosted / VPC; `on_device` = fully local. Higher rank can
 * handle more sensitive data classifications.
 */
export type PrivacyTier = 'public' | 'private' | 'on_device';

export const PRIVACY_TIER_RANK: Readonly<Record<PrivacyTier, number>> = {
  public: 0,
  private: 1,
  on_device: 2,
};

/** Data sensitivity of a task's inputs, used by the router/policy. */
export type DataClassification = 'public' | 'internal' | 'confidential' | 'restricted';

/**
 * Minimum provider privacy rank required to handle each data classification.
 * `confidential` requires at least `private`; `restricted` requires `on_device`.
 */
export const DATA_CLASSIFICATION_MIN_PRIVACY: Readonly<Record<DataClassification, number>> = {
  public: PRIVACY_TIER_RANK.public,
  internal: PRIVACY_TIER_RANK.public,
  confidential: PRIVACY_TIER_RANK.private,
  restricted: PRIVACY_TIER_RANK.on_device,
};

/** Whether a model runs locally (on-box / self-hosted) or via an external API. */
export type ModelLocation = 'local' | 'external';

/** Static description of a registered model. Disabled models carry only this. */
export interface ModelDescriptor {
  providerId: ProviderId;
  modelId: ModelId;
  capabilities: readonly ModelCapability[];
  /** Maximum context window in tokens. */
  contextWindow: number;
  mode: ProviderMode;
  location: ModelLocation;
  /** Blended estimated cost in USD per 1K tokens. `0` for mock/local. */
  costPer1kTokensUsd: number;
  latencyTier: LatencyTier;
  privacyTier: PrivacyTier;
  toolCallSupport: boolean;
  structuredOutputSupport: boolean;
  /** Only `enabled` models may execute. Disabled = registered metadata only. */
  enabled: boolean;
}

/** A generation request. The raw `prompt` is NEVER persisted — only hashed. */
export interface GenerateRequest {
  /** Raw prompt text. Hashed into the receipt; never stored verbatim. */
  prompt: string;
  /** Optional system preamble. Also hashed, never stored verbatim. */
  system?: string;
  /** Logical task type (e.g. `prospect.research`). */
  taskType: string;
  /** Names of tools the caller wants available (requires `toolCallSupport`). */
  tools?: readonly string[];
  /** Request structured/JSON output (requires `structuredOutputSupport`). */
  structured?: boolean;
}

export type FinishReason = 'stop' | 'length' | 'tool_call';

/** A generation result. */
export interface GenerateResult {
  output: string;
  tokensIn: number;
  tokensOut: number;
  finishReason: FinishReason;
  /** Present only when `structured` was requested and supported. */
  structuredOutput?: unknown;
}

/**
 * The provider contract. `generate` is required; `stream` is intentionally
 * omitted in V1 (reserved for a later, still-governed iteration).
 */
export interface ModelProvider {
  readonly descriptor: ModelDescriptor;
  generate(request: GenerateRequest): Promise<GenerateResult>;
}

/** Thrown when a disabled provider's `generate` is invoked. */
export class ProviderDisabledError extends Error {
  readonly providerId: string;
  readonly modelId: string;
  constructor(providerId: string, modelId: string) {
    super(
      `brain: provider "${providerId}" model "${modelId}" is disabled (mock-safe V1: no real provider calls)`,
    );
    this.name = 'ProviderDisabledError';
    this.providerId = providerId;
    this.modelId = modelId;
  }
}
