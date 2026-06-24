/**
 * Cognitia Brain Harness V1 — model registry.
 *
 * STATUS: MOCK / SANDBOX. Holds the providers the harness knows about. In V1 the
 * mock provider is the only `enabled` one; the external/local providers are
 * registered for their metadata only and cannot execute (their `generate`
 * throws). The registry is deterministic and performs no IO.
 */
import { modelKey } from './modelPolicy.js';
import type { ModelDescriptor, ModelProvider } from './modelProvider.js';
import { createMockProvider } from './providers/mockProvider.js';
import { createLocalProvider } from './providers/localProvider.disabled.js';
import { createOllamaProvider } from './providers/ollamaProvider.disabled.js';
import { createOpenAiCompatibleLocalProvider } from './providers/openAiCompatibleLocalProvider.disabled.js';
import { createOpenRouterProvider } from './providers/openRouterProvider.disabled.js';
import { createOpenAiProvider } from './providers/openaiProvider.disabled.js';
import { createAnthropicProvider } from './providers/anthropicProvider.disabled.js';
import { createDeepSeekProvider } from './providers/deepseekProvider.disabled.js';
import { createXaiProvider } from './providers/xaiProvider.disabled.js';

export class ModelRegistry {
  private readonly providers = new Map<string, ModelProvider>();

  /** Register a provider (last write wins for a given provider/model key). */
  register(provider: ModelProvider): this {
    const { providerId, modelId } = provider.descriptor;
    this.providers.set(modelKey(providerId, modelId), provider);
    return this;
  }

  /** Look up a provider by ids, or `undefined` if not registered. */
  get(providerId: string, modelId: string): ModelProvider | undefined {
    return this.providers.get(modelKey(providerId, modelId));
  }

  /** True when the model is registered AND enabled (executable). */
  isExecutable(providerId: string, modelId: string): boolean {
    return this.get(providerId, modelId)?.descriptor.enabled ?? false;
  }

  /** All registered descriptors (enabled and disabled), in registration order. */
  list(): readonly ModelDescriptor[] {
    return [...this.providers.values()].map((p) => p.descriptor);
  }

  /** Only the executable (enabled) descriptors. */
  listEnabled(): readonly ModelDescriptor[] {
    return this.list().filter((d) => d.enabled);
  }

  listProviders(): readonly ModelProvider[] {
    return [...this.providers.values()];
  }
}

/**
 * Build the default V1 registry: the deterministic mock provider (enabled) plus
 * the eight disabled provider descriptors — three local (generic local /
 * Ollama / OpenAI-compatible-local) and five external (OpenRouter / OpenAI /
 * Anthropic / DeepSeek / xAI). Only the mock provider can execute.
 */
export function createDefaultModelRegistry(): ModelRegistry {
  return new ModelRegistry()
    .register(createMockProvider())
    .register(createLocalProvider())
    .register(createOllamaProvider())
    .register(createOpenAiCompatibleLocalProvider())
    .register(createOpenRouterProvider())
    .register(createOpenAiProvider())
    .register(createAnthropicProvider())
    .register(createDeepSeekProvider())
    .register(createXaiProvider());
}
