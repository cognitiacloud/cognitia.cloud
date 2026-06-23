/**
 * Cognitia Brain Harness V1 — router/policy/ledger/provider tests.
 *
 * These encode the V1 safety invariants: fallback works, local-only blocks
 * external, cost ceiling blocks, capability mismatch blocks, high-risk requires
 * approval, no raw PII is stored, no real provider can execute, the mock is
 * deterministic, and the CLI provider is disabled by default.
 */

import { describe, expect, it } from 'vitest';
import { BrainRouter } from './brainRouter.js';
import { BrainRunLedger } from './brainRunLedger.js';
import { defaultWorkspacePolicy, type WorkspaceBrainPolicy } from './brainPolicy.js';
import { mockBrainProvider } from './providers/mockProvider.js';
import { ProviderDisabledError } from './providers/brainProvider.js';
import { openRouterBrainProvider } from './providers/openRouterProvider.disabled.js';
import { ollamaBrainProvider } from './providers/ollamaProvider.disabled.js';
import { openAiBrainProvider } from './providers/openaiProvider.disabled.js';
import { anthropicBrainProvider } from './providers/anthropicProvider.disabled.js';
import { deepSeekBrainProvider } from './providers/deepseekProvider.disabled.js';
import { xaiBrainProvider } from './providers/xaiProvider.disabled.js';
import { cliBrainProvider } from './providers/cliProvider.disabled.js';
import { runBrainEvalSuite } from './brainEvalHarness.js';

const WS = 'budget_wheels_demo';
function policy(overrides: Partial<WorkspaceBrainPolicy> = {}): WorkspaceBrainPolicy {
  return { ...defaultWorkspacePolicy(WS), ...overrides };
}
function mockRouter(): BrainRouter {
  return new BrainRouter({ providers: { mock: mockBrainProvider }, ledger: new BrainRunLedger() });
}

describe('BrainRouter — fallback', () => {
  it('falls back to mock when the preferred provider is disabled/blocked', async () => {
    const router = mockRouter();
    const res = await router.route({
      taskType: 'gtm.routing',
      input: 'route this inbound signal',
      // openrouter is external + disabled; in mock mode it is blocked, so the
      // router must advance to mock.
      workspacePolicy: policy({
        preferredProvider: 'openrouter',
        fallbackChain: ['openrouter', 'mock'],
      }),
    });
    expect(res.executed).toBe(true);
    expect(res.provider).toBe('mock');
    expect(res.fallbackUsed).toBe(true);
  });
});

describe('BrainRouter — local-only blocks external providers', () => {
  it('blocks an external provider under local-only mode and serves mock instead', async () => {
    // Force an ENABLED external descriptor so the *mode* gate (not the
    // disabled gate) is what blocks it. The provider instance still cannot run.
    const forcedExternal = { ...openAiBrainProvider.descriptor, enabled: true };
    const router = new BrainRouter({
      providers: { openai: openAiBrainProvider, mock: mockBrainProvider },
      ledger: new BrainRunLedger(),
      registry: { openai: forcedExternal, mock: mockBrainProvider.descriptor },
    });
    const res = await router.route({
      taskType: 'gtm.routing',
      input: 'route this inbound signal',
      workspacePolicy: policy({
        mode: 'local-only',
        allowExternal: false,
        preferredProvider: 'openai',
        fallbackChain: ['openai', 'mock'],
      }),
    });
    // The openai attempt must be blocked by mode, not executed.
    const openaiAttempt = res.attempts.find((a) => a.provider === 'openai');
    expect(openaiAttempt?.decision.decisionCode).toBe('mode_blocks_external');
    expect(res.provider).toBe('mock');
    expect(res.executed).toBe(true);
  });

  it('blocks external even when explicitly preferred and external-api off', async () => {
    const router = mockRouter();
    const res = await router.route({
      taskType: 'gtm.routing',
      input: 'x',
      workspacePolicy: policy({ allowedProviders: ['openrouter'] }),
      preferredProvider: 'openrouter',
    });
    // openrouter blocked; mock not on allowlist -> nothing executes.
    expect(res.executed).toBe(false);
  });
});

