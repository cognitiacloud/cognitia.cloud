/**
 * DeepSeek provider — DISABLED in V1.
 *
 * STATUS: external_disabled. Configured out-of-band via the `DEEPSEEK_API_KEY`
 * env placeholder (documented only; NOT read in V1). No network/SDK/secret code
 * lives here — `generate` fails closed until explicitly enabled.
 */
import { createDisabledProvider } from './disabledProvider.js';
import type { ModelDescriptor, ModelProvider } from '../modelProvider.js';

export const DEEPSEEK_MODEL_DESCRIPTOR: ModelDescriptor = {
  providerId: 'deepseek',
  modelId: 'deepseek-chat',
  capabilities: ['text', 'reasoning', 'code', 'tool_call', 'structured_output', 'long_context'],
  contextWindow: 64_000,
  mode: 'external_disabled',
  location: 'external',
  costPer1kTokensUsd: 0.0003,
  latencyTier: 'standard',
  privacyTier: 'public',
  toolCallSupport: true,
  structuredOutputSupport: true,
  enabled: false,
};

export function createDeepSeekProvider(): ModelProvider {
  return createDisabledProvider(DEEPSEEK_MODEL_DESCRIPTOR);
}
