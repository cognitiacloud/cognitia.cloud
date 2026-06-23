/**
 * Shared factory for DISABLED providers.
 *
 * STATUS: MOCK / SANDBOX. A disabled provider is registered for its metadata
 * only (capabilities, context window, cost/latency/privacy tiers, mode). Its
 * `generate` always throws {@link ProviderDisabledError} — it can never execute.
 * No network, no vendor SDK, no secret read. The real wiring for each provider
 * is documented in `docs/architecture/cognitia-brain-harness.md`, not coded here.
 */
import {
  ProviderDisabledError,
  type ModelDescriptor,
  type ModelProvider,
} from '../modelProvider.js';

/** Build an inert, fail-closed provider from a (disabled) descriptor. */
export function createDisabledProvider(descriptor: ModelDescriptor): ModelProvider {
  if (descriptor.enabled) {
    throw new Error(
      `brain: createDisabledProvider requires enabled:false (got ${descriptor.providerId}/${descriptor.modelId})`,
    );
  }
  return {
    descriptor,
    async generate(): Promise<never> {
      throw new ProviderDisabledError(descriptor.providerId, descriptor.modelId);
    },
  };
}