describe('BrainRouter — cost ceiling blocks', () => {
  it('blocks a candidate whose estimated cost exceeds the ceiling', async () => {
    // Register a fake "expensive" enabled provider to exercise the cost gate
    // without enabling any real backend.
    const expensive = {
      id: 'expensive',
      descriptor: {
        id: 'expensive',
        kind: 'mock' as const,
        locality: 'mock' as const,
        enabled: true,
        envVarNames: [],
        models: [
          {
            id: 'pricey',
            capabilities: ['classification' as const],
            costPer1kTokensUsd: 100,
            latencyTier: 'realtime' as const,
            maxPrivacyLevel: 'restricted' as const,
          },
        ],
      },
      generate: async () => {
        throw new Error('should not execute — cost-blocked');
      },
    };
    const registry = {
      expensive: expensive.descriptor,
      mock: mockBrainProvider.descriptor,
    };
    const router = new BrainRouter({
      providers: { expensive, mock: mockBrainProvider },
      ledger: new BrainRunLedger(),
      registry,
    });
    const res = await router.route({
      taskType: 'gtm.routing',
      input: 'classify',
      workspacePolicy: policy({
        costCeilingUsd: 0.001,
        preferredProvider: 'expensive',
        fallbackChain: ['expensive', 'mock'],
      }),
    });
    const attempt = res.attempts.find((a) => a.provider === 'expensive');
    expect(attempt?.decision.decisionCode).toBe('cost_ceiling_exceeded');
    expect(res.provider).toBe('mock'); // fell back to the free mock
  });
});

describe('BrainRouter — capability mismatch blocks', () => {
  it('blocks a model that lacks a required capability', async () => {
    // A provider whose only model cannot do web_research, asked to do research.
    const weak = {
      id: 'weak',
      descriptor: {
        id: 'weak',
        kind: 'mock' as const,
        locality: 'mock' as const,
        enabled: true,
        envVarNames: [],
        models: [
          {
            id: 'weak-1',
            capabilities: ['classification' as const],
            costPer1kTokensUsd: 0,
            latencyTier: 'standard' as const,
            maxPrivacyLevel: 'restricted' as const,
          },
        ],
      },
      generate: async () => {
        throw new Error('should not execute — capability-blocked');
      },
    };
    const router = new BrainRouter({
      providers: { weak },
      ledger: new BrainRunLedger(),
      registry: { weak: weak.descriptor },
    });
    const res = await router.route({
      taskType: 'prospect.research', // requires web_research + reasoning + summarization
      input: 'research this account',
      workspacePolicy: policy({ preferredProvider: 'weak', fallbackChain: ['weak'] }),
    });
    const attempt = res.attempts.find((a) => a.provider === 'weak');
    expect(attempt?.decision.decisionCode).toBe('capability_mismatch');
    expect(res.executed).toBe(false);
  });
});

describe('BrainRouter — high-risk requires approval', () => {
  it('does not execute a high-risk task without approval', async () => {
    const router = mockRouter();
    const res = await router.route({
      taskType: 'outreach.draft', // high risk, requiresHumanApproval
      input: 'draft outreach',
      workspacePolicy: policy({}),
    });
    expect(res.requiresApproval).toBe(true);
    expect(res.executed).toBe(false);
    expect(res.policyDecision.decisionCode).toBe('requires_approval');
    expect(res.ledgerRecord.outputHash).toBe('');
  });

  it('executes the same task once approval is granted', async () => {
    const router = mockRouter();
    const res = await router.route({
      taskType: 'outreach.draft',
      input: 'draft outreach',
      workspacePolicy: policy({}),
      approvalGranted: true,
    });
    expect(res.executed).toBe(true);
    expect(res.provider).toBe('mock');
  });
});

describe('BrainRunLedger — no raw PII stored', () => {
  it('stores only hashes; the entry contains no raw email or phone', async () => {
    const router = mockRouter();
    const piiInput = 'Contact: jane.doe@example.com, phone 415-555-0199 — wants a fleet quote';
    const res = await router.route({
      taskType: 'gtm.routing',
      input: piiInput,
      workspacePolicy: policy({}),
    });
    const serialized = JSON.stringify(res.ledgerRecord);
    expect(serialized).not.toContain('jane.doe@example.com');
    expect(serialized).not.toContain('415-555-0199');
    expect(serialized).not.toMatch(/@/);
    // The raw input is not recoverable — only its hash is present.
    expect(res.ledgerRecord.inputHash).toMatch(/^[0-9a-f]{64}$/);
    expect(res.ledgerRecord.inputHash).not.toContain(piiInput);
  });

  it('the ledger refuses an entry that would contain raw PII', () => {
    const ledger = new BrainRunLedger();
    expect(() =>
      ledger.record({
        workspaceId: 'jane.doe@example.com', // smuggled PII
        taskType: 'gtm.routing',
        provider: 'mock',
        model: 'mock-small',
        mode: 'mock',
        inputHash: 'a'.repeat(64),
        outputHash: '',
        costEstimate: 0,
        latencyMs: 0,
        fallbackUsed: false,
        policyDecision: 'allow',
      }),
    ).toThrow(/raw email/);
  });
});

