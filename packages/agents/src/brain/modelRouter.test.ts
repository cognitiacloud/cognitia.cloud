import { describe, expect, it } from 'vitest';
import { defaultLocalOnlyPolicy, type WorkspaceModelPolicy } from './modelPolicy.js';
import type { ModelCapability } from './modelProvider.js';
import { ProviderDisabledError } from './modelProvider.js';
import { createDefaultModelRegistry } from './modelRegistry.js';
import { ModelRouter, type ModelRef, type RouteInput } from './modelRouter.js';
import { ModelUsageLedger } from './modelUsageLedger.js';
import { createMockProvider } from './providers/mockProvider.js';
import { createOpenAiProvider } from './providers/openaiProvider.disabled.js';
import { TaskRegistry } from './taskRegistry.js';

const FIXED_NOW = () => new Date('2026-01-01T00:00:00.000Z');
const MOCK_REF: ModelRef = { providerId: 'mock', modelId: 'mock-deterministic-1' };

function makeRouter() {
  const registry = createDefaultModelRegistry();
  const ledger = new ModelUsageLedger();
  const router = new ModelRouter({ registry, ledger, now: FIXED_NOW });
  return { registry, ledger, router };
}

function baseInput(overrides: Partial<RouteInput> = {}): RouteInput {
  return {
    workspaceId: 'ws_demo',
    taskType: 'prospect.research',
    request: { prompt: 'summarize the public profile', taskType: 'prospect.research' },
    policy: defaultLocalOnlyPolicy(),
    preferredModel: MOCK_REF,
    ...overrides,
  };
}

