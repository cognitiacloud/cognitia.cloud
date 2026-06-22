import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CHANNEL_KINDS, type ChannelKind, type ReleaseGate } from './channelPolicy.js';
import {
  assertNoLiveSend,
  LiveSendBlockedError,
  planDryRunAction,
  sendLive,
  type DryRunChannelInput,
} from './dryRunChannels.js';

const input: DryRunChannelInput = {
  workspaceId: 'ws_budget_wheels_demo',
  prospectId: 'prospect_0001',
};

describe('planDryRunAction', () => {
  it('returns mode:dry_run and sent:false for every channel', () => {
    for (const channel of CHANNEL_KINDS) {
      const action = planDryRunAction(channel, input);
      expect(action.mode).toBe('dry_run');
      expect(action.sent).toBe(false);
      expect(action.channel).toBe(channel);
      expect(action.wouldSendIfLive.liveStatus).toBe('BLOCKED');
    }
  });

  it('is deterministic for identical inputs', () => {
    const a = planDryRunAction('email', input);
    const b = planDryRunAction('email', input);
    expect(a).toEqual(b);
  });

  it('echoes redacted/synthetic preview target and summary', () => {
    const action = planDryRunAction('sms', {
      ...input,
      target: '+1-555-0142',
      summary: 'follow up on demo',
    });
    expect(action.wouldSendIfLive.target).toBe('+1-555-0142');
    expect(action.wouldSendIfLive.summary).toBe('follow up on demo');
  });

  it('builds a stable plan reference', () => {
    const action = planDryRunAction('call', input);
    expect(action.planRef).toBe('dryrun:call:ws_budget_wheels_demo:prospect_0001');
  });
});

describe('assertNoLiveSend', () => {
  it('passes for a genuine dry-run action', () => {
    const action = planDryRunAction('whatsapp', input);
    expect(() => assertNoLiveSend(action)).not.toThrow();
  });

  it('throws if an action is forced to sent:true', () => {
    const forged = { mode: 'dry_run', sent: true } as unknown as Parameters<
      typeof assertNoLiveSend
    >[0];
    expect(() => assertNoLiveSend(forged)).toThrow(LiveSendBlockedError);
    expect(() => assertNoLiveSend(forged)).toThrow(/live channels disabled/);
  });

  it('throws if mode is not dry_run', () => {
    const forged = { mode: 'live', sent: false } as unknown as Parameters<
      typeof assertNoLiveSend
    >[0];
    expect(() => assertNoLiveSend(forged)).toThrow(LiveSendBlockedError);
  });
});

describe('sendLive (always fails closed)', () => {
  it('throws for every channel with the default impossible gate', () => {
    for (const channel of CHANNEL_KINDS) {
      expect(() => sendLive(channel, input)).toThrow(LiveSendBlockedError);
      expect(() => sendLive(channel, input)).toThrow(/live channels disabled/);
    }
  });

  it('throws even when a caller forges an all-true gate (cannot open)', () => {
    const forcedGate: ReleaseGate = {
      legalReviewComplete: true,
      consentVerified: true,
      signedReleaseApproval: true,
      impossibleToken: 'anything-the-caller-tries',
    };
    expect(() => sendLive('email', input, forcedGate)).toThrow(LiveSendBlockedError);
  });
});

describe('source-level network/vendor scan', () => {
  const here = fileURLToPath(new URL('.', import.meta.url));
  const sources = ['dryRunChannels.ts', 'channelPolicy.ts'].map((f) =>
    readFileSync(`${here}${f}`, 'utf8'),
  );

  // Identifiers that would indicate live IO or a vendor SDK leaked in.
  const forbidden = [
    'fetch(',
    'axios',
    'node:http',
    'node:https',
    'node:net',
    'node:tls',
    'child_process',
    'twilio',
    'sendgrid',
    'hubspot',
    'apify',
    'nodemailer',
    'XMLHttpRequest',
    'WebSocket',
    'https://',
    'http://',
  ];

  it('contains no network or vendor identifiers', () => {
    for (const src of sources) {
      for (const token of forbidden) {
        expect(src.includes(token)).toBe(false);
      }
    }
  });
});

describe('channel matrix completeness', () => {
  it('models all seven required channels', () => {
    const expected: ChannelKind[] = [
      'email',
      'sms',
      'whatsapp',
      'call',
      'linkedin',
      'ad',
      'crm_writeback',
    ];
    expect([...CHANNEL_KINDS].sort()).toEqual([...expected].sort());
  });
});
