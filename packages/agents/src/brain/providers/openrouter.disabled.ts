/**
 * OpenRouter provider — SCAFFOLDED BUT DISABLED.
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

export class OpenRouterBrainProvider implements BrainProvider {
  readonly descriptor: ProviderDescriptor = {
    id: 'openrouter',
    displayName: 'OpenRouter',
    enabled: false,
    requiresEnvKeys: ['OPENROUTER_API_KEY'],
    // OpenRouter is an aggregator; ids are provider-prefixed routes.
    models: [{ id: 'auto', family: 'openrouter', capabilities: ['text', 'json', 'routing'] }],
  };

  isEnabled(): boolean {
    return this.descriptor.enabled;
  }

  async generate(_req: BrainRequest): Promise<BrainResponse> {
    throw new ProviderDisabledError(this.descriptor.id);
  }
}

export const openRouterBrainProvider = new OpenRouterBrainProvider();
