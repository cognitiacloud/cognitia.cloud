import { describe, expect, it, vi } from 'vitest';
import { proofCarriesNoRawPii } from '../gtm-os/assembly/guards.js';
import {
  decideBrainPolicy,
  resolveBrainRoute,
  runGtmBrainTask,
  type GtmBrainTaskInput,
} from './gtmBrainAdapter.js';
import {
  ProviderDisabledError,
  type BrainProvider,
  type BrainRequest,
  type BrainResponse,
} from './modelProvider.js';
import { ModelRegistry, createDefaultBrainRegistry } from './modelRegistry.js';
import { mockBrainProvider } from './providers/mockProvider.js';

const SHA256_HEX = /^[0-9a-f]{64}$/;

/** Deterministic injectables so proof ids/timestamps are stable across runs. */
function deterministic(seed = 1): Pick<GtmBrainTaskInput, 'now' | 'newId'> {
  let n = seed;
  return {
    now: () => new Date('2026-06-23T00:00:00.000Z'),
    newId: () => `00000000-0000-4000-8000-${String(n++).padStart(12, '0')}`,
  };
}

/** Wrap the real mock provider so we can assert `generate` is never called. */
function spyRegistry(): { registry: ModelRegistry; generate: ReturnType<typeof vi.fn> } {
  const generate = vi.fn(async (req: BrainRequest): Promise<BrainResponse> => {
    throw new Error(`generate must not be called (model=${req.model})`);
  });
  const provider: BrainProvider = {
    descriptor: mockBrainProvider.descriptor,
    isEnabled: () => true,
    generate,
  };
  return { registry: new ModelRegistry().register(provider), generate };
}

describe('runGtmBrainTask — Brain ⇆ GTM seam', () => {
  it('executes the mock for an approved low-risk task', async () => {
    const res = await runGtmBrainTask({
      task: 'prospect.research',
      promptText: 'Research the dealership fit for this account.',
      approval: true,
      ...deterministic(),
    });

    expect(res.executed).toBe(true);
    expect(res.blocked).toBe(false);
    expect(res.provider).toBe('mock');
    expect(res.model).toBeTruthy();
    expect(res.policyDecision.riskLevel).toBe('low');
    expect(res.proofRef).toBeTruthy();
    expect(res.promptHash).toMatch(SHA256_HEX);
    expect(res.outputHash).toMatch(SHA256_HEX);
    expect(res.proof.kind).toBe('gtm.prospect.sourced.v1');
  });

  it('blocks a high-risk task without approval and never calls the provider', async () => {
    const { registry, generate } = spyRegistry();

    const res = await runGtmBrainTask({
      task: 'outreach.draft',
      promptText: 'Draft an intro email to the GM.',
      registry,
      // Force routing to the enabled (spy) provider so a fallback is not needed.
      preferredProviderId: 'mock',
      // no approval
      ...deterministic(),
    });

    expect(res.blocked).toBe(true);
    expect(res.executed).toBe(false);
    expect(res.outputHash).toBeNull();
    expect(res.policyDecision.riskLevel).toBe('high');
    expect(res.policyDecision.requiresApproval).toBe(true);
    expect(res.proof.kind).toBe('gtm.outreach.review_required.v1');
    expect(generate).not.toHaveBeenCalled();
  });

  it('executes a high-risk task once approved', async () => {
    const res = await runGtmBrainTask({
      task: 'outreach.draft',
      promptText: 'Draft an intro email to the GM.',
      approval: true,
      ...deterministic(),
    });

    expect(res.executed).toBe(true);
    expect(res.blocked).toBe(false);
    expect(res.provider).toBe('mock');
    expect(res.proof.kind).toBe('gtm.outreach.drafted.v1');
  });

  it('stores hashes only — no raw PII in the result or proof', async () => {
    const res = await runGtmBrainTask({
      task: 'prospect.research',
      promptText: 'Owner contact is gm@dealer.example — research the account.',
      approval: true,
      ...deterministic(),
    });

    // The raw email must not survive anywhere in the serialized surfaces.
    expect(JSON.stringify(res)).not.toContain('gm@dealer.example');
    expect(JSON.stringify(res)).not.toContain('@');
    expect(proofCarriesNoRawPii(res.proof)).toBe(true);
    expect(res.promptHash).toMatch(SHA256_HEX);
  });

  it('always produces a proofRef, on both executed and blocked paths', async () => {
    const executed = await runGtmBrainTask({
      task: 'gtm.routing',
      promptText: 'Route this lead to the right play.',
      approval: true,
      ...deterministic(1),
    });
    const blocked = await runGtmBrainTask({
      task: 'outreach.draft',
      promptText: 'Draft outreach.',
      ...deterministic(50),
    });

    expect(executed.proofRef).toBeTruthy();
    expect(blocked.proofRef).toBeTruthy();
    expect(executed.proofRef).not.toBe(blocked.proofRef);
  });

  it('attests no live egress on every result', async () => {
    const res = await runGtmBrainTask({
      task: 'gtm.routing',
      promptText: 'Route this lead.',
      approval: true,
      ...deterministic(),
    });

    expect(res.attestation.mode).toBe('mock');
    expect(res.attestation.liveSendOccurred).toBe(false);
  });

  it('falls back to the enabled provider when the preferred one is disabled', async () => {
    // outreach.draft prefers 'anthropic', which is disabled in V1.
    const fellBack = await runGtmBrainTask({
      task: 'outreach.draft',
      promptText: 'Draft outreach.',
      approval: true,
      ...deterministic(),
    });
    expect(fellBack.provider).toBe('mock');
    expect(fellBack.fallbackUsed).toBe(true);

    // prospect.research prefers 'mock', which is enabled — no fallback.
    const direct = await runGtmBrainTask({
      task: 'prospect.research',
      promptText: 'Research the account.',
      approval: true,
      ...deterministic(),
    });
    expect(direct.provider).toBe('mock');
    expect(direct.fallbackUsed).toBe(false);
  });
});

describe('resolveBrainRoute', () => {
  it('uses the preferred provider when enabled', () => {
    const route = resolveBrainRoute(createDefaultBrainRegistry(), 'mock');
    expect(route.provider).toBe('mock');
    expect(route.fallbackUsed).toBe(false);
    expect(route.model).toBeTruthy();
  });

  it('falls back when the preferred provider is disabled or unknown', () => {
    const route = resolveBrainRoute(createDefaultBrainRegistry(), 'anthropic');
    expect(route.provider).toBe('mock');
    expect(route.fallbackUsed).toBe(true);
  });
});

describe('decideBrainPolicy', () => {
  it('treats outreach.draft as high-risk requiring approval', () => {
    const d = decideBrainPolicy('outreach.draft');
    expect(d.riskLevel).toBe('high');
    expect(d.requiresApproval).toBe(true);
    expect(d.blocked).toBe(false);
  });

  it('treats research and routing as low-risk', () => {
    expect(decideBrainPolicy('prospect.research').riskLevel).toBe('low');
    expect(decideBrainPolicy('gtm.routing').riskLevel).toBe('low');
  });
});

describe('disabled providers never execute', () => {
  it('getEnabled throws ProviderDisabledError for a scaffolded provider', () => {
    expect(() => createDefaultBrainRegistry().getEnabled('anthropic')).toThrow(
      ProviderDisabledError,
    );
  });
});
