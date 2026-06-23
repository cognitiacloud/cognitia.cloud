/**
 * Cognitia Brain Harness — Anthropic provider (DISABLED in V1).
 *
 * STATUS: DISABLED / SCAFFOLD. No vendor SDK, no network call, no secret read.
 * `generate()` throws {@link ProviderDisabledError}; descriptor `enabled: false`.
 *
 * To enable later:
 *  1. Rename this file to `anthropicProvider.ts`.
 *  2. Implement `generate()` against the Anthropic Messages API using `fetch`
 *     (https://api.anthropic.com/v1/messages), reading `ANTHROPIC_API_KEY`.
 *  3. Flip the registry entry `anthropic.enabled` to `true` and enable via an
 *     `external-api` workspace policy.
 */

import { PROVIDER_REGISTRY } from '../brainPolicy.js';
import {
  ProviderDisabledError,
  envReadiness,
  type BrainProvider,
  type BrainRequest,
  type BrainResponse,
  type ProviderDescriptor,
} from './brainProvider.js';

const DESCRIPTOR: ProviderDescriptor = PROVIDER_REGISTRY.anthropic!;

export class AnthropicBrainProvider implements BrainProvider {
  readonly id = 'anthropic';
  readonly descriptor = DESCRIPTOR;

  readiness(): Record<string, boolean> {
    return envReadiness(this.descriptor.envVarNames);
  }

  async generate(_request: BrainRequest): Promise<BrainResponse> {
    throw new ProviderDisabledError(this.id);
  }
}

export const anthropicBrainProvider = new AnthropicBrainProvider();
