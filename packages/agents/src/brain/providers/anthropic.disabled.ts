/**
 * Anthropic provider — SCAFFOLDED BUT DISABLED.
 *
 * No SDK import, no network, no secret values. `generate` throws
 * `ProviderDisabledError`. A later lane enables this deliberately by wiring the
 * real client behind this same `BrainProvider` contract.
 */

import {
  ProviderDisabledError,
  type BrainProvider,
  type BrainRequest,
  type BrainResponse,
  type ProviderDescriptor,
} from '../modelProvider.js';

export class AnthropicBrainProvider implements BrainProvider {
  readonly descriptor: ProviderDescriptor = {
    id: 'anthropic',
    displayName: 'Anthropic',
    enabled: false,
    requiresEnvKeys: ['ANTHROPIC_API_KEY'],
    models: [
      { id: 'claude-opus-4', family: 'claude', capabilities: ['text', 'json', 'tools', 'vision'] },
      {
        id: 'claude-sonnet-4',
        family: 'claude',
        capabilities: ['text', 'json', 'tools', 'vision'],
      },
    ],
  };

  isEnabled(): boolean {
    return this.descriptor.enabled;
  }

  async generate(_req: BrainRequest): Promise<BrainResponse> {
    throw new ProviderDisabledError(this.descriptor.id);
  }
}

export const anthropicBrainProvider = new AnthropicBrainProvider();
