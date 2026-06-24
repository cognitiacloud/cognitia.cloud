import { describe, expect, it } from 'vitest';
import { runGtmBrainTask, type GtmBrainTaskInput } from './gtmBrainAdapter.js';

const FIXED_NOW = () => new Date('2026-01-01T00:00:00.000Z');
function counterIds() {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
}

function baseInput(overrides: Partial<GtmBrainTaskInput> = {}): GtmBrainTaskInput {
  return {
    task: 'prospect.research',
    promptText: 'Research the Budget Wheels demo dealership pipeline.',
    now: FIXED_NOW,
    newId: counterIds(),
    ...overrides,
  };
}

describe('runGtmBrainTask (Brain⇆GTM seam over the #206 router)', () => {
  it('executes a low-risk research task on the mock provider, hashes only', async () => {
    const r = await runGtmBrainTask(baseInput({ task: 'prospect.research' }));
    expect(r.executed).toBe(true);
    expect(r.blocked).toBe(false);
    expect(r.provider).toBe('mock');
    expect(r.model).toBe('mock-deterministic-1');
    expect(r.promptHash).toMatch(/^[0-9a-f]{64}$/);
    expect(r.outputHash).toMatch(/^[0-9a-f]{64}$/);
    expect(r.proof.kind).toBe('gtm.prospect.sourced.v1');
    expect(r.proofRef).toBe(r.proof.id);
    expect(r.attestation.liveSendOccurred).toBe(false);
  });

  it('routes gtm.routing to the mock and emits a source-reviewed proof', async () => {
    const r = await runGtmBrainTask(baseInput({ task: 'gtm.routing' }));
    expect(r.executed).toBe(true);
    expect(r.provider).toBe('mock');
    expect(r.proof.kind).toBe('gtm.source.reviewed.v1');
  });

  it('blocks high-risk outreach.draft without approval — nothing executes', async () => {
    const r = await runGtmBrainTask(baseInput({ task: 'outreach.draft', approval: false }));
    expect(r.executed).toBe(false);
    expect(r.blocked).toBe(true);
    expect(r.policyDecision.riskLevel).toBe('high');
    expect(r.policyDecision.requiresApproval).toBe(true);
    expect(r.policyDecision.reason).toBe('high_risk_requires_approval');
    expect(r.outputHash).toBeNull();
    expect(r.proof.kind).toBe('gtm.outreach.review_required.v1');
  });

  it('with approval, outreach.draft falls back from the disabled preferred model to the mock', async () => {
    const r = await runGtmBrainTask(baseInput({ task: 'outreach.draft', approval: true }));
    expect(r.executed).toBe(true);
    expect(r.blocked).toBe(false);
    // Preferred provider (anthropic) is disabled in V1 → served by the mock fallback.
    expect(r.provider).toBe('mock');
    expect(r.fallbackUsed).toBe(true);
    expect(r.proof.kind).toBe('gtm.outreach.drafted.v1');
  });

  it('is deterministic with injected now/newId', async () => {
    const a = await runGtmBrainTask(baseInput({ task: 'prospect.research' }));
    const b = await runGtmBrainTask(baseInput({ task: 'prospect.research' }));
    expect(a).toEqual(b);
  });

  it('never stores a raw prompt: the serialized result contains only hashes', async () => {
    const secretPrompt = 'Contact Jane at jane.doe@example.com about the fleet deal.';
    const r = await runGtmBrainTask(
      baseInput({ task: 'prospect.research', promptText: secretPrompt }),
    );
    const serialized = JSON.stringify(r);
    expect(serialized).not.toContain('jane.doe');
    expect(serialized).not.toContain('@example.com');
    expect(serialized).toContain(r.promptHash);
  });
});
