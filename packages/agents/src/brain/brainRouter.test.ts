import { describe, expect, it } from 'vitest';
import { route, type BrainRouteInput } from './brainRouter.js';
import { DEFAULT_BRAIN_POLICY, type WorkspaceBrainPolicy } from './brainPolicy.js';
import type { ModelDescriptor } from './taskRegistry.js';

/** A permissive baseline policy; tests tighten individual fields per case. */
const baseAllowPolicy: WorkspaceBrainPolicy = {
  ...DEFAULT_BRAIN_POLICY,
  costCeilingUsd: 1,
  privacyTier: 'restricted',
  latencyTier: 'batch',
  localOnly: false,
  requireApprovalForHighRisk: true,
};

/** A capable external model usable for the non-high-risk default task. */
const externalA: ModelDescriptor = {
  id: 'ext-a',
  provider: 'openai',
  capabilities: ['routing', 'reasoning', 'summarization', 'research'],
  costPerCallUsd: 0.02,
  latencyTier: 'realtime',
  maxDataTier: 'confidential',
  residency: 'external',
  available: true,
};

const externalB: ModelDescriptor = {
  ...externalA,
  id: 'ext-b',
  provider: 'anthropic',
  costPerCallUsd: 0.03,
};

const localRedactor: ModelDescriptor = {
  id: 'local-redactor',
  provider: 'local',
  capabilities: ['redaction', 'routing'],
  costPerCallUsd: 0,
  latencyTier: 'realtime',
  maxDataTier: 'restricted',
  residency: 'local',
  available: true,
};

const baseInput = (overrides: Partial<BrainRouteInput> = {}): BrainRouteInput => ({
  task: 'gtm.routing',
  policy: baseAllowPolicy,
  workspaceId: 'budget_wheels_demo',
  ...overrides,
});

