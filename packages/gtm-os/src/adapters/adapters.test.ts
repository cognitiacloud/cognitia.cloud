import { describe, expect, it } from 'vitest';
import { ApprovalQueue } from '../approval/approvalQueue.js';
import { createDeterministicEnv } from '../ids.js';
import { AppendOnlyLedger } from '../ledger/actionLedger.js';
import { MockAppointmentAdapter } from './mockAppointmentAdapter.js';
import { ApprovalRequiredError, MockCrmAdapter } from './mockCrmAdapter.js';

function wire() {
  const env = createDeterministicEnv();
  const ledger = new AppendOnlyLedger(env);
  const approvals = new ApprovalQueue(env);
  const crm = new MockCrmAdapter(env, ledger, approvals);
  const appointments = new MockAppointmentAdapter(env, ledger, approvals);
  return { env, ledger, approvals, crm, appointments };
}

function approveRun(approvals: ApprovalQueue, runId: string): void {
  const req = approvals.request({
    runId,
    tenantId: 'budget_wheels_demo',
    action: 'a',
    summary: 's',
  });
  approvals.decide(req.id, { outcome: 'approved', approver: 'operator:human' });
}

const SLOT = '2026-02-01T17:00:00.000Z';

describe('mock CRM adapter', () => {
  it('refuses without approval and ledgers a blocked action (no record)', () => {
    const { ledger, crm } = wire();
    expect(() =>
      crm.upsert({ runId: 'r', tenantId: 'budget_wheels_demo', externalKey: 'k', fields: {} }),
    ).toThrow(ApprovalRequiredError);
    expect(crm.count()).toBe(0);
    expect(ledger.all().some((e) => e.kind === 'action.blocked')).toBe(true);
  });

  it('is idempotent by externalKey', () => {
    const { approvals, crm } = wire();
    approveRun(approvals, 'r');
    const a = crm.upsert({
      runId: 'r',
      tenantId: 'budget_wheels_demo',
      externalKey: 'k',
      fields: { leadRef: 'lead_bw_001' },
    });
    const b = crm.upsert({
      runId: 'r',
      tenantId: 'budget_wheels_demo',
      externalKey: 'k',
      fields: { leadRef: 'lead_bw_001' },
    });
    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
    expect(b.idempotentReplay).toBe(true);
    expect(b.crmId).toBe(a.crmId);
    expect(crm.count()).toBe(1);
  });

  it('refuses raw PII in fields even when approved', () => {
    const { approvals, crm } = wire();
    approveRun(approvals, 'r');
    expect(() =>
      crm.upsert({
        runId: 'r',
        tenantId: 'budget_wheels_demo',
        externalKey: 'k',
        fields: { email: 'leak@real-corp.test' },
      }),
    ).toThrow();
    expect(crm.count()).toBe(0);
  });
});

describe('mock appointment adapter', () => {
  it('refuses without approval and is idempotent per run once approved', () => {
    const { approvals, appointments } = wire();
    expect(() =>
      appointments.book({
        runId: 'r',
        tenantId: 'budget_wheels_demo',
        slotIso: SLOT,
        prospectRef: 'lead:lead_bw_001',
      }),
    ).toThrow(ApprovalRequiredError);
    approveRun(approvals, 'r');
    const a = appointments.book({
      runId: 'r',
      tenantId: 'budget_wheels_demo',
      slotIso: SLOT,
      prospectRef: 'lead:lead_bw_001',
    });
    const b = appointments.book({
      runId: 'r',
      tenantId: 'budget_wheels_demo',
      slotIso: SLOT,
      prospectRef: 'lead:lead_bw_001',
    });
    expect(b.appointmentId).toBe(a.appointmentId);
    expect(b.idempotentReplay).toBe(true);
    expect(appointments.count()).toBe(1);
  });
});
