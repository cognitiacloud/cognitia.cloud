/**
 * OpenAI provider — DISABLED in V1.
 *
 * STATUS: external_disabled. Configured out-of-band via the `OPENAI_API_KEY` env
 * placeholder (documented only; NOT read in V1). No network/SDK/secret code lives
 * here — `generate` fails closed until explicitly enabled.
 */
import { createDisabledProvider } from './disabledProvider.js';
import type { ModelDescriptor, ModelProvider } from '../modelProvider.js';

export const OPENAI_MODEL_DESCRIPTOR: ModelDescriptor = {
  providerId: 'openai',
  modelId: 'gpt-mini',
  capabilities: [
    'text',
    'reasoning',
    'code',
    'tool_call',
    'structured_output',
    'vision',
    'long_context',
  ],
  contextWindow: 128_000,
  mode: 'external_disabled',
  location: 'external',
  costPer1kTokensUsd: 0.0006,
  latencyTier: 'fast',
  privacyTier: 'public',
  toolCallSupport: true,
  structuredOutputSupport: true,
  enabled: false,
};

export function createOpenAiProvider(): ModelProvider {
  return createDisabledProvider(OPENAI_MODEL_DESCRIPTOR);
}