describe('ModelRouter — mock provider', () => {
  it('is deterministic: identical inputs produce identical output + hashes', async () => {
    const a = makeRouter();
    const b = makeRouter();
    const ra = await a.router.route(baseInput());
    const rb = await b.router.route(baseInput());

    expect(ra.ok).toBe(true);
    expect(ra.output).toBe(rb.output);
    expect(ra.receipt.inputHash).toBe(rb.receipt.inputHash);
    expect(ra.receipt.outputHash).toBe(rb.receipt.outputHash);
    expect(ra.receipt.outputHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('records an allow receipt in the ledger', async () => {
    const { router, ledger } = makeRouter();
    const result = await router.route(baseInput());
    expect(result.ok).toBe(true);
    expect(ledger.size).toBe(1);
    const receipt = ledger.list()[0]!;
    expect(receipt.policyDecision).toBe('allow');
    expect(receipt.provider).toBe('mock');
    expect(receipt.mode).toBe('mock');
    expect(receipt.blockedReason).toBeNull();
  });
});

describe('ModelRouter — fallback', () => {
  it('falls back past a disabled preferred model to the mock provider', async () => {
    const { router } = makeRouter();
    const result = await router.route(
      baseInput({
        // Allow openai by policy so it is not policy-blocked — it should still be
        // skipped because it is a disabled provider, then fall through to mock.
        policy: {
          ...defaultLocalOnlyPolicy(),
          allowedProviders: ['mock', 'openai'],
          localOnly: false,
        },
        preferredModel: { providerId: 'openai', modelId: 'gpt-mini' },
        fallbackChain: [MOCK_REF],
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.selected).toEqual(MOCK_REF);
    expect(result.fallbackUsed).toBe(true);
    expect(result.receipt.fallbackUsed).toBe(true);
  });

  it('does not mark fallback when the preferred model serves directly', async () => {
    const { router } = makeRouter();
    const result = await router.route(baseInput());
    expect(result.ok).toBe(true);
    expect(result.fallbackUsed).toBe(false);
  });
});

describe('ModelRouter — policy blocks', () => {
  it('blocks a disallowed model (not in allowedProviders)', async () => {
    const { router } = makeRouter();
    const policy: WorkspaceModelPolicy = { ...defaultLocalOnlyPolicy(), allowedProviders: [] };
    const result = await router.route(baseInput({ policy }));
    expect(result.ok).toBe(false);
    expect(result.blockedReason).toBe('provider_not_allowed');
    expect(result.receipt.policyDecision).toBe('blocked');
  });

  it('blocks when cost ceiling is exceeded', async () => {
    const { router } = makeRouter();
    // mock costs 0, so make an enabled costed model and route to it.
    const registry = createDefaultModelRegistry();
    registry.register(
      createMockProvider({
        providerId: 'mock',
        modelId: 'mock-costed',
        capabilities: ['text', 'reasoning'],
        contextWindow: 1000,
        mode: 'mock',
        location: 'local',
        costPer1kTokensUsd: 5,
        latencyTier: 'fast',
        privacyTier: 'on_device',
        toolCallSupport: false,
        structuredOutputSupport: false,
        enabled: true,
      }),
    );
    const ledger = new ModelUsageLedger();
    const costed = new ModelRouter({ registry, ledger, now: FIXED_NOW });
    const result = await costed.route(
      baseInput({
        policy: { ...defaultLocalOnlyPolicy(), costCeilingPer1kUsd: 1 },
        preferredModel: { providerId: 'mock', modelId: 'mock-costed' },
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.blockedReason).toBe('cost_ceiling_exceeded');
  });

  it('local-only policy blocks an external provider', async () => {
    const { router } = makeRouter();
    const result = await router.route(
      baseInput({
        policy: {
          ...defaultLocalOnlyPolicy(),
          allowedProviders: ['mock', 'openai'],
          localOnly: true,
        },
        preferredModel: { providerId: 'openai', modelId: 'gpt-mini' },
      }),
    );
    expect(result.ok).toBe(false);
    // external + disabled: disabled is checked first → provider_disabled.
    // Use an enabled external to prove local-only specifically.
    expect(['local_only_policy', 'provider_disabled']).toContain(result.blockedReason);
  });

  it('local-only blocks an ENABLED external model with local_only_policy', async () => {
    const registry = createDefaultModelRegistry();
    registry.register(
      createMockProvider({
        providerId: 'openai',
        modelId: 'gpt-enabled',
        capabilities: ['text', 'reasoning'],
        contextWindow: 1000,
        mode: 'external_disabled',
        location: 'external',
        costPer1kTokensUsd: 0,
        latencyTier: 'fast',
        privacyTier: 'public',
        toolCallSupport: false,
        structuredOutputSupport: false,
        enabled: true,
      }),
    );
    const router = new ModelRouter({ registry, ledger: new ModelUsageLedger(), now: FIXED_NOW });
    const result = await router.route(
      baseInput({
        policy: { ...defaultLocalOnlyPolicy(), allowedProviders: ['openai'], localOnly: true },
        preferredModel: { providerId: 'openai', modelId: 'gpt-enabled' },
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.blockedReason).toBe('local_only_policy');
  });

  it('blocks on capability mismatch', async () => {
    const { router } = makeRouter();
    const tasks = new TaskRegistry([
      {
        taskType: 'needs.vision',
        requiredCapabilities: ['vision'] as ModelCapability[],
        riskTier: 'low',
        dataClassification: 'internal',
      },
    ]);
    const registry = createDefaultModelRegistry();
    const router2 = new ModelRouter({
      registry,
      ledger: new ModelUsageLedger(),
      taskRegistry: tasks,
      now: FIXED_NOW,
    });
    const result = await router2.route(
      baseInput({
        taskType: 'needs.vision',
        request: { prompt: 'look', taskType: 'needs.vision' },
        preferredModel: MOCK_REF,
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.blockedReason).toMatch(/^capability_mismatch:/);
    // Avoid unused-var lint on the first router.
    expect(router).toBeDefined();
  });
});

describe('ModelRouter — high-risk approval gate', () => {
  const confidentialPolicy: WorkspaceModelPolicy = {
    ...defaultLocalOnlyPolicy(),
    allowedDataClassifications: ['confidential'],
  };

  it('blocks a high-risk task without approval', async () => {
    const { router } = makeRouter();
    const result = await router.route(
      baseInput({
        taskType: 'outreach.draft',
        request: { prompt: 'draft', taskType: 'outreach.draft', structured: true },
        policy: confidentialPolicy,
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.blockedReason).toBe('high_risk_requires_approval');
  });

  it('allows a high-risk task when approval is granted', async () => {
    const { router } = makeRouter();
    const result = await router.route(
      baseInput({
        taskType: 'outreach.draft',
        request: { prompt: 'draft', taskType: 'outreach.draft', structured: true },
        policy: confidentialPolicy,
        approvalGranted: true,
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.structuredOutput).toBeDefined();
  });
});

describe('ModelRouter — privacy / receipt safety', () => {
  it('never stores the raw prompt — only hashes', async () => {
    const { router, ledger } = makeRouter();
    const secret = 'highly-specific-prompt-text-12345';
    await router.route(baseInput({ request: { prompt: secret, taskType: 'prospect.research' } }));
    const serialized = JSON.stringify(ledger.list());
    expect(serialized).not.toContain(secret);
    expect(serialized).not.toContain('mock:mock:'); // raw output also absent
  });

  it('rejects raw PII reaching a receipt field', async () => {
    const { router } = makeRouter();
    await expect(router.route(baseInput({ taskType: 'real.person@gmail.com' }))).rejects.toThrow(
      /PII/,
    );
  });
});

describe('disabled providers cannot execute', () => {
  it('throws ProviderDisabledError when generate is invoked directly', async () => {
    const provider = createOpenAiProvider();
    expect(provider.descriptor.enabled).toBe(false);
    await expect(
      provider.generate({ prompt: 'x', taskType: 'prospect.research' }),
    ).rejects.toBeInstanceOf(ProviderDisabledError);
  });

  it('registry reports disabled providers as non-executable', () => {
    const registry = createDefaultModelRegistry();
    expect(registry.isExecutable('mock', 'mock-deterministic-1')).toBe(true);
    for (const id of ['openai', 'anthropic', 'deepseek', 'xai', 'openrouter', 'local']) {
      const d = registry.list().find((m) => m.providerId === id)!;
      expect(registry.isExecutable(d.providerId, d.modelId)).toBe(false);
    }
  });
});
