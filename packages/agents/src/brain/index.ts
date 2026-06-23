/**
 * Cognitia Brain Harness V1 — public barrel.
 *
 * Model-agnostic task routing under policy, mock-safe by default. Only the mock
 * provider is enabled; every other provider ships disabled (see providers/*).
 * Self-contained: this module depends only on `node:crypto`, so it stays
 * portable and its compiled output is runnable by the `pnpm brain` CLI.
 */

export * from './taskRegistry.js';
export * from './brainPolicy.js';
export * from './brainRunLedger.js';
export * from './brainRouter.js';
export * from './brainEvalHarness.js';

// Provider contracts + the enabled mock provider.
export * from './providers/brainProvider.js';
export * from './providers/mockProvider.js';

// Disabled provider stubs are exported so callers (and tests) can prove they
// are disabled. They cannot execute — their generate() throws.
export {
  OpenRouterBrainProvider,
  openRouterBrainProvider,
} from './providers/openRouterProvider.disabled.js';
export { OllamaBrainProvider, ollamaBrainProvider } from './providers/ollamaProvider.disabled.js';
export { OpenAiBrainProvider, openAiBrainProvider } from './providers/openaiProvider.disabled.js';
export {
  AnthropicBrainProvider,
  anthropicBrainProvider,
} from './providers/anthropicProvider.disabled.js';
export {
  DeepSeekBrainProvider,
  deepSeekBrainProvider,
} from './providers/deepseekProvider.disabled.js';
export { XaiBrainProvider, xaiBrainProvider } from './providers/xaiProvider.disabled.js';
export { CliBrainProvider, cliBrainProvider } from './providers/cliProvider.disabled.js';
