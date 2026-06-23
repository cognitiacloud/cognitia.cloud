/**
 * DeepSeek provider — SCAFFOLDED BUT DISABLED.
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

export class DeepSeekBrainProvider implements BrainProvider {
  readonly descriptor: ProviderDescriptor = {
    id: 'deepseek',
    displayName: 'DeepSeek',
    enabled: false,
    requiresEnvKeys: ['DEEPSEEK_API_KEY'],
    models: [
      { id: 'deepseek-chat', family: 'deepseek', capabilities: ['text', 'json'] },
      { id: 'deepseek-reasoner', family: 'deepseek', capabilities: ['text', 'json', 'reasoning'] },
    ],
  };

  isEnabled(): boolean {
    return this.descriptor.enabled;
  }

  async generate(_req: BrainRequest): Promise<BrainResponse> {
    throw new ProviderDisabledError(this.descriptor.id);
  }
}

export const deepSeekBrainProvider = new DeepSeekBrainProvider();
