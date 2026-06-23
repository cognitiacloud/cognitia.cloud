/**
 * Cognitia Brain Harness — DeepSeek provider (DISABLED in V1).
 *
 * STATUS: DISABLED / SCAFFOLD. No vendor SDK, no network call, no secret read.
 * `generate()` throws {@link ProviderDisabledError}; descriptor `enabled: false`.
 *
 * To enable later:
 *  1. Rename this file to `deepseekProvider.ts`.
 *  2. Implement `generate()` against the DeepSeek HTTP API using `fetch`
 *     (https://api.deepseek.com), reading `DEEPSEEK_API_KEY`.
 *  3. Flip the registry entry `deepseek.enabled` to `true` and enable via an
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

const DESCRIPTOR: ProviderDescriptor = PROVIDER_REGISTRY.deepseek!;

export class DeepSeekBrainProvider implements BrainProvider {
  readonly id = 'deepseek';
  readonly descriptor = DESCRIPTOR;

  readiness(): Record<string, boolean> {
    return envReadiness(this.descriptor.envVarNames);
  }

  async generate(_request: BrainRequest): Promise<BrainResponse> {
    throw new ProviderDisabledError(this.id);
  }
}

export const deepSeekBrainProvider = new DeepSeekBrainProvider();
