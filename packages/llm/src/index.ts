import { env } from '@cognitia/config';
import { MockLlmProvider } from './providers/mock';
import { AnthropicLlmProvider } from './providers/anthropic';
import { OpenAiLlmProvider } from './providers/openai';
import type { LlmProvider } from './types';

export * from './types';
export { PROMPT_VERSIONS } from './prompts';
export { MockLlmProvider } from './providers/mock';

/** Resolve the active LLM provider. MOCK_MODE forces the deterministic mock. */
export function getLlm(): LlmProvider {
  if (env.MOCK_MODE || env.LLM_PROVIDER === 'mock') return new MockLlmProvider();
  if (env.LLM_PROVIDER === 'anthropic') return new AnthropicLlmProvider();
  if (env.LLM_PROVIDER === 'openai') return new OpenAiLlmProvider();
  return new MockLlmProvider();
}
