import { describe, expect, it } from 'vitest';
import { evalModelRouterSuite, listModels, runTask, testProvider } from './brainApi.js';
import type { ModelDescriptor, ModelProvider } from './modelProvider.js';
import { createDefaultModelRegistry } from './modelRegistry.js';

describe('brainApi.listModels', () => {
  it('lists all nine registered models', () => {
    const models = listModels();
    expect(models).toHaveLength(9);
    expect(models.filter((m) => m.enabled)).toHaveLength(1);
  });
});

describe('brainApi.runTask', () => {
  it('routes a default task to the mock provider and returns a receipt', async () => {
    const result = await runTask({
      workspaceId: 'ws_demo',
      taskType: 'prospect.research',
      prompt: 'research the account',
    });
    expect(result.ok).toBe(true);
    expect(result.receipt.provider).toBe('mock');
    expect(result.output).toMatch(/^mock:mock:/);
  });
});

describe('brainApi.runTask — programmatic injection cannot enable real providers', () => {
  it('blocks an injected enabled non-mock provider and never executes it', async () => {
    let called = false;
    const descriptor: ModelDescriptor = {
      providerId: 'fake',
      modelId: 'fake-1',
      capabilities: ['text', 'reasoning'],
      contextWindow: 1000,
      mode: 'external_disabled',
      location: 'local',
      costPer1kTokensUsd: 0,
      latencyTier: 'fast',
      privacyTier: 'on_device',
      toolCallSupport: false,
      structuredOutputSupport: false,
      enabled: true,
    };
    const fake: ModelProvider = {
      descriptor,
      async generate() {
        called = true;
        throw new Error('injected non-mock provider must never execute in V1');
      },
    };
    const registry = createDefaultModelRegistry().register(fake);
    const result = await runTask({
      workspaceId: 'ws_demo',
      taskType: 'prospect.research',
      prompt: 'x',
      registry,
      preferredModel: { providerId: 'fake', modelId: 'fake-1' },
      policy: {
        allowedProviders: ['fake'],
        localOnly: false,
        costCeilingPer1kUsd: 1000,
        maxLatencyTier: 'slow',
      },
    });
    expect(result.ok).toBe(false);
    expect(result.blockedReason).toBe('v1_mock_only');
    expect(called).toBe(false);
  });
});

describe('brainApi.testProvider', () => {
  it('reports the mock provider as executable', () => {
    expect(testProvider('mock').executable).toBe(true);
  });
  it('reports an unregistered provider as not registered', () => {
    const probe = testProvider('does-not-exist');
    expect(probe.registered).toBe(false);
    expect(probe.executable).toBe(false);
  });
  it('reports disabled providers (incl. local) as registered but not executable', () => {
    expect(testProvider('openai')).toMatchObject({ registered: true, executable: false });
    expect(testProvider('ollama')).toMatchObject({ registered: true, executable: false });
    expect(testProvider('local-openai')).toMatchObject({ registered: true, executable: false });
  });
});

describe('brainApi.evalModelRouterSuite', () => {
  it('runs the default suite to a perfect score (deterministic + expected outcomes)', async () => {
    const report = await evalModelRouterSuite();
    expect(report.total).toBeGreaterThan(0);
    expect(report.score).toBe(100);
    expect(report.cases.every((c) => c.deterministic)).toBe(true);
  });
});
