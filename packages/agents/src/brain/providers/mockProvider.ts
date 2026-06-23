/**
 * Cognitia Brain Harness V1 — deterministic mock provider (the ONLY executable
 * provider in V1).
 *
 * STATUS: MOCK / SANDBOX. Pure and deterministic: identical inputs always yield
 * identical output. Makes NO network call, imports NO vendor SDK, reads NO
 * secret. The output is a stable, content-derived token so tests and proof
 * receipts are reproducible.
 */
import { estimateTokens, sha256Hex } from '../hash.js';
import {
  type GenerateRequest,
  type GenerateResult,
  type ModelDescriptor,
  type ModelProvider,
} from '../modelProvider.js';

/** Descriptor for the built-in deterministic mock model. */
export const MOCK_MODEL_DESCRIPTOR: ModelDescriptor = {
  providerId: 'mock',
  modelId: 'mock-deterministic-1',
  capabilities: ['text', 'reasoning', 'code', 'tool_call', 'structured_output', 'long_context'],
  contextWindow: 128_000,
  mode: 'mock',
  location: 'local',
  costPer1kTokensUsd: 0,
  latencyTier: 'fast',
  // Deterministic local stub — safe for any data classification.
  privacyTier: 'on_device',
  toolCallSupport: true,
  structuredOutputSupport: true,
  enabled: true,
};

class MockProvider implements ModelProvider {
  readonly descriptor: ModelDescriptor;

  constructor(descriptor: ModelDescriptor) {
    this.descriptor = descriptor;
  }

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    const basis = `${this.descriptor.modelId} ${request.system ?? ''} ${request.prompt}`;
    const digest = sha256Hex(basis);
    const short = digest.slice(0, 16);
    const output = `mock:${this.descriptor.providerId}:${this.descriptor.modelId}:${short}`;

    const wantsTools = (request.tools?.length ?? 0) > 0;
    const structuredOutput = request.structured
      ? { provider: this.descriptor.providerId, taskType: request.taskType, digest: short }
      : undefined;

    return {
      output,
      tokensIn: estimateTokens(`${request.system ?? ''}${request.prompt}`),
      tokensOut: estimateTokens(output),
      finishReason: wantsTools ? 'tool_call' : 'stop',
      structuredOutput,
    };
  }
}

/** Create the deterministic mock provider (optionally overriding its descriptor). */
export function createMockProvider(
  descriptor: ModelDescriptor = MOCK_MODEL_DESCRIPTOR,
): ModelProvider {
  return new MockProvider(descriptor);
}
