import { describe, expect, it } from 'vitest';
import {
  GTM_ROUTING_SUITE,
  GTM_ROUTING_V1_SCENARIOS,
  assertNoRawPiiInEvalOutput,
  routeBrainRequest,
  runBrainEvalSuite,
  type BrainConfig,
  type BrainRoutingRequest,
  type EvalScenario,
} from './brainEvalHarness.js';

const SAFE_PROMPT = 'Summarize the Budget Wheels demo pipeline for the weekly review.';

const mockOnly: BrainConfig = {
  providers: [{ id: 'mock-primary', enabled: true, locality: 'local', costCents: 1, isMock: true }],
  costCeilingCents: 100,
};

const baseRequest: BrainRoutingRequest = {
  workspaceId: 'budget_wheels_demo',
  prompt: SAFE_PROMPT,
  actionType: 'crm.note.create',
  approved: true,
};

describe('routeBrainRequest', () => {
  it('routes an approved in-budget request to the preferred mock provider', () => {
    const decision = routeBrainRequest(baseRequest, mockOnly);
    expect(decision.outcome).toBe('routed');
    expect(decision.provider).toBe('mock-primary');
    expect(decision.fallbackUsed).toBe(false);
    expect(decision.outputHash).toBeTypeOf('string');
  });

  it('is deterministic: identical input yields identical hashes', () => {
    const a = routeBrainRequest(baseRequest, mockOnly);
    const b = routeBrainRequest(baseRequest, mockOnly);
    expect(a).toEqual(b);
  });

  it('falls back when the preferred provider is disabled', () => {
    const decision = routeBrainRequest(baseRequest, {
      providers: [
        { id: 'mock-primary', enabled: false, locality: 'local', costCents: 1, isMock: true },
        { id: 'mock-fallback', enabled: true, locality: 'local', costCents: 1, isMock: true },
      ],
      costCeilingCents: 100,
    });
    expect(decision.outcome).toBe('fallback');
    expect(decision.provider).toBe('mock-fallback');
    expect(decision.fallbackUsed).toBe(true);
  });

  it('hard-blocks a suppressed target via the policy gate', () => {
    const decision = routeBrainRequest({ ...baseRequest, isSuppressed: true }, mockOnly);
    expect(decision.outcome).toBe('blocked_policy');
    expect(decision.provider).toBeNull();
    expect(decision.outputHash).toBeNull();
  });

  it('holds a high-risk send for approval instead of routing', () => {
    const decision = routeBrainRequest(
      { ...baseRequest, actionType: 'email.draft.send', approved: false },
      mockOnly,
    );
    expect(decision.outcome).toBe('needs_approval');
    expect(decision.requiresApproval).toBe(true);
    expect(decision.provider).toBeNull();
  });

  it('blocks a local-only tenant that only has a remote provider', () => {
    const decision = routeBrainRequest(baseRequest, {
      providers: [
        { id: 'remote-primary', enabled: true, locality: 'remote', costCents: 5, isMock: false },
      ],
      localOnly: true,
      costCeilingCents: 100,
    });
    expect(decision.outcome).toBe('blocked_local_only');
    expect(decision.provider).toBeNull();
  });

  it('blocks a request whose estimated cost exceeds the ceiling', () => {
    const decision = routeBrainRequest({ ...baseRequest, estimatedCostCents: 250 }, mockOnly);
    expect(decision.outcome).toBe('blocked_cost_ceiling');
    expect(decision.provider).toBeNull();
  });

  it('blocks an explicit request for a disabled provider', () => {
    const decision = routeBrainRequest(
      { ...baseRequest, requestedProvider: 'mock-primary' },
      {
        providers: [
          { id: 'mock-primary', enabled: false, locality: 'local', costCents: 1, isMock: true },
        ],
        costCeilingCents: 100,
      },
    );
    expect(decision.outcome).toBe('blocked_disabled_provider');
    expect(decision.provider).toBeNull();
  });

  it('never invokes a non-mock provider (no live model calls in V1)', () => {
    // A routed decision that lands on a non-mock provider must throw, not call out.
    expect(() =>
      routeBrainRequest(baseRequest, {
        providers: [
          { id: 'remote-primary', enabled: true, locality: 'remote', costCents: 1, isMock: false },
        ],
        costCeilingCents: 100,
      }),
    ).toThrow(/non-mock/);
  });
});

describe('runBrainEvalSuite — gtm-routing-v1', () => {
  it('runs the canonical suite and every scenario passes', () => {
    const result = runBrainEvalSuite();
    expect(result.suite).toBe(GTM_ROUTING_SUITE);
    expect(result.total).toBe(GTM_ROUTING_V1_SCENARIOS.length);
    expect(result.total).toBe(7);
    expect(result.passed).toBe(result.total);
    expect(result.failed).toBe(0);
    expect(result.results.every((r) => r.passed)).toBe(true);
  });

  it('covers each required routing scenario exactly once', () => {
    const names = GTM_ROUTING_V1_SCENARIOS.map((s) => s.name).sort();
    expect(names).toEqual(
      [
        'cost-ceiling-block',
        'disabled-provider-block',
        'fallback',
        'high-risk-approval-required',
        'local-only-block',
        'policy-block',
        'routing-to-mock',
      ].sort(),
    );
  });

  it('reports a failure when an expectation is deliberately wrong', () => {
    const wrong: EvalScenario = {
      name: 'deliberately-wrong',
      description: 'Expects a block where the brain actually routes.',
      request: baseRequest,
      config: mockOnly,
      // The request routes to mock-primary, but we assert a cost-ceiling block.
      expected: { outcome: 'blocked_cost_ceiling' },
    };
    const result = runBrainEvalSuite([...GTM_ROUTING_V1_SCENARIOS, wrong]);
    expect(result.failed).toBe(1);
    expect(result.passed).toBe(GTM_ROUTING_V1_SCENARIOS.length);
    const failing = result.results.find((r) => r.scenario === 'deliberately-wrong');
    expect(failing?.passed).toBe(false);
    expect(failing?.mismatches.length).toBeGreaterThan(0);
  });

  it('produces no raw PII in suite output (hashes only)', () => {
    const result = runBrainEvalSuite();
    const serialized = JSON.stringify(result);
    // No raw prompt text, no email/phone shapes — only sha256 hashes.
    expect(serialized).not.toContain('Budget Wheels');
    expect(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(serialized)).toBe(false);
    expect(() => assertNoRawPiiInEvalOutput(result)).not.toThrow();
    // Every routed scenario carries a 64-char sha256 prompt hash, not raw text.
    for (const r of result.results) {
      expect(r.actual.promptHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });

  it('assertNoRawPiiInEvalOutput throws if raw PII is injected', () => {
    const result = runBrainEvalSuite();
    const poisoned = {
      ...result,
      results: [
        ...result.results,
        {
          scenario: 'poison',
          passed: true,
          expected: { outcome: 'routed' as const },
          actual: {
            outcome: 'routed' as const,
            provider: 'gm@realdealer.com',
            requiresApproval: false,
            fallbackUsed: false,
            promptHash: 'x',
            outputHash: null,
          },
          mismatches: [],
        },
      ],
    };
    expect(() => assertNoRawPiiInEvalOutput(poisoned)).toThrow(/email PII/);
  });
});
