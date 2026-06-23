/**
 * Brain Core Contracts — model-agnostic foundation.
 *
 * These interfaces let later lanes plug in real LLM providers (OpenAI,
 * Anthropic, DeepSeek, xAI/Grok, OpenRouter, Ollama/local, CLI) WITHOUT the
 * runtime ever depending on a concrete vendor. V1 ships a deterministic mock
 * provider only; every real provider is scaffolded but disabled and throws
 * `ProviderDisabledError` until a future lane enables it deliberately.
 *
 * Safety invariants enforced here and by the colocated source scan:
 *   - no network, no vendor SDK imports, no real provider execution
 *   - no secret VALUES — descriptors carry env-var NAMES only
 *   - prompts/outputs are referenced by hash (never persisted raw) so callers
 *     can write ledgers without storing PII
 */

/** A single model offered by a provider. No URLs, no secrets. */
export interface ModelDescriptor {
  /** Stable model id used in a `BrainRequest` (e.g. 'mock-deterministic-1'). */
  id: string;
  /** Coarse family/grouping for the model (e.g. 'mock', 'gpt', 'claude'). */
  family: string;
  /** Max input context window in tokens, when known. */
  contextWindow?: number;
  /** Max output tokens the model can emit, when known. */
  maxOutputTokens?: number;
  /** Free-form capability tags (e.g. 'text', 'json', 'tools', 'vision'). */
  capabilities: string[];
}

/**
 * Describes a provider's identity and the models it offers. `requiresEnvKeys`
 * lists environment-variable NAMES the provider would need to be enabled —
 * never values. A descriptor must never carry a secret or a URL.
 */
export interface ProviderDescriptor {
  /** Stable provider id (e.g. 'mock', 'openai', 'anthropic'). */
  id: string;
  /** Human-readable provider name. */
  displayName: string;
  /** Whether this provider may execute. Only the mock is enabled in V1. */
  enabled: boolean;
  /** Models this provider exposes. */
  models: ModelDescriptor[];
  /** Env-var NAMES (not values) a later lane must supply to enable this provider. */
  requiresEnvKeys?: string[];
}

/** A request to generate text from a model. */
export interface BrainRequest {
  /** Target model id; must belong to the provider being called. */
  model: string;
  /** The user/task prompt. */
  prompt: string;
  /** Optional system instruction. */
  system?: string;
  /** Optional cap on output tokens. */
  maxTokens?: number;
  /** Optional sampling temperature. Ignored by the deterministic mock. */
  temperature?: number;
  /** Optional non-PII metadata for tracing/routing. */
  metadata?: Record<string, unknown>;
}

/** Why generation stopped. */
export type BrainFinishReason = 'stop' | 'length' | 'disabled' | 'error';

/**
 * A generation result. `promptHash`/`outputHash` let callers record provenance
 * in ledgers WITHOUT persisting raw prompt/output text (no PII at rest).
 */
export interface BrainResponse {
  /** Provider that produced this response. */
  providerId: string;
  /** Model that produced this response. */
  model: string;
  /** The generated content. */
  content: string;
  /** Hash of the (system + prompt) input — for ledgers, never the raw text. */
  promptHash: string;
  /** Hash of the output content — for ledgers, never the raw text. */
  outputHash: string;
  /** Why generation stopped. */
  finishReason: BrainFinishReason;
  /** Approximate input token count, when known. */
  tokensIn?: number;
  /** Approximate output token count, when known. */
  tokensOut?: number;
  /** True when identical input is guaranteed to produce identical output. */
  deterministic: boolean;
}

/**
 * The contract every provider implements. The runtime depends only on this
 * interface — never on a concrete vendor. `generate` is async because real
 * implementations cross a network boundary; the mock resolves in-memory.
 */
export interface BrainProvider {
  /** Static description of this provider and its models. */
  readonly descriptor: ProviderDescriptor;
  /** Whether this provider may execute right now. */
  isEnabled(): boolean;
  /**
   * Produce a response for `req`. Disabled providers MUST throw
   * `ProviderDisabledError` rather than perform any IO.
   */
  generate(req: BrainRequest): Promise<BrainResponse>;
}

/**
 * Thrown when a scaffolded-but-disabled provider is asked to execute. Enabling
 * a provider is a deliberate future-lane action; until then this is the only
 * outcome of calling `generate` on it.
 */
export class ProviderDisabledError extends Error {
  constructor(providerId: string) {
    super(
      `brain provider "${providerId}" is disabled in V1 and cannot execute; ` +
        `it must be enabled deliberately in a later lane before use`,
    );
    this.name = 'ProviderDisabledError';
  }
}

/**
 * Pure, dependency-free deterministic hash (FNV-1a, 32-bit, hex). Used to
 * fingerprint prompts/outputs and to derive deterministic mock content. Kept
 * inline so brain code imports nothing — no `node:crypto`, no network — which
 * keeps the source scan clean. Not cryptographically secure; it is only a
 * stable, non-reversible reference for ledgers.
 */
export function hashBrainText(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    // 32-bit FNV prime multiply via shifts to stay in integer range.
    hash = Math.imul(hash, 0x01000193);
  }
  // Coerce to unsigned 32-bit and render as fixed-width hex.
  return (hash >>> 0).toString(16).padStart(8, '0');
}