describe('brainRouter.route', () => {
  it('executes a mock call and exposes only hashes (no raw prompt)', () => {
    const decision = route(baseInput({ promptText: 'route this lead now' }), [externalA]);
    expect(decision.status).toBe('executed');
    expect(decision.reasonCode).toBe('ok');
    expect(decision.selectedModel).toEqual({ modelId: 'ext-a', provider: 'openai' });
    expect(decision.execution?.mock).toBe(true);
    // sha256 hex, and never the raw prompt text.
    expect(decision.execution?.promptHash).toMatch(/^[0-9a-f]{64}$/);
    expect(decision.execution?.outputHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(decision)).not.toContain('route this lead now');
  });

  it('fallback works: skips an unavailable primary to the next provider in order', () => {
    const policy: WorkspaceBrainPolicy = {
      ...baseAllowPolicy,
      fallbackChain: ['openai', 'anthropic'],
    };
    const decision = route(baseInput({ policy }), [{ ...externalA, available: false }, externalB]);
    expect(decision.status).toBe('executed');
    expect(decision.selectedModel).toEqual({ modelId: 'ext-b', provider: 'anthropic' });
    expect(decision.execution?.modelId).toBe('ext-b');
  });

  it('blocks when every surviving model is unavailable', () => {
    const decision = route(baseInput(), [{ ...externalA, available: false }]);
    expect(decision.status).toBe('blocked');
    expect(decision.reasonCode).toBe('no_available_provider');
    expect(decision.execution).toBeUndefined();
  });

  it('disallowed provider blocks', () => {
    const policy: WorkspaceBrainPolicy = { ...baseAllowPolicy, blockedProviders: ['openai'] };
    const decision = route(baseInput({ policy }), [externalA]);
    expect(decision.status).toBe('blocked');
    expect(decision.reasonCode).toBe('provider_blocked');
    expect(decision.execution).toBeUndefined();
  });

  it('allowlist that excludes the only candidate blocks', () => {
    const policy: WorkspaceBrainPolicy = { ...baseAllowPolicy, allowedProviders: ['local'] };
    const decision = route(baseInput({ policy }), [externalA]);
    expect(decision.status).toBe('blocked');
    expect(decision.reasonCode).toBe('provider_blocked');
  });

  it('cost ceiling blocks', () => {
    const policy: WorkspaceBrainPolicy = { ...baseAllowPolicy, costCeilingUsd: 0.001 };
    const decision = route(baseInput({ policy }), [externalA, externalB]);
    expect(decision.status).toBe('blocked');
    expect(decision.reasonCode).toBe('cost_ceiling_exceeded');
    expect(decision.execution).toBeUndefined();
  });

  it('privacy block works: restricted task cannot use an external-only catalog', () => {
    // pii.redact is dataTier 'restricted'; give it an external redactor only.
    const externalRedactor: ModelDescriptor = {
      ...localRedactor,
      id: 'ext-redactor',
      provider: 'openai',
      residency: 'external',
      maxDataTier: 'confidential',
    };
    const policy: WorkspaceBrainPolicy = { ...baseAllowPolicy, privacyTier: 'public' };
    const decision = route(baseInput({ task: 'pii.redact', policy }), [externalRedactor]);
    expect(decision.status).toBe('blocked');
    expect(decision.reasonCode).toBe('privacy_tier_exceeded');
    expect(decision.execution).toBeUndefined();
  });

  it('privacy: a local model can handle the restricted task', () => {
    const policy: WorkspaceBrainPolicy = { ...baseAllowPolicy, privacyTier: 'public' };
    const decision = route(baseInput({ task: 'pii.redact', policy }), [localRedactor]);
    expect(decision.status).toBe('executed');
    expect(decision.selectedModel?.provider).toBe('local');
  });

  it('localOnly blocks external providers but allows local ones', () => {
    const policy: WorkspaceBrainPolicy = { ...baseAllowPolicy, localOnly: true };
    const blocked = route(baseInput({ task: 'pii.redact', policy }), [
      { ...localRedactor, id: 'ext-redactor', provider: 'openai', residency: 'external' },
    ]);
    expect(blocked.status).toBe('blocked');
    expect(blocked.reasonCode).toBe('local_only');

    const allowed = route(baseInput({ task: 'pii.redact', policy }), [localRedactor]);
    expect(allowed.status).toBe('executed');
  });

  it('capability mismatch blocks when no model has the required capability', () => {
    // pii.redact requires 'redaction'; this catalog has none.
    const decision = route(baseInput({ task: 'pii.redact' }), [externalA, externalB]);
    expect(decision.status).toBe('blocked');
    expect(decision.reasonCode).toBe('capability_mismatch');
    expect(decision.execution).toBeUndefined();
  });

  it('high-risk task requires approval before executing', () => {
    const drafter: ModelDescriptor = {
      ...externalA,
      id: 'drafter',
      capabilities: ['drafting', 'reasoning'],
    };
    const pending = route(baseInput({ task: 'outreach.draft', approval: 'pending' }), [drafter]);
    expect(pending.status).toBe('requires_approval');
    expect(pending.reasonCode).toBe('approval_required');
    expect(pending.selectedModel?.modelId).toBe('drafter');
    expect(pending.execution).toBeUndefined();

    const approved = route(baseInput({ task: 'outreach.draft', approval: 'approved' }), [drafter]);
    expect(approved.status).toBe('executed');
    expect(approved.execution?.modelId).toBe('drafter');
  });

  it('high-risk gate can be disabled by policy', () => {
    const drafter: ModelDescriptor = {
      ...externalA,
      id: 'drafter',
      capabilities: ['drafting', 'reasoning'],
    };
    const policy: WorkspaceBrainPolicy = {
      ...baseAllowPolicy,
      requireApprovalForHighRisk: false,
    };
    const decision = route(baseInput({ task: 'outreach.draft', policy }), [drafter]);
    expect(decision.status).toBe('executed');
  });

  it('unknown task fails closed', () => {
    const decision = route(baseInput({ task: 'does.not.exist' }), [externalA]);
    expect(decision.status).toBe('blocked');
    expect(decision.reasonCode).toBe('unknown_task');
    expect(decision.selectedModel).toBeUndefined();
    expect(decision.execution).toBeUndefined();
  });
});
