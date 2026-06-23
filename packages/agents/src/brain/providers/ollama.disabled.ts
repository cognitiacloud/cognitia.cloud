/**
 * Ollama / local provider — SCAFFOLDED BUT DISABLED.
 *
 * No SDK import, no network, no secret values. A local runtime still needs no
 * secret key, but it remains disabled until a later lane wires it deliberately.
 * `generate` throws `ProviderDisabledError`.
 */

import {
  ProviderDisabledError,
  type BrainProvider,
  type BrainRequest,
  type BrainResponse,
  type ProviderDescriptor,
} from '../modelProvider.js';

export class OllamaBrainProvider implements BrainProvider {
  readonly descriptor: ProviderDescriptor = {
    id: 'ollama',
    displayName: 'Ollama (local)',
    enabled: false,
    // Local daemon — no API key. A later lane may read a host NAME (not value)
    // such as OLLAMA_HOST when enabling.
    requiresEnvKeys: [],
    models: [
      { id: 'llama3', family: 'llama', capabilities: ['text', 'json'] },
      { id: 'qwen2', family: 'qwen', capabilities: ['text', 'json'] },
    ],
  };

  isEnabled(): boolean {
    return this.descriptor.enabled;
  }

  async generate(_req: BrainRequest): Promise<BrainResponse> {
    throw new ProviderDisabledError(this.descriptor.id);
  }
}

export const ollamaBrainProvider = new OllamaBrainProvider();
