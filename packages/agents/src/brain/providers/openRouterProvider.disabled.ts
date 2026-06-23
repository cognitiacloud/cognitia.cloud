/**
 * OpenRouter provider — DISABLED in V1.
 *
 * STATUS: external_disabled. Aggregator front for many external models via an
 * OpenAI-compatible API, configured out-of-band via the `OPENROUTER_API_KEY`
 * env placeholder (documented only; NOT read in V1). No network/SDK/secret code
 * lives here — `generate` fails closed until explicitly enabled.
 */
import { createDisabledProvider } from './disabledProvider.js';
import type { ModelDescriptor, ModelProvider } from '../modelProvider.js';

export const OPENROUTER_MODEL_DESCRIPTOR: ModelDescriptor = {
  providerId: 'openrouter',
  modelId: 'auto',
  capabilities: ['text', 'reasoning', 'code', 'tool_call', 'structured_output', 'long_context'],
  contextWindow: 128_000,
  mode: 'external_disabled',
  location: 'external',
  costPer1kTokensUsd: 0.002,
  latencyTier: 'standard',
  privacyTier: 'public',
  toolCallSupport: true,
  structuredOutputSupport: true,
  enabled: false,
};

export function createOpenRouterProvider(): ModelProvider {
  return createDisabledProvider(OPENROUTER_MODEL_DESCRIPTOR);
}
