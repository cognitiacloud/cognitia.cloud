/**
 * OpenAI provider — SCAFFOLDED BUT DISABLED.
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

export class OpenAiBrainProvider implements BrainProvider {
  readonly descriptor: ProviderDescriptor = {
    id: 'openai',
    displayName: 'OpenAI',
    enabled: false,
    requiresEnvKeys: ['OPENAI_API_KEY'],
    models: [
      { id: 'gpt-4o', family: 'gpt', capabilities: ['text', 'json', 'tools', 'vision'] },
      { id: 'gpt-4o-mini', family: 'gpt', capabilities: ['text', 'json', 'tools'] },
    ],
  };

  isEnabled(): boolean {
    return this.descriptor.enabled;
  }

  async generate(_req: BrainRequest): Promise<BrainResponse> {
    throw new ProviderDisabledError(this.descriptor.id);
  }
}

export const openAiBrainProvider = new OpenAiBrainProvider();
