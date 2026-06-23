/**
 * Cognitia Brain Harness — Ollama / local provider (DISABLED in V1).
 *
 * STATUS: DISABLED / SCAFFOLD. No vendor SDK, no network call, no secret read.
 * `generate()` throws {@link ProviderDisabledError}; descriptor `enabled: false`.
 * Ollama is a `local` provider (no third-party egress), so once enabled it may
 * serve the most sensitive (`restricted`) data — but it stays off until then.
 *
 * To enable later:
 *  1. Rename this file to `ollamaProvider.ts`.
 *  2. Implement `generate()` against the local Ollama HTTP API using `fetch`
 *     (`${OLLAMA_BASE_URL}/api/generate`, default http://localhost:11434).
 *  3. Flip the registry entry `ollama.enabled` to `true`.
 *  4. Set the workspace mode to `local-only` (or `external-api`) and add
 *     `ollama` to `allowedProviders`/`fallbackChain`.
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

const DESCRIPTOR: ProviderDescriptor = PROVIDER_REGISTRY.ollama!;

export class OllamaBrainProvider implements BrainProvider {
  readonly id = 'ollama';
  readonly descriptor = DESCRIPTOR;

  /** Boolean-only readiness (is OLLAMA_BASE_URL set?). Never reads the value. */
  readiness(): Record<string, boolean> {
    return envReadiness(this.descriptor.envVarNames);
  }

  async generate(_request: BrainRequest): Promise<BrainResponse> {
    throw new ProviderDisabledError(this.id);
  }
}

export const ollamaBrainProvider = new OllamaBrainProvider();
