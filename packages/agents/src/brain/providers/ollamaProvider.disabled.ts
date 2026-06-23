/**
 * Ollama local model provider — DISABLED in V1.
 *
 * STATUS: MOCK / SANDBOX. Describes a local Ollama endpoint as a first-class
 * Brain provider, but it cannot run: `generate()` always throws
 * ProviderDisabledError and there is NO network IO here. Readiness reports
 * config status only (presence of env var NAMES) and never reads, returns, or
 * logs an env var value. Enabling real Ollama egress is a later-lane action
 * behind the model egress release gate (see docs/architecture/local-brain-runbook.md).
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

/** Env vars (NAMES only) the Ollama provider would read once enabled. */
export const OLLAMA_CONFIG_ENV_VARS = ['OLLAMA_BASE_URL', 'OLLAMA_MODEL'] as const;

/** Stable provider id. */
export const OLLAMA_PROVIDER_ID = 'ollama-local';

export const ollamaLocalProvider: LocalBrainProviderDescriptor = {
  id: OLLAMA_PROVIDER_ID,
  kind: 'ollama',
  label: 'Ollama (local)',
  local: true,
  // Hard kill switch for V1. Flipping this is gated by the model egress release gate.
  enabled: false,
  configEnvVars: OLLAMA_CONFIG_ENV_VARS,

  readiness(env?: NodeJS.ProcessEnv): ReadinessStatus {
    return readinessFor(this.enabled, this.configEnvVars, env);
  },

  async generate(_request: BrainGenerateRequest): Promise<BrainGenerateResult> {
    throw new ProviderDisabledError(OLLAMA_PROVIDER_ID);
  },
};
