/**
 * Ollama local model provider — DISABLED in V1.
 *
 * STATUS: local_disabled. Describes a local Ollama endpoint as a first-class
 * model in the #206 registry, but it cannot run: built via `createDisabledProvider`,
 * so `generate` throws {@link ProviderDisabledError}. No network/SDK/secret code
 * lives here. The env var NAMES this provider would read are exported as
 * `OLLAMA_CONFIG_ENV_VARS` (names only, documented; NOT read in V1 — nothing
 * under `brain/` touches the environment). Runs on-device, so it carries the
 * highest privacy tier. Enabling real egress is a later-lane action behind the
 * model egress release gate — see the runbook.
 */
import { createDisabledProvider } from './disabledProvider.js';
import type { ModelDescriptor, ModelProvider } from '../modelProvider.js';

/** Env var NAMES the Ollama provider would read once enabled (never values). */
export const OLLAMA_CONFIG_ENV_VARS = ['OLLAMA_BASE_URL', 'OLLAMA_MODEL'] as const;

export const OLLAMA_MODEL_DESCRIPTOR: ModelDescriptor = {
  providerId: 'ollama',
  modelId: 'llama-3.1-8b-local',
  capabilities: ['text', 'reasoning', 'code', 'structured_output', 'long_context'],
  contextWindow: 32_000,
  mode: 'local_disabled',
  location: 'local',
  costPer1kTokensUsd: 0,
  latencyTier: 'standard',
  privacyTier: 'on_device',
  toolCallSupport: false,
  structuredOutputSupport: true,
  enabled: false,
};

export function createOllamaProvider(): ModelProvider {
  return createDisabledProvider(OLLAMA_MODEL_DESCRIPTOR);
}
