/**
 * Brain provider registry — model-agnostic lookup.
 *
 * Mirrors the propose-only `ToolRegistry` pattern (`../tools/registry.ts`): a
 * Map keyed by provider id with simple list/get accessors. The registry never
 * imports a vendor; it only holds `BrainProvider` instances.
 */

import {
  ProviderDisabledError,
  type BrainProvider,
  type ModelDescriptor,
} from './modelProvider.js';
import { mockBrainProvider } from './providers/mockProvider.js';
import { openAiBrainProvider } from './providers/openai.disabled.js';
import { anthropicBrainProvider } from './providers/anthropic.disabled.js';
import { deepSeekBrainProvider } from './providers/deepseek.disabled.js';
import { grokBrainProvider } from './providers/grok.disabled.js';
import { openRouterBrainProvider } from './providers/openrouter.disabled.js';
import { ollamaBrainProvider } from './providers/ollama.disabled.js';
import { cliBrainProvider } from './providers/cli.disabled.js';

export class ModelRegistry {
  private readonly providers = new Map<string, BrainProvider>();

  register(provider: BrainProvider): this {
    this.providers.set(provider.descriptor.id, provider);
    return this;
  }

  get(id: string): BrainProvider | undefined {
    return this.providers.get(id);
  }

  list(): BrainProvider[] {
    return [...this.providers.values()];
  }

  listEnabled(): BrainProvider[] {
    return this.list().filter((p) => p.isEnabled());
  }

  listDisabled(): BrainProvider[] {
    return this.list().filter((p) => !p.isEnabled());
  }

  /** Find a model by provider id + model id, when both exist. */
  getModel(providerId: string, modelId: string): ModelDescriptor | undefined {
    return this.get(providerId)?.descriptor.models.find((m) => m.id === modelId);
  }

  /**
   * Resolve a provider that is allowed to execute. Throws if the id is unknown,
   * or `ProviderDisabledError` if the provider exists but is disabled.
   */
  getEnabled(id: string): BrainProvider {
    const provider = this.providers.get(id);
    if (!provider) throw new Error(`unknown brain provider: ${id}`);
    if (!provider.isEnabled()) throw new ProviderDisabledError(id);
    return provider;
  }
}

/**
 * Build the default registry: the deterministic mock (enabled) plus every real
 * provider scaffolded as disabled. `listEnabled()` returns `[mock]`;
 * `listDisabled()` returns the seven vendor/local/CLI scaffolds.
 */
export function createDefaultBrainRegistry(): ModelRegistry {
  return new ModelRegistry()
    .register(mockBrainProvider)
    .register(openAiBrainProvider)
    .register(anthropicBrainProvider)
    .register(deepSeekBrainProvider)
    .register(grokBrainProvider)
    .register(openRouterBrainProvider)
    .register(ollamaBrainProvider)
    .register(cliBrainProvider);
}
