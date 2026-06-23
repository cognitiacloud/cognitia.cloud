/**
 * Local model provider — DISABLED in V1.
 *
 * STATUS: local_disabled. Designed for a local OpenAI-compatible endpoint
 * (Ollama / vLLM / LM Studio), configured out-of-band via the `OLLAMA_BASE_URL`
 * env placeholder (documented only; NOT read in V1). Runs on-device, so it
 * carries the highest privacy tier. No network/SDK/secret code lives here — the
 * `generate` path fails closed until explicitly enabled. See the architecture doc.
 */
import { createDisabledProvider } from './disabledProvider.js';
import type { ModelDescriptor, ModelProvider } from '../modelProvider.js';

export const LOCAL_MODEL_DESCRIPTOR: ModelDescriptor = {
  providerId: 'local',
  modelId: 'local-openai-compatible',
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

export function createLocalProvider(): ModelProvider {
  return createDisabledProvider(LOCAL_MODEL_DESCRIPTOR);
}
