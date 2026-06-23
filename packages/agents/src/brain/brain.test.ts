import { describe, expect, it } from 'vitest';
import {
  ProviderDisabledError,
  hashBrainText,
  type BrainProvider,
  type BrainRequest,
} from './modelProvider.js';
import { createDefaultBrainRegistry } from './modelRegistry.js';
import { mockBrainProvider } from './providers/mockProvider.js';

const DISABLED_IDS = [
  'openai',
  'anthropic',
  'deepseek',
  'grok',
  'openrouter',
  'ollama',
  'cli',
] as const;

const sampleRequest: BrainRequest = {
  model: 'mock-deterministic-1',
  prompt: 'Summarize the lead in one line.',
  system: 'You are a deterministic test fixture.',
};

describe('mock provider (deterministic)', () => {
  it('produces identical output for identical input', async () => {
    const a = await mockBrainProvider.generate(sampleRequest);
    const b = await mockBrainProvider.generate(sampleRequest);
    expect(a).toEqual(b);
    expect(a.deterministic).toBe(true);
    expect(a.finishReason).toBe('stop');
    expect(a.providerId).toBe('mock');
  });

  it('produces different hashes for different prompts', async () => {
    const a = await mockBrainProvider.generate(sampleRequest);
    const b = await mockBrainProvider.generate({ ...sampleRequest, prompt: 'A different prompt.' });
    expect(a.promptHash).not.toBe(b.promptHash);
    expect(a.outputHash).not.toBe(b.outputHash);
    expect(a.content).not.toBe(b.content);
  });

  it('hashes are stable, fixed-width hex (no raw text leaks into ledgers)', async () => {
    const res = await mockBrainProvider.generate(sampleRequest);
    expect(res.promptHash).toMatch(/^[0-9a-f]{8}$/);
    expect(res.outputHash).toMatch(/^[0-9a-f]{8}$/);
    // hashBrainText is the pure helper used everywhere.
    expect(hashBrainText('x')).toBe(hashBrainText('x'));
    expect(hashBrainText('x')).not.toBe(hashBrainText('y'));
  });
});

describe('disabled providers', () => {
  const registry = createDefaultBrainRegistry();

  for (const id of DISABLED_IDS) {
    it(`"${id}" reports disabled and throws ProviderDisabledError on generate`, async () => {
      const provider = registry.get(id) as BrainProvider;
      expect(provider).toBeDefined();
      expect(provider.isEnabled()).toBe(false);
      await expect(
        provider.generate({ model: provider.descriptor.models[0]?.id ?? 'x', prompt: 'hi' }),
      ).rejects.toBeInstanceOf(ProviderDisabledError);
    });
  }
});

describe('registry listing', () => {
  const registry = createDefaultBrainRegistry();

  it('lists exactly the mock as enabled', () => {
    expect(registry.listEnabled().map((p) => p.descriptor.id)).toEqual(['mock']);
  });

  it('lists the seven scaffolds as disabled', () => {
    const disabled = registry
      .listDisabled()
      .map((p) => p.descriptor.id)
      .sort();
    expect(disabled).toEqual([...DISABLED_IDS].sort());
  });

  it('getEnabled returns the mock but throws for a disabled provider', () => {
    expect(registry.getEnabled('mock')).toBe(mockBrainProvider);
    expect(() => registry.getEnabled('openai')).toThrow(ProviderDisabledError);
    expect(() => registry.getEnabled('does-not-exist')).toThrow(/unknown brain provider/);
  });

  it('resolves models by provider + model id', () => {
    expect(registry.getModel('mock', 'mock-deterministic-1')?.family).toBe('mock');
    expect(registry.getModel('mock', 'nope')).toBeUndefined();
  });
});

describe('no secret values exposed', () => {
  const registry = createDefaultBrainRegistry();

  it('descriptors carry env-var NAMES only, never values', () => {
    for (const provider of registry.list()) {
      for (const key of provider.descriptor.requiresEnvKeys ?? []) {
        // Upper snake-case identifier — a NAME, not a secret value.
        expect(key).toMatch(/^[A-Z][A-Z0-9_]*$/);
        // A real key value would contain non-identifier characters / length.
        expect(key.length).toBeLessThan(40);
      }
    }
  });
});
