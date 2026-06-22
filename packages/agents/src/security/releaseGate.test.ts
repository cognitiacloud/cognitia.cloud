import { describe, it, expect } from 'vitest';
import {
  evaluateReleaseGate,
  requiredConditions,
  RELEASE_STAGES,
  type ReleaseConditions,
} from './releaseGate.js';

const ALL_LIVE: ReleaseConditions = {
  signedCustomerScope: true,
  counselSignoff: true,
  founderSignoff: true,
  monitoringEnabled: true,
  rollbackReady: true,
  secretsConfigured: true,
  connectorApproval: true,
};

describe('evaluateReleaseGate: dry_run', () => {
  it('passes with no conditions (cannot act on the real world)', () => {
    const r = evaluateReleaseGate('dry_run');
    expect(r.passed).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it('passes even with empty object', () => {
    expect(evaluateReleaseGate('dry_run', {}).passed).toBe(true);
  });
});

describe('evaluateReleaseGate: private_pilot', () => {
  it('requires monitoring and rollback', () => {
    expect(requiredConditions('private_pilot')).toEqual([
      'monitoringEnabled',
      'rollbackReady',
    ]);
  });

  it('fails closed by default', () => {
    const r = evaluateReleaseGate('private_pilot');
    expect(r.passed).toBe(false);
    expect(r.missingKeys).toEqual(['monitoringEnabled', 'rollbackReady']);
  });

  it('passes with both conditions', () => {
    const r = evaluateReleaseGate('private_pilot', {
      monitoringEnabled: true,
      rollbackReady: true,
    });
    expect(r.passed).toBe(true);
  });

  it('fails if rollback missing', () => {
    const r = evaluateReleaseGate('private_pilot', { monitoringEnabled: true });
    expect(r.passed).toBe(false);
    expect(r.missingKeys).toEqual(['rollbackReady']);
  });
});

describe('evaluateReleaseGate: controlled_live', () => {
  it('requires all seven conditions', () => {
    expect(requiredConditions('controlled_live')).toHaveLength(7);
  });

  it('FAILS CLOSED with default/empty conditions', () => {
    const r = evaluateReleaseGate('controlled_live');
    expect(r.passed).toBe(false);
    expect(r.missingKeys).toHaveLength(7);
  });

  it('FAILS CLOSED with empty object', () => {
    expect(evaluateReleaseGate('controlled_live', {}).passed).toBe(false);
  });

  it('passes only when ALL conditions are true', () => {
    const r = evaluateReleaseGate('controlled_live', ALL_LIVE);
    expect(r.passed).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it('fails when ANY single condition is missing', () => {
    for (const key of Object.keys(ALL_LIVE) as Array<keyof ReleaseConditions>) {
      const partial: ReleaseConditions = { ...ALL_LIVE, [key]: false };
      const r = evaluateReleaseGate('controlled_live', partial);
      expect(r.passed).toBe(false);
      expect(r.missingKeys).toContain(key);
    }
  });

  it('treats absent condition the same as false', () => {
    const { connectorApproval, ...rest } = ALL_LIVE;
    void connectorApproval;
    const r = evaluateReleaseGate('controlled_live', rest);
    expect(r.passed).toBe(false);
    expect(r.missingKeys).toEqual(['connectorApproval']);
  });
});

describe('evaluateReleaseGate: unknown stage', () => {
  it('fails closed', () => {
    const r = evaluateReleaseGate('go_live_now', ALL_LIVE);
    expect(r.passed).toBe(false);
    expect(r.reason).toContain('unknown release stage');
  });
});

describe('release stages', () => {
  it('are ordered safest to most exposed', () => {
    expect(RELEASE_STAGES).toEqual([
      'dry_run',
      'private_pilot',
      'controlled_live',
    ]);
  });
});
