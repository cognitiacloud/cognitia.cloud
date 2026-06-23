/**
 * Mock brain provider — the only ENABLED provider in V1.
 *
 * Pure and deterministic: identical input always yields identical output, with
 * no IO, no randomness, and no clock reads. It exists so the rest of the system
 * can be built and tested end-to-end without any real model call.
 */

import {
  hashBrainText,
  type BrainProvider,
  type BrainRequest,
  type BrainResponse,
  type ModelDescriptor,
  type ProviderDescriptor,
} from '../modelProvider.js';

const MOCK_MODEL: ModelDescriptor = {
  id: 'mock-deterministic-1',
  family: 'mock',
  contextWindow: 8192,
  maxOutputTokens: 1024,
  capabilities: ['text', 'json', 'deterministic'],
};

/** Rough token estimate (~4 chars/token); deterministic, for accounting only. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export class MockBrainProvider implements BrainProvider {
  readonly descriptor: ProviderDescriptor = {
    id: 'mock',
    displayName: 'Mock (deterministic)',
    enabled: true,
    models: [MOCK_MODEL],
    // No keys required — the mock performs no IO.
    requiresEnvKeys: [],
  };

  isEnabled(): boolean {
    return this.descriptor.enabled;
  }

  async generate(req: BrainRequest): Promise<BrainResponse> {
    const promptInput = `${req.system ?? ''}\n${req.prompt}`;
    const promptHash = hashBrainText(promptInput);
    // Content is a stable function of model + input; same input → same output.
    const content = `mock:${req.model}:${promptHash}`;
    const outputHash = hashBrainText(content);

    return {
      providerId: this.descriptor.id,
      model: req.model,
      content,
      promptHash,
      outputHash,
      finishReason: 'stop',
      tokensIn: estimateTokens(promptInput),
      tokensOut: estimateTokens(content),
      deterministic: true,
    };
  }
}

/** Shared singleton registered by `createDefaultBrainRegistry`. */
export const mockBrainProvider = new MockBrainProvider();
