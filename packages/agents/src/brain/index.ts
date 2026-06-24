/**
 * Cognitia Brain Harness V1 — public barrel.
 *
 * STATUS: MOCK / SANDBOX. Model-agnostic, governed model router. V1 is
 * mock-safe: the deterministic mock provider is the only executable provider;
 * OpenAI / Anthropic / DeepSeek / xAI / OpenRouter / local providers are
 * registered as metadata only and fail closed. No network, no vendor SDK, no
 * secrets. See `docs/architecture/cognitia-brain-harness.md`.
 *
 * Note: `assertNoRawPii` is intentionally NOT re-exported here — it is consumed
 * internally by the usage ledger and is already owned by the agents barrel.
 */
export * from './modelProvider.js';
export * from './modelPolicy.js';
export * from './taskRegistry.js';
export * from './modelRegistry.js';
export * from './modelUsageLedger.js';
export * from './modelRouter.js';
export * from './brainApi.js';

// Providers
export { createMockProvider, MOCK_MODEL_DESCRIPTOR } from './providers/mockProvider.js';
export { createDisabledProvider } from './providers/disabledProvider.js';
export { createLocalProvider, LOCAL_MODEL_DESCRIPTOR } from './providers/localProvider.disabled.js';
export {
  createOllamaProvider,
  OLLAMA_MODEL_DESCRIPTOR,
  OLLAMA_CONFIG_ENV_VARS,
} from './providers/ollamaProvider.disabled.js';
export {
  createOpenAiCompatibleLocalProvider,
  LOCAL_OPENAI_MODEL_DESCRIPTOR,
  LOCAL_OPENAI_CONFIG_ENV_VARS,
} from './providers/openAiCompatibleLocalProvider.disabled.js';
export {
  createOpenRouterProvider,
  OPENROUTER_MODEL_DESCRIPTOR,
} from './providers/openRouterProvider.disabled.js';
export {
  createOpenAiProvider,
  OPENAI_MODEL_DESCRIPTOR,
} from './providers/openaiProvider.disabled.js';
export {
  createAnthropicProvider,
  ANTHROPIC_MODEL_DESCRIPTOR,
} from './providers/anthropicProvider.disabled.js';
export {
  createDeepSeekProvider,
  DEEPSEEK_MODEL_DESCRIPTOR,
} from './providers/deepseekProvider.disabled.js';
export { createXaiProvider, XAI_MODEL_DESCRIPTOR } from './providers/xaiProvider.disabled.js';
