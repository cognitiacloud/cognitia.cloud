/**
 * OpenAI-compatible local model provider — DISABLED in V1.
 *
 * STATUS: local_disabled. Describes a self-hosted, OpenAI-compatible chat
 * completions endpoint — covering vLLM, LM Studio, and the llama.cpp server — as
 * a first-class model in the #206 registry. It cannot run: built via
 * `createDisabledProvider`, so `generate` throws {@link ProviderDisabledError}.
 * No network/SDK/secret code lives here. Config is supplied out-of-band via the
 * `LOCAL_OPENAI_BASE_URL` / `LOCAL_OPENAI_MODEL` env placeholders (documented
 * only; NOT read in V1). A key is intentionally NOT required for readiness —
 * local servers commonly need none. Runs on-device → highest privacy tier.
 * Enabling real egress is a later-lane action behind the model egress release gate.
 */
import { createDisabledProvider } from './disabledProvider.js';
import type { ModelDescriptor, ModelProvider } from '../modelProvider.js';

/** Env var NAMES the OpenAI-compatible local provider would read (never values). */
export const LOCAL_OPENAI_CONFIG_ENV_VARS = [
  'LOCAL_OPENAI_BASE_URL',
  'LOCAL_OPENAI_MODEL',
] as const;

export const LOCAL_OPENAI_MODEL_DESCRIPTOR: ModelDescriptor = {
  providerId: 'local-openai',
  modelId: 'vllm-openai-compatible',
  capabilities: ['text', 'reasoning', 'code', 'tool_call', 'structured_output', 'long_context'],
  contextWindow: 32_000,
  mode: 'local_disabled',
  location: 'local',
  costPer1kTokensUsd: 0,
  latencyTier: 'standard',
  privacyTier: 'on_device',
  toolCallSupport: true,
  structuredOutputSupport: true,
  enabled: false,
};

export function createOpenAiCompatibleLocalProvider(): ModelProvider {
  return createDisabledProvider(LOCAL_OPENAI_MODEL_DESCRIPTOR);
}
