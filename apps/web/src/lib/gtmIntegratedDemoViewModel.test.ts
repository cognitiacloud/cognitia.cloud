import { describe, it, expect } from 'vitest';
import {
  DEMO_BANNER,
  SANDBOX_WORKSPACE,
  findRawPii,
  assertNoRawPii,
  canProceed,
} from './gtmIntegratedDemoViewModel.js';
import type { GtmRunPacketView } from './gtmOsAssemblyViewModel.js';

function packetView(over: Partial<GtmRunPacketView> = {}): GtmRunPacketView {
  return {
    mode: 'mock',
    workspace: { workspaceId: SANDBOX_WORKSPACE, sandbox: true },
    prospect: {
      id: 'p-001',
      companyName: 'Northshore Auto Group',
      sourceRisk: 'low',
      consentStatus: 'implied_possible',
      fitScore: 0.9,
    },
    status: 'completed',
    finalState: 'appointment_set',
    compliance: { passed: true, blocked: false },
    approval: { status: 'approved' },
    appointment: { requested: true },
    crm: { written: true },
    proofs: [],
    timeline: [],
    noEgress: { liveSendOccurred: false, statement: 'no egress' },
    ...over,
  };
}

describe('constants', () => {
  it('exposes the persistent banner and sandbox tenant', () => {
    expect(DEMO_BANNER).toBe('MOCK ONLY / DRY-RUN ONLY / NO LIVE SEND / NO REAL CRM');
    expect(SANDBOX_WORKSPACE).toBe('budget_wheels_demo');
  });
});

describe('canProceed', () => {
  it('proceeds only when compliance cleared and approved', () => {
    expect(canProceed(packetView())).toBe(true);
  });
  it('does not proceed when compliance is blocked', () => {
    expect(canProceed(packetView({ compliance: { passed: false, blocked: true } }))).toBe(false);
  });
  it('does not proceed when approval is rejected or pending', () => {
    expect(canProceed(packetView({ approval: { status: 'rejected' } }))).toBe(false);
    expect(canProceed(packetView({ approval: { status: 'pending' } }))).toBe(false);
  });
});

describe('findRawPii / assertNoRawPii', () => {
  it('flags real values and clears reserved synthetic ones', () => {
    expect(findRawPii('gm@realdealer.com')).toBe('gm@realdealer.com');
    expect(findRawPii('call 604-321-9988')).toBe('604-321-9988');
    expect(findRawPii('reach sales@northshore-auto.example')).toBeNull();
    expect(findRawPii('call 555-0123')).toBeNull();
    expect(findRawPii('masked j***@dealer.com')).toBeNull();
  });
  it('assertNoRawPii throws on raw PII and passes safe text', () => {
    expect(() => assertNoRawPii('gm@realdealer.com')).toThrow(/raw PII/);
    expect(() => assertNoRawPii('safe sales@x.example / 555-0123')).not.toThrow();
  });
});
