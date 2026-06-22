import { describe, expect, it } from 'vitest';
import { ApprovalRequiredError } from '../adapters/mockCrmAdapter.js';
import { leadById } from '../fixtures/leads.js';
import { createDeterministicEnv } from '../ids.js';
import { verifyLedger } from '../ledger/actionLedger.js';
import { scanForRawPii } from '../pii/piiSafety.js';
import { verifyReceiptChain } from '../proof/proofReceipt.js';
import { getTenant } from '../tenants/registry.js';
import type { FixtureLead } from '../types.js';
import { createEngine, RunStateError } from './gtmRunEngine.js';

function leadOrThrow(id: string): FixtureLead {
  const found = leadById(id);
  if (!found) throw new Error(`missing fixture: ${id}`);
  return found;
}

const SLOT = '2026-02-01T17:00:00.000Z';
const HUMAN = 'operator:human';

describe('GTM run engine — acceptance criteria', () => {
  it('runs one mock-safe happy path end to end with a proof receipt on every transition', () => {
    const { engine, ledger, appointments, crm } = createEngine(createDeterministicEnv());
    const lead = leadOrThrow('lead_bw_001');
    const tenant = getTenant(lead.tenantId);

    const run = engine.start({ tenantId: lead.tenantId, lead });
    expect(run.state).toBe('lead_received');

    engine.runCompliance(run, lead, tenant);
    expect(run.state).toBe('awaiting_approval');
    expect(run.approvalRequestId).not.toBeNull();

    engine.submitApproval(run, run.approvalRequestId ?? '', {
      outcome: 'approved',
      approver: HUMAN,
    });
    expect(run.state).toBe('approved');

    const report = engine.executeApprovedActions(run, lead, { slotIso: SLOT });
    expect(run.state).toBe('completed');

    expect(run.receipts.map((r) => r.toState)).toEqual([
      'lead_received',
      'compliance_evaluated',
      'awaiting_approval',
      'approved',
      'appointment_booked',
      'crm_written',
      'completed',
    ]);

    expect(verifyReceiptChain(run.receipts).valid).toBe(true);
    expect(verifyLedger(ledger.all()).valid).toBe(true);
    expect(report.integrity.ledgerValid).toBe(true);
    expect(report.integrity.receiptChainValid).toBe(true);
    expect(report.outcome).toBe('completed');
    expect(report.noRawPii).toBe(true);
    expect(appointments.count()).toBe(1);
    expect(crm.count()).toBe(1);

    // Every state transition is attested by exactly one proof receipt.
    const events = ledger.forRun(run.id);
    const transitions = events.filter((e) => e.kind === 'run.transition').length;
    const receipts = events.filter((e) => e.kind === 'proof.receipt').length;
    expect(receipts).toBe(run.receipts.length);
    expect(receipts).toBe(transitions + 1); // +1 for the genesis (run.created) receipt
    expect(events.some((e) => e.kind === 'proof.report')).toBe(true);
  });

  it('produces a proof receipt with blocked reasons on a compliance-blocked path (no writeback)', () => {
    const { engine, appointments, crm } = createEngine(createDeterministicEnv());
    const lead = leadOrThrow('lead_bw_002'); // consent missing
    const run = engine.start({ tenantId: lead.tenantId, lead });
    const decision = engine.runCompliance(run, lead, getTenant(lead.tenantId));

    expect(decision.allowed).toBe(false);
    expect(run.state).toBe('blocked');
    const blockedReceipt = run.receipts.find((r) => r.toState === 'blocked');
    expect(blockedReceipt).toBeDefined();
    expect(blockedReceipt?.reasons).toContain('consent_missing');
    expect(verifyReceiptChain(run.receipts).valid).toBe(true);
    expect(appointments.count()).toBe(0);
    expect(crm.count()).toBe(0);
    expect(engine.report(run).blockedReasons).toContain('consent_missing');
  });

  it('cannot reach writeback without an explicit human approval (no loophole)', () => {
    const { engine, approvals, appointments, crm } = createEngine(createDeterministicEnv());
    const lead = leadOrThrow('lead_bw_001');
    const run = engine.start({ tenantId: lead.tenantId, lead });
    engine.runCompliance(run, lead, getTenant(lead.tenantId));
    expect(run.state).toBe('awaiting_approval');

    // (1) the engine refuses to execute consequential actions pre-approval
    expect(() => engine.executeApprovedActions(run, lead, { slotIso: SLOT })).toThrow(
      RunStateError,
    );
    // (2) calling the adapters directly is also refused (defense in depth)
    expect(() =>
      crm.upsert({ runId: run.id, tenantId: run.tenantId, externalKey: 'k', fields: {} }),
    ).toThrow(ApprovalRequiredError);
    expect(() =>
      appointments.book({
        runId: run.id,
        tenantId: run.tenantId,
        slotIso: SLOT,
        prospectRef: 'lead:lead_bw_001',
      }),
    ).toThrow(ApprovalRequiredError);

    expect(approvals.isApproved(run.id)).toBe(false);
    expect(crm.count()).toBe(0);
    expect(appointments.count()).toBe(0);
  });

  it('a rejected approval ends the run without writeback', () => {
    const { engine, appointments, crm } = createEngine(createDeterministicEnv());
    const lead = leadOrThrow('lead_dm_001');
    const run = engine.start({ tenantId: lead.tenantId, lead });
    engine.runCompliance(run, lead, getTenant(lead.tenantId));
    engine.submitApproval(run, run.approvalRequestId ?? '', {
      outcome: 'rejected',
      approver: HUMAN,
      note: 'not now',
    });
    expect(run.state).toBe('rejected');
    expect(() => engine.executeApprovedActions(run, lead, { slotIso: SLOT })).toThrow(
      RunStateError,
    );
    expect(crm.count()).toBe(0);
    expect(appointments.count()).toBe(0);
  });

  it('repeated writeback is idempotent — re-running approved actions creates no duplicate', () => {
    const { engine, appointments, crm } = createEngine(createDeterministicEnv());
    const lead = leadOrThrow('lead_cg_001');
    const run = engine.start({ tenantId: lead.tenantId, lead });
    engine.runCompliance(run, lead, getTenant(lead.tenantId));
    engine.submitApproval(run, run.approvalRequestId ?? '', {
      outcome: 'approved',
      approver: HUMAN,
    });
    engine.executeApprovedActions(run, lead, { slotIso: SLOT });

    const apptAgain = appointments.book({
      runId: run.id,
      tenantId: run.tenantId,
      slotIso: SLOT,
      prospectRef: `lead:${lead.id}`,
    });
    const crmAgain = crm.upsert({
      runId: run.id,
      tenantId: run.tenantId,
      externalKey: `${run.tenantId}:${lead.id}`,
      fields: { leadRef: lead.id, source: lead.source },
    });
    expect(apptAgain.idempotentReplay).toBe(true);
    expect(crmAgain.idempotentReplay).toBe(true);
    expect(appointments.count()).toBe(1);
    expect(crm.count()).toBe(1);
  });

  it('keeps the ledger and receipts free of raw PII across happy and blocked paths', () => {
    const { engine, ledger } = createEngine(createDeterministicEnv());
    const happy = leadOrThrow('lead_bw_001');
    const r1 = engine.start({ tenantId: happy.tenantId, lead: happy });
    engine.runCompliance(r1, happy, getTenant(happy.tenantId));
    engine.submitApproval(r1, r1.approvalRequestId ?? '', { outcome: 'approved', approver: HUMAN });
    engine.executeApprovedActions(r1, happy, { slotIso: SLOT });

    const blocked = leadOrThrow('lead_bw_003');
    const r2 = engine.start({ tenantId: blocked.tenantId, lead: blocked });
    engine.runCompliance(r2, blocked, getTenant(blocked.tenantId));

    expect(scanForRawPii(ledger.all())).toEqual([]);
    expect(scanForRawPii(r1.receipts)).toEqual([]);
    expect(scanForRawPii(r2.receipts)).toEqual([]);
  });

  it('performs no live egress during a full run (global fetch is never called)', () => {
    const originalFetch = globalThis.fetch;
    let fetchCalled = false;
    globalThis.fetch = ((..._args: unknown[]): never => {
      fetchCalled = true;
      throw new Error('live egress is forbidden in mock-only v0');
    }) as unknown as typeof globalThis.fetch;
    try {
      const { engine } = createEngine(createDeterministicEnv());
      const lead = leadOrThrow('lead_bw_001');
      const run = engine.start({ tenantId: lead.tenantId, lead });
      engine.runCompliance(run, lead, getTenant(lead.tenantId));
      engine.submitApproval(run, run.approvalRequestId ?? '', {
        outcome: 'approved',
        approver: HUMAN,
      });
      engine.executeApprovedActions(run, lead, { slotIso: SLOT });
      expect(run.state).toBe('completed');
    } finally {
      globalThis.fetch = originalFetch;
    }
    expect(fetchCalled).toBe(false);
  });
});
