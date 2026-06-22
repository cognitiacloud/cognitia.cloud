import { describe, it, expect } from 'vitest';
import {
  buildIntegratedDemoView,
  canProceed,
  planDryRunAction,
  assertNoLiveSend,
  evaluateReleaseGate,
  MockCrmStore,
  findRawPii,
  assertNoRawPii,
  CHANNEL_KINDS,
  DEMO_BANNER,
  type DryRunChannelAction,
} from './gtmIntegratedDemoViewModel.js';

const view = buildIntegratedDemoView();

describe('integrated demo — banner & shape', () => {
  it('exposes the persistent mock/dry-run banner and sandbox tenant', () => {
    expect(view.banner).toBe('MOCK ONLY / DRY-RUN ONLY / NO LIVE SEND / NO REAL CRM');
    expect(DEMO_BANNER).toBe(view.banner);
    expect(view.workspaceId).toBe('budget_wheels_demo');
    expect(view.sandbox).toBe(true);
  });

  it('renders all six integrated surfaces', () => {
    expect(view.leads.length).toBeGreaterThan(0); // B1 assembly packets
    expect(view.leads[0]!.channelPlan).toBeDefined(); // B2 dry-run plan
    expect(view.crm).toBeDefined(); // B3 CRM-lite
    expect(view.audience.ranked.length).toBeGreaterThan(0); // B4 audience
    expect(view.trustOps.reportMarkdown).toContain('TrustOps report'); // B5
    expect(view.releaseGates.length).toBe(3); // B6 release gates
  });
});

describe('blocked leads cannot proceed', () => {
  it('a do-not-contact lead is blocked, writes no CRM, plans no channel actions', () => {
    const blocked = view.leads.find((l) => l.lead.id === 'p-009')!;
    expect(canProceed(blocked.lead.packet)).toBe(false);
    expect(blocked.console.badge.tone).toBe('danger');
    expect(blocked.channelPlan).toHaveLength(0);
    expect(blocked.lead.packet.crm.written).toBe(false);
  });

  it('only the compliant+approved lead proceeds', () => {
    const ok = view.leads.find((l) => l.lead.id === 'p-001')!;
    expect(canProceed(ok.lead.packet)).toBe(true);
    expect(ok.channelPlan.length).toBeGreaterThan(0);
  });
});

describe('dry-run channels never send', () => {
  it('every planned action is a dry-run no-send across all leads', () => {
    for (const { channelPlan } of view.leads) {
      for (const action of channelPlan) {
        expect(action.mode).toBe('dry_run');
        expect(action.sent).toBe(false);
        expect(action.wouldSendIfLive.liveStatus).toBe('BLOCKED');
        expect(() => assertNoLiveSend(action)).not.toThrow();
      }
    }
  });

  it('planDryRunAction can never produce a live send, for any channel', () => {
    for (const kind of CHANNEL_KINDS) {
      const action = planDryRunAction(kind, { to: 'x@y.example', summary: 's' });
      expect(action.sent).toBe(false);
      expect(action.mode).toBe('dry_run');
    }
  });

  it('a tampered (forged) live send is rejected', () => {
    const forged = {
      ...planDryRunAction('email', { to: 'x@y.example', summary: 's' }),
      sent: true,
    } as unknown as DryRunChannelAction;
    expect(() => assertNoLiveSend(forged)).toThrow(/live send blocked/);
  });
});

describe('live release gates fail closed', () => {
  it('dry_run passes (no conditions); private_pilot & controlled_live fail by default', () => {
    expect(evaluateReleaseGate('dry_run').passed).toBe(true);
    expect(evaluateReleaseGate('private_pilot').passed).toBe(false);
    expect(evaluateReleaseGate('controlled_live').passed).toBe(false);
  });

  it('controlled_live needs all 7 signoffs; one missing still fails', () => {
    const all = {
      signedCustomerScope: true,
      counselSignoff: true,
      founderSignoff: true,
      monitoring: true,
      rollback: true,
      secrets: true,
      connectorApproval: true,
    };
    expect(evaluateReleaseGate('controlled_live', all).passed).toBe(true);
    expect(evaluateReleaseGate('controlled_live', { ...all, counselSignoff: false }).passed).toBe(
      false,
    );
    expect(evaluateReleaseGate('controlled_live').missing).toHaveLength(7);
  });

  it('the demo view shows controlled_live as not passed', () => {
    const controlled = view.releaseGates.find((g) => g.stage === 'controlled_live')!;
    expect(controlled.passed).toBe(false);
    expect(controlled.missingLabels.length).toBeGreaterThan(0);
  });
});

describe('CRM-lite is mock and idempotent', () => {
  it('double-upsert on the same key keeps a single record with a stable id', () => {
    const crm = new MockCrmStore();
    const a = crm.upsert({
      workspaceId: 'budget_wheels_demo',
      prospectId: 'p-001',
      appointmentRef: 'appt-1',
      stage: 'lead',
    });
    const b = crm.upsert({
      workspaceId: 'budget_wheels_demo',
      prospectId: 'p-001',
      appointmentRef: 'appt-1',
      stage: 'appointment_set',
    });
    expect(b.id).toBe(a.id);
    expect(crm.list()).toHaveLength(1);
    expect(crm.list()[0]!.stage).toBe('appointment_set');
  });

  it('the integrated view wrote exactly one CRM record (idempotent)', () => {
    expect(view.crm).toHaveLength(1);
    expect(view.crm[0]!.workspaceId).toBe('budget_wheels_demo');
  });
});

describe('TrustOps metrics render', () => {
  it('reports funnel counts, an approval coverage, and a bounded trust score', () => {
    expect(view.trustOps.funnel.leadsReceived).toBe(2);
    expect(view.trustOps.funnel.complianceBlocked).toBe(1);
    expect(view.trustOps.approvalCoverage).toBeGreaterThanOrEqual(0);
    expect(view.trustOps.approvalCoverage).toBeLessThanOrEqual(1);
    expect(view.trustOps.trustScore).toBeGreaterThanOrEqual(0);
    expect(view.trustOps.trustScore).toBeLessThanOrEqual(100);
    expect(view.trustOps.noLiveEgress).toBe(true);
    expect(view.trustOps.reportMarkdown).toContain('Trust score');
  });
});

describe('no raw PII appears', () => {
  it('findRawPii flags real values and clears reserved synthetic ones', () => {
    expect(findRawPii('gm@realdealer.com')).toBe('gm@realdealer.com');
    expect(findRawPii('call 604-321-9988')).toBe('604-321-9988');
    expect(findRawPii('reach sales@northshore-auto.example')).toBeNull();
    expect(findRawPii('call 555-0123')).toBeNull();
    expect(findRawPii('masked j***@dealer.com')).toBeNull();
  });

  it('the entire serialized demo view contains no raw PII', () => {
    expect(() => assertNoRawPii(JSON.stringify(view))).not.toThrow();
  });
});
