/**
 * Cognitia Brain Harness — OpenRouter provider (DISABLED in V1).
 *
 * STATUS: DISABLED / SCAFFOLD. This file intentionally contains NO vendor SDK
 * import, NO network call and NO secret read. `generate()` throws
 * {@link ProviderDisabledError}; the descriptor carries `enabled: false`. It
 * exists only to define the seam a future lane will implement.
 *
 * To enable later (see docs/architecture/cognitia-brain-harness.md):
 *  1. Rename this file to `openRouterProvider.ts`.
 *  2. Implement `generate()` against the OpenRouter HTTP API using `fetch`
 *     (base URL https://openrouter.ai/api/v1), reading `OPENROUTER_API_KEY`.
 *  3. Flip the registry entry `openrouter.enabled` to `true`.
 *  4. Add `openrouter` to a workspace `allowedProviders`/`fallbackChain` and set
 *     the workspace mode to `external-api` with `allowExternal: true`.
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

const DESCRIPTOR: ProviderDescriptor = PROVIDER_REGISTRY.openrouter!;

export class OpenRouterBrainProvider implements BrainProvider {
  readonly id = 'openrouter';
  readonly descriptor = DESCRIPTOR;

  /** Boolean-only readiness (env var present?). Never reads the value. */
  readiness(): Record<string, boolean> {
    return envReadiness(this.descriptor.envVarNames);
  }

  async generate(_request: BrainRequest): Promise<BrainResponse> {
    throw new ProviderDisabledError(this.id);
  }
}

export const openRouterBrainProvider = new OpenRouterBrainProvider();
