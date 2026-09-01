import { describe, it, expect } from 'vitest';
import {
  LIVE_SURFACE_DENIED,
  readLiveOutboundFlags,
  isLiveOutboundAllowed,
  assertLiveOutboundAllowed,
  LiveSurfaceDeniedError,
  envFlagTrue,
} from './liveOutbound.js';

describe('CGD-001 live outbound flags', () => {
  it('defaults all false when env is empty', () => {
    const flags = readLiveOutboundFlags({});
    expect(flags.LIVE_OUTBOUND_EXPLICITLY_ALLOWED).toBe(false);
    expect(flags.surfaces).toEqual({
      hubspot: false,
      salesforce: false,
      miraWrite: false,
      email: false,
      sms: false,
    });
  });

  it('treats anything other than true as false (fail-close)', () => {
    expect(envFlagTrue(undefined)).toBe(false);
    expect(envFlagTrue('')).toBe(false);
    expect(envFlagTrue('false')).toBe(false);
    expect(envFlagTrue('1')).toBe(false);
    expect(envFlagTrue('yes')).toBe(false);
    expect(envFlagTrue('TRUE')).toBe(true);
    expect(envFlagTrue(' true ')).toBe(true);
  });

  it('requires master AND nested surface flag', () => {
    const masterOnly = {
      LIVE_OUTBOUND_EXPLICITLY_ALLOWED: 'true',
    };
    expect(isLiveOutboundAllowed('hubspot', masterOnly)).toBe(false);
    const nestedOnly = { LIVE_OUTBOUND_HUBSPOT: 'true' };
    expect(isLiveOutboundAllowed('hubspot', nestedOnly)).toBe(false);
    const both = {
      LIVE_OUTBOUND_EXPLICITLY_ALLOWED: 'true',
      LIVE_OUTBOUND_HUBSPOT: 'true',
    };
    expect(isLiveOutboundAllowed('hubspot', both)).toBe(true);
    expect(isLiveOutboundAllowed('salesforce', both)).toBe(false);
  });

  it('assert throws LIVE_SURFACE_DENIED outbound=false by default', () => {
    try {
      assertLiveOutboundAllowed('hubspot', {});
      throw new Error('expected deny');
    } catch (err) {
      expect(err).toBeInstanceOf(LiveSurfaceDeniedError);
      const denied = err as LiveSurfaceDeniedError;
      expect(denied.code).toBe(LIVE_SURFACE_DENIED);
      expect(denied.outbound).toBe(false);
      expect(denied.surface).toBe('hubspot');
    }
  });
});
