/**
 * OpenAI-compatible local model provider — DISABLED in V1.
 *
 * STATUS: MOCK / SANDBOX. Describes a self-hosted, OpenAI-compatible chat
 * completions endpoint — covering vLLM, LM Studio, and the llama.cpp server —
 * as a first-class Brain provider. It cannot run: `generate()` always throws
 * ProviderDisabledError and there is NO network IO here (no vendor SDK, no
 * fetch, no sockets). Readiness reports config status only (presence of env var
 * NAMES) and never reads, returns, or logs an env var value. Enabling real
 * egress is a later-lane action behind the model egress release gate
 * (see docs/architecture/local-brain-runbook.md).
 *
 * This file is named `.disabled.ts` to signal it is non-runtime in V1; it is
 * intentionally NOT exported from the package index.
 */

import {
  ProviderDisabledError,
  readinessFor,
  type BrainGenerateRequest,
  type BrainGenerateResult,
  type LocalBrainProviderDescriptor,
  type ReadinessStatus,
} from './localProviderContract.js';

/**
 * Env vars (NAMES only) the OpenAI-compatible local provider would read once
 * enabled. The base URL points at a self-hosted server (vLLM / LM Studio /
 * llama.cpp). An API key is intentionally NOT required for readiness — local
 * servers commonly need none, and its value would never be read here.
 */
export const LOCAL_OPENAI_CONFIG_ENV_VARS = [
  'LOCAL_OPENAI_BASE_URL',
  'LOCAL_OPENAI_MODEL',
] as const;

/** Stable provider id. */
export const LOCAL_OPENAI_PROVIDER_ID = 'openai-compatible-local';

export const openAiCompatibleLocalProvider: LocalBrainProviderDescriptor = {
  id: LOCAL_OPENAI_PROVIDER_ID,
  kind: 'openai-compatible-local',
  label: 'OpenAI-compatible local (vLLM / LM Studio / llama.cpp)',
  local: true,
  // Hard kill switch for V1. Flipping this is gated by the model egress release gate.
  enabled: false,
  configEnvVars: LOCAL_OPENAI_CONFIG_ENV_VARS,

  readiness(env?: NodeJS.ProcessEnv): ReadinessStatus {
    return readinessFor(this.enabled, this.configEnvVars, env);
  },

  async generate(_request: BrainGenerateRequest): Promise<BrainGenerateResult> {
    throw new ProviderDisabledError(LOCAL_OPENAI_PROVIDER_ID);
  },
};
