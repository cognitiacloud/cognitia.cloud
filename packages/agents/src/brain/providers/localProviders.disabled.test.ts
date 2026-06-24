import { describe, expect, it } from 'vitest';
import { createDefaultModelRegistry } from '../modelRegistry.js';
import { ProviderDisabledError } from '../modelProvider.js';
import {
  createOllamaProvider,
  OLLAMA_MODEL_DESCRIPTOR,
  OLLAMA_CONFIG_ENV_VARS,
} from './ollamaProvider.disabled.js';
import {
  createOpenAiCompatibleLocalProvider,
  LOCAL_OPENAI_MODEL_DESCRIPTOR,
  LOCAL_OPENAI_CONFIG_ENV_VARS,
} from './openAiCompatibleLocalProvider.disabled.js';

const LOCAL_REQUEST = { prompt: 'probe', taskType: 'prospect.research' } as const;

describe('local model providers (first-class, disabled in V1)', () => {
  it('both local descriptors are local, on-device, zero-cost and disabled', () => {
    for (const d of [OLLAMA_MODEL_DESCRIPTOR, LOCAL_OPENAI_MODEL_DESCRIPTOR]) {
      expect(d.location).toBe('local');
      expect(d.privacyTier).toBe('on_device');
      expect(d.mode).toBe('local_disabled');
      expect(d.costPer1kTokensUsd).toBe(0);
      expect(d.enabled).toBe(false);
    }
  });

  it('ollama generate() fails closed with ProviderDisabledError', async () => {
    const provider = createOllamaProvider();
    await expect(provider.generate(LOCAL_REQUEST)).rejects.toBeInstanceOf(ProviderDisabledError);
  });

  it('openai-compatible-local generate() fails closed with ProviderDisabledError', async () => {
    const provider = createOpenAiCompatibleLocalProvider();
    await expect(provider.generate(LOCAL_REQUEST)).rejects.toBeInstanceOf(ProviderDisabledError);
  });

  it('config env var lists carry NAMES only — no secret/value-shaped tokens', () => {
    const names = [...OLLAMA_CONFIG_ENV_VARS, ...LOCAL_OPENAI_CONFIG_ENV_VARS];
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      // Uppercase env-var NAME shape, never a value, never an http(s) URL.
      expect(name).toMatch(/^[A-Z][A-Z0-9_]+$/);
    }
  });

  it('the default registry includes both local models, none executable', () => {
    const registry = createDefaultModelRegistry();
    const ollama = registry.get('ollama', OLLAMA_MODEL_DESCRIPTOR.modelId);
    const localOpenai = registry.get('local-openai', LOCAL_OPENAI_MODEL_DESCRIPTOR.modelId);
    expect(ollama).toBeDefined();
    expect(localOpenai).toBeDefined();
    expect(registry.isExecutable('ollama', OLLAMA_MODEL_DESCRIPTOR.modelId)).toBe(false);
    expect(registry.isExecutable('local-openai', LOCAL_OPENAI_MODEL_DESCRIPTOR.modelId)).toBe(
      false,
    );

    // The only executable model remains the deterministic mock.
    const executable = registry.listEnabled();
    expect(executable).toHaveLength(1);
    expect(executable[0]?.providerId).toBe('mock');

    // Three disabled local models are now registered (generic + ollama + openai-compatible).
    // (The mock provider is also location:'local' but enabled, so filter it out.)
    const disabledLocal = registry.list().filter((d) => d.location === 'local' && !d.enabled);
    expect(disabledLocal.map((d) => d.providerId).sort()).toEqual([
      'local',
      'local-openai',
      'ollama',
    ]);
  });
});
