/**
 * Cognitia Brain Harness — xAI / Grok provider (DISABLED in V1).
 *
 * STATUS: DISABLED / SCAFFOLD. No vendor SDK, no network call, no secret read.
 * `generate()` throws {@link ProviderDisabledError}; descriptor `enabled: false`.
 *
 * To enable later:
 *  1. Rename this file to `xaiProvider.ts`.
 *  2. Implement `generate()` against the xAI HTTP API using `fetch`
 *     (https://api.x.ai/v1), reading `XAI_API_KEY`.
 *  3. Flip the registry entry `xai.enabled` to `true` and enable via an
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

const DESCRIPTOR: ProviderDescriptor = PROVIDER_REGISTRY.xai!;

export class XaiBrainProvider implements BrainProvider {
  readonly id = 'xai';
  readonly descriptor = DESCRIPTOR;

  readiness(): Record<string, boolean> {
    return envReadiness(this.descriptor.envVarNames);
  }

  async generate(_request: BrainRequest): Promise<BrainResponse> {
    throw new ProviderDisabledError(this.id);
  }
}

export const xaiBrainProvider = new XaiBrainProvider();
