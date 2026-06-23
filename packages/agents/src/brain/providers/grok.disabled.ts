/**
 * xAI / Grok provider — SCAFFOLDED BUT DISABLED.
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

export class GrokBrainProvider implements BrainProvider {
  readonly descriptor: ProviderDescriptor = {
    id: 'grok',
    displayName: 'xAI Grok',
    enabled: false,
    requiresEnvKeys: ['XAI_API_KEY'],
    models: [
      { id: 'grok-4', family: 'grok', capabilities: ['text', 'json', 'tools'] },
      { id: 'grok-3-mini', family: 'grok', capabilities: ['text', 'json'] },
    ],
  };

  isEnabled(): boolean {
    return this.descriptor.enabled;
  }

  async generate(_req: BrainRequest): Promise<BrainResponse> {
    throw new ProviderDisabledError(this.descriptor.id);
  }
}

export const grokBrainProvider = new GrokBrainProvider();
