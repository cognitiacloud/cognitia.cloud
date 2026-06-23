import { describe, expect, it } from 'vitest';
import { evalModelRouterSuite, listModels, runTask, testProvider } from './brainApi.js';

describe('brainApi.listModels', () => {
  it('lists all seven registered models', () => {
    const models = listModels();
    expect(models).toHaveLength(7);
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

describe('brainApi.testProvider', () => {
  it('reports the mock provider as executable', () => {
    expect(testProvider('mock').executable).toBe(true);
  });
  it('reports disabled providers as registered but not executable', () => {
    const probe = testProvider('ollama');
    expect(probe.registered).toBe(false);
    expect(testProvider('openai')).toMatchObject({ registered: true, executable: false });
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
