/**
 * Anthropic provider — DISABLED in V1.
 *
 * STATUS: external_disabled. Configured out-of-band via the `ANTHROPIC_API_KEY`
 * env placeholder (documented only; NOT read in V1). No network/SDK/secret code
 * lives here — `generate` fails closed until explicitly enabled.
 */
import { createDisabledProvider } from './disabledProvider.js';
import type { ModelDescriptor, ModelProvider } from '../modelProvider.js';

export const ANTHROPIC_MODEL_DESCRIPTOR: ModelDescriptor = {
  providerId: 'anthropic',
  modelId: 'claude-mini',
  capabilities: [
    'text',
    'reasoning',
    'code',
    'tool_call',
    'structured_output',
    'vision',
    'long_context',
  ],
  contextWindow: 200_000,
  mode: 'external_disabled',
  location: 'external',
  costPer1kTokensUsd: 0.0008,
  latencyTier: 'standard',
  privacyTier: 'public',
  toolCallSupport: true,
  structuredOutputSupport: true,
  enabled: false,
};

export function createAnthropicProvider(): ModelProvider {
  return createDisabledProvider(ANTHROPIC_MODEL_DESCRIPTOR);
}
