import { describe, expect, it } from 'vitest';
import {
  CHANNEL_KINDS,
  evaluateChannelPolicy,
  isReleaseGateOpen,
  IMPOSSIBLE_RELEASE_GATE,
  type ChannelKind,
  type ChannelPolicyInput,
  type ReleaseGate,
} from './channelPolicy.js';

const baseAllow: ChannelPolicyInput = {
  channel: 'email',
  consent: true,
  approval: 'approved',
  workspaceId: 'ws_budget_wheels_demo',
  live: false,
};

describe('evaluateChannelPolicy', () => {
  it('allows when consent, approval, workspace present and live off', () => {
    const decision = evaluateChannelPolicy(baseAllow);
    expect(decision.allow).toBe(true);
    expect(decision.reasons).toEqual([]);
  });

  it('allows for every modelled channel under good inputs', () => {
    for (const channel of CHANNEL_KINDS) {
      const decision = evaluateChannelPolicy({ ...baseAllow, channel });
      expect(decision.allow).toBe(true);
    }
  });

  it('denies when consent is missing/false', () => {
    const decision = evaluateChannelPolicy({ ...baseAllow, consent: false });
    expect(decision.allow).toBe(false);
    expect(decision.reasons.some((r) => r.startsWith('consent_required'))).toBe(true);
  });

  it('denies when approval is not approved', () => {
    for (const approval of ['pending', 'rejected'] as const) {
      const decision = evaluateChannelPolicy({ ...baseAllow, approval });
      expect(decision.allow).toBe(false);
      expect(decision.reasons.some((r) => r.startsWith('human_approval_required'))).toBe(true);
    }
  });

  it('denies when workspaceId is missing or blank', () => {
    for (const workspaceId of ['', '   ']) {
      const decision = evaluateChannelPolicy({ ...baseAllow, workspaceId });
      expect(decision.allow).toBe(false);
      expect(decision.reasons.some((r) => r.startsWith('workspace_required'))).toBe(true);
    }
  });

  it('denies when live flag is set, even if everything else is valid (fail closed)', () => {
    const decision = evaluateChannelPolicy({ ...baseAllow, live: true });
    expect(decision.allow).toBe(false);
    expect(decision.reasons.some((r) => r.startsWith('live_disabled'))).toBe(true);
  });

  it('accumulates multiple denial reasons', () => {
    const decision = evaluateChannelPolicy({
      channel: 'sms',
      consent: false,
      approval: 'pending',
      workspaceId: '',
      live: true,
    });
    expect(decision.allow).toBe(false);
    expect(decision.reasons.length).toBe(4);
  });
});

describe('release gate (impossible to satisfy)', () => {
  it('the layer-provided impossible gate is closed', () => {
    expect(isReleaseGateOpen(IMPOSSIBLE_RELEASE_GATE)).toBe(false);
  });

  it('even an all-true gate cannot open without the unavailable token', () => {
    const forced: ReleaseGate = {
      legalReviewComplete: true,
      consentVerified: true,
      signedReleaseApproval: true,
      // Any attacker-guessable token here is rejected; the required sentinel
      // is not exported and is never produced by this layer.
      impossibleToken: 'release-token-not-available-in-dry-run-layer-WRONG',
    };
    expect(isReleaseGateOpen(forced)).toBe(false);
  });

  it('no booleans-only manipulation can open the gate', () => {
    const flags: ReleaseGate = {
      legalReviewComplete: true,
      consentVerified: true,
      signedReleaseApproval: true,
      impossibleToken: '',
    };
    expect(isReleaseGateOpen(flags)).toBe(false);
  });
});

describe('CHANNEL_KINDS', () => {
  it('contains exactly the modelled channels', () => {
    const expected: ChannelKind[] = [
      'email',
      'sms',
      'whatsapp',
      'call',
      'linkedin',
      'ad',
      'crm_writeback',
    ];
    expect([...CHANNEL_KINDS]).toEqual(expected);
  });
});
