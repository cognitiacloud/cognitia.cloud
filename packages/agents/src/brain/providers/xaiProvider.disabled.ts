/**
 * xAI (Grok) provider — DISABLED in V1.
 *
 * STATUS: external_disabled. Configured out-of-band via the `XAI_API_KEY` env
 * placeholder (documented only; NOT read in V1). No network/SDK/secret code lives
 * here — `generate` fails closed until explicitly enabled.
 */
import { createDisabledProvider } from './disabledProvider.js';
import type { ModelDescriptor, ModelProvider } from '../modelProvider.js';

export const XAI_MODEL_DESCRIPTOR: ModelDescriptor = {
  providerId: 'xai',
  modelId: 'grok-mini',
  capabilities: ['text', 'reasoning', 'code', 'tool_call', 'structured_output', 'long_context'],
  contextWindow: 128_000,
  mode: 'external_disabled',
  location: 'external',
  costPer1kTokensUsd: 0.0005,
  latencyTier: 'standard',
  privacyTier: 'public',
  toolCallSupport: true,
  structuredOutputSupport: true,
  enabled: false,
};

export function createXaiProvider(): ModelProvider {
  return createDisabledProvider(XAI_MODEL_DESCRIPTOR);
}
