/**
 * CLI provider — SCAFFOLDED BUT DISABLED.
 *
 * Intended to drive a locally installed model CLI in a future lane. It performs
 * no process spawning here (no subprocess module), no network, no secret
 * values. `generate` throws `ProviderDisabledError`.
 */

import {
  ProviderDisabledError,
  type BrainProvider,
  type BrainRequest,
  type BrainResponse,
  type ProviderDescriptor,
} from '../modelProvider.js';

export class CliBrainProvider implements BrainProvider {
  readonly descriptor: ProviderDescriptor = {
    id: 'cli',
    displayName: 'Local CLI',
    enabled: false,
    // Driven by a local executable — no API key.
    requiresEnvKeys: [],
    models: [{ id: 'cli-default', family: 'cli', capabilities: ['text'] }],
  };

  isEnabled(): boolean {
    return this.descriptor.enabled;
  }

  async generate(_req: BrainRequest): Promise<BrainResponse> {
    throw new ProviderDisabledError(this.descriptor.id);
  }
}

export const cliBrainProvider = new CliBrainProvider();
