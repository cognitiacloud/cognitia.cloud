/**
 * Local Brain provider contract — shared types for self-hosted model endpoints.
 *
 * STATUS: MOCK / SANDBOX (V1 = DISABLED). This module defines the contract that
 * local/self-hosted model providers (Ollama, OpenAI-compatible local servers
 * such as vLLM / LM Studio / llama.cpp) implement so they are FIRST-CLASS from
 * day one. In V1 every local provider is hard-disabled: `generate()` always
 * throws `ProviderDisabledError`, and nothing in this layer performs any network
 * IO. There are intentionally NO fetch / http / socket / vendor-SDK imports here
 * (a source-scan test enforces this).
 *
 * Readiness reports CONFIG STATUS ONLY — booleans plus the NAMES of any missing
 * env vars. It never reads, returns, or logs an env var VALUE, and it never
 * probes the network. Enabling real local model egress is gated behind an
 * explicit "model egress release gate" (see docs/architecture/local-brain-runbook.md);
 * flipping `enabled` is a deliberate later-lane action, not a V1 capability.
 */

/** The kinds of local model endpoint this contract covers. */
export type LocalProviderKind = 'ollama' | 'openai-compatible-local';

/**
 * Readiness for a local provider. CONFIG STATUS ONLY — every field is a boolean
 * or a list of env var NAMES. No env var value ever appears here.
 */
export interface ReadinessStatus {
  /** Release-gate switch. False in V1 for every local provider (fail-closed). */
  enabled: boolean;
  /** True only if every required config env var is present (presence only). */
  configured: boolean;
  /** Convenience: `enabled && configured`. False whenever execution is blocked. */
  ready: boolean;
  /** NAMES of required env vars that are absent/empty. Never values. */
  missing: readonly string[];
}

/**
 * A request handed to a provider. Carries no raw PII and is never stored by this
 * layer; in V1 `generate()` throws before the request is used at all. When local
 * egress is later enabled, prompts/outputs must be HASHED into the action ledger
 * (see runbook) — never stored raw.
 */
export interface BrainGenerateRequest {
  /** The composed prompt/instruction for the model. */
  prompt: string;
  /** Optional model id override (else the provider's configured default). */
  model?: string;
  /** Optional sampling temperature. */
  temperature?: number;
}

/** A provider's generation result. Unreachable in V1 (generate always throws). */
export interface BrainGenerateResult {
  providerId: string;
  text: string;
}

/**
 * A first-class local model provider descriptor. Local providers are declared
 * here from day one but stay disabled in V1.
 */
export interface LocalBrainProviderDescriptor {
  /** Stable id, e.g. 'ollama-local'. */
  readonly id: string;
  /** Which local endpoint family this is. */
  readonly kind: LocalProviderKind;
  /** Human-readable label. */
  readonly label: string;
  /** Always true: these are self-hosted, never third-party cloud endpoints. */
  readonly local: true;
  /** Release-gate switch. ALWAYS false in V1. */
  readonly enabled: boolean;
  /** NAMES of env vars this provider reads for config. Never values. */
  readonly configEnvVars: readonly string[];
  /** Boolean config status only; never returns or logs an env var value. */
  readiness(env?: NodeJS.ProcessEnv): ReadinessStatus;
  /** ALWAYS throws ProviderDisabledError in V1. */
  generate(request: BrainGenerateRequest): Promise<BrainGenerateResult>;
}

/**
 * Thrown by every local provider's `generate()` in V1. Carries the provider id
 * and a stable machine code; carries no env values or secrets.
 */
export class ProviderDisabledError extends Error {
  readonly code = 'PROVIDER_DISABLED' as const;
  readonly providerId: string;

  constructor(providerId: string, detail?: string) {
    super(
      `Brain provider "${providerId}" is disabled in V1` +
        (detail
          ? `: ${detail}`
          : '. Real local model egress is gated behind the model egress release gate.'),
    );
    this.name = 'ProviderDisabledError';
    this.providerId = providerId;
  }
}

/**
 * Compute readiness from config-status inputs only. Checks env var PRESENCE
 * (non-empty string) — it never reads a value into the result and never logs.
 *
 * @param enabled - the provider's release-gate switch (false in V1).
 * @param requiredEnvVars - NAMES of env vars that must be present to be configured.
 * @param env - environment to inspect (defaults to process.env).
 */
export function readinessFor(
  enabled: boolean,
  requiredEnvVars: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): ReadinessStatus {
  const missing = requiredEnvVars.filter((name) => {
    const value = env[name];
    return typeof value !== 'string' || value.length === 0;
  });
  const configured = missing.length === 0;
  return {
    enabled,
    configured,
    ready: enabled && configured,
    missing,
  };
}

/** Provider-selection policy. `localOnly` restricts choices to local providers. */
export type BrainSelectionPolicy = 'localOnly' | 'preferLocal' | 'default';

/**
 * Select the providers permitted by a policy. Selection is independent of
 * `enabled` so local providers are future-ready: a `localOnly` deployment can
 * CHOOSE them today, but EXECUTING the chosen provider still throws in V1
 * because `generate()` is disabled. This is selection, not execution.
 */
export function selectProviders(
  policy: BrainSelectionPolicy,
  descriptors: readonly LocalBrainProviderDescriptor[],
): LocalBrainProviderDescriptor[] {
  if (policy === 'localOnly') {
    return descriptors.filter((d) => d.local === true);
  }
  // 'preferLocal' and 'default' both keep local providers available here; richer
  // ordering against cloud providers belongs to a later Brain Core lane.
  return [...descriptors];
}
