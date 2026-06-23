/**
 * Cognitia Brain Harness — OpenAI provider (DISABLED in V1).
 *
 * STATUS: DISABLED / SCAFFOLD. No vendor SDK, no network call, no secret read.
 * `generate()` throws {@link ProviderDisabledError}; descriptor `enabled: false`.
 *
 * To enable later:
 *  1. Rename this file to `openaiProvider.ts`.
 *  2. Implement `generate()` against the OpenAI HTTP API using `fetch`
 *     (https://api.openai.com/v1), reading `OPENAI_API_KEY`. (Prefer `fetch`
 *     over the SDK to keep the dependency surface minimal.)
 *  3. Flip the registry entry `openai.enabled` to `true` and enable via an
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

const DESCRIPTOR: ProviderDescriptor = PROVIDER_REGISTRY.openai!;

export class OpenAiBrainProvider implements BrainProvider {
  readonly id = 'openai';
  readonly descriptor = DESCRIPTOR;

  readiness(): Record<string, boolean> {
    return envReadiness(this.descriptor.envVarNames);
  }

  async generate(_request: BrainRequest): Promise<BrainResponse> {
    throw new ProviderDisabledError(this.id);
  }
}

export const openAiBrainProvider = new OpenAiBrainProvider();