describe('Brain providers — no real provider can execute', () => {
  const disabled = [
    openRouterBrainProvider,
    ollamaBrainProvider,
    openAiBrainProvider,
    anthropicBrainProvider,
    deepSeekBrainProvider,
    xaiBrainProvider,
    cliBrainProvider,
  ];

  it('every non-mock provider is disabled and throws on generate()', async () => {
    for (const p of disabled) {
      expect(p.descriptor.enabled).toBe(false);
      await expect(p.generate({ taskType: 'gtm.routing', input: 'x' })).rejects.toBeInstanceOf(
        ProviderDisabledError,
      );
    }
  });

  it('the router cannot execute a disabled provider even if registered', async () => {
    // Force the disabled openai provider into the executable set AND allow it by
    // policy via a forged "enabled" descriptor — the descriptor used by policy
    // is enabled, but the provider instance still throws, so the router must
    // fall back rather than execute it.
    const forcedDescriptor = { ...openAiBrainProvider.descriptor, enabled: true };
    const router = new BrainRouter({
      providers: { openai: openAiBrainProvider, mock: mockBrainProvider },
      ledger: new BrainRunLedger(),
      registry: { openai: forcedDescriptor, mock: mockBrainProvider.descriptor },
    });
    const res = await router.route({
      taskType: 'gtm.routing',
      input: 'route',
      workspacePolicy: policy({
        mode: 'external-api',
        allowExternal: true,
        preferredProvider: 'openai',
        fallbackChain: ['openai', 'mock'],
      }),
    });
    // openai threw ProviderDisabledError -> fell back to mock.
    expect(res.provider).toBe('mock');
    expect(res.fallbackUsed).toBe(true);
  });
});

describe('MockBrainProvider — deterministic', () => {
  it('produces an identical output hash for identical input', async () => {
    const a = await mockRouter().route({
      taskType: 'gtm.routing',
      input: 'same input every time',
      workspacePolicy: policy({}),
    });
    const b = await mockRouter().route({
      taskType: 'gtm.routing',
      input: 'same input every time',
      workspacePolicy: policy({}),
    });
    expect(a.response?.output).toBe(b.response?.output);
    expect(a.ledgerRecord.outputHash).toBe(b.ledgerRecord.outputHash);
    expect(a.ledgerRecord.proofRef).toBe(b.ledgerRecord.proofRef);
  });

  it('different input yields a different output hash', async () => {
    const a = await mockRouter().route({
      taskType: 'gtm.routing',
      input: 'input one',
      workspacePolicy: policy({}),
    });
    const b = await mockRouter().route({
      taskType: 'gtm.routing',
      input: 'input two',
      workspacePolicy: policy({}),
    });
    expect(a.ledgerRecord.outputHash).not.toBe(b.ledgerRecord.outputHash);
  });
});

describe('CLI provider — disabled by default', () => {
  it('cli provider descriptor is disabled and generate throws', async () => {
    expect(cliBrainProvider.descriptor.enabled).toBe(false);
    await expect(
      cliBrainProvider.generate({ taskType: 'gtm.routing', input: 'x' }),
    ).rejects.toBeInstanceOf(ProviderDisabledError);
  });
});

describe('Brain eval harness — gtm-routing-v1', () => {
  it('all routing scenarios pass', async () => {
    const summary = await runBrainEvalSuite('gtm-routing-v1');
    const failing = summary.results.filter((r) => !r.passed);
    expect(failing, JSON.stringify(failing, null, 2)).toHaveLength(0);
    expect(summary.failed).toBe(0);
    expect(summary.passed).toBe(summary.total);
  });
});
