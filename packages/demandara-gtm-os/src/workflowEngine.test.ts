import { describe, expect, it } from 'vitest';
import { HumanApprovalRegistry } from './approvalGate.js';
import { createDefaultConnectorRegistry } from './connectorRegistry.js';
import { MonthlyProofReportAccumulator } from './demandGen.js';
import { ModelRouterHarness } from './modelRouter.js';
import { fixedClock, fixtureLead, sequentialIds } from './testSupport.test.js';
import { runSalesCloserWorkflow } from './workflowEngine.js';
import type { WorkflowRunOptions } from './workflowEngine.js';

function harness() {
  const clock = fixedClock();
  const idFactory = sequentialIds('run');
  const approvals = new HumanApprovalRegistry({ clock, idFactory: sequentialIds('appr') });
  const connectors = createDefaultConnectorRegistry({ clock, idFactory: sequentialIds('int') });
  const monthlyReport = new MonthlyProofReportAccumulator();
  const base: Omit<WorkflowRunOptions, 'lead'> = {
    approvals,
    connectors,
    monthlyReport,
    clock,
    idFactory,
  };
  return { approvals, connectors, monthlyReport, base };
}

describe('Sales Closer workflow engine — happy path (mock only)', () => {
  it('runs intake -> gates -> approval -> mock writeback -> receipt -> report', () => {
    const { approvals, connectors, monthlyReport, base } = harness();
    const lead = fixtureLead('bw_happy_path_mock_only');
    approvals.issue({
      leadId: 'bw-fake-lead-0001',
      decision: 'approved',
      approvedBy: 'operator_fixture_01',
      note: 'Fixture-only demo approval.',
    });

    const run = runSalesCloserWorkflow({ ...base, lead });

    expect(run.status).toBe('completed_mock_only');
    expect(run.blockedReason).toBeNull();
    expect(run.finalState).toBe('monthly_report_updated');
    expect(run.stateTrace.map((entry) => entry.state)).toEqual([
      'lead_received',
      'source_rights_checked',
      'qualified_or_disqualified',
      'trust_gap_identified',
      'recommended_next_step_generated',
      'human_approval_required',
      'human_approved',
      'mock_writeback_recorded',
      'proof_receipt_generated',
      'monthly_report_updated',
    ]);

    // Writeback is a mock intent only — no egress happened or can happen.
    expect(run.writeback?.status).toBe('recorded_mock_intent');
    if (run.writeback?.status === 'recorded_mock_intent') {
      expect(run.writeback.intent.mockOnly).toBe(true);
      expect(run.writeback.intent.egressPerformed).toBe(false);
      expect(run.writeback.intent.connectorId).toBe('crm_mock');
    }
    expect(connectors.recordedIntents()).toHaveLength(1);

    // Proof receipt captures the whole story.
    expect(run.proofReceipt.policyDecision).toBe('allowed_mock_only');
    expect(run.proofReceipt.approval?.decision).toBe('approved');
    expect(run.proofReceipt.adapterEvent?.mockOnly).toBe(true);
    expect(run.proofReceipt.evidenceLabel).toBe('IMPLEMENTED_LOCAL_MOCK');

    // Command Center summary shows state, no blockers, and next action.
    expect(run.commandCenter.workflowState).toBe('monthly_report_updated');
    expect(run.commandCenter.blockers).toHaveLength(0);
    expect(run.commandCenter.approvalState).toBe('approved');
    expect(run.commandCenter.writebackState).toBe('recorded_mock_intent');
    expect(run.commandCenter.proofReceiptId).toBe(run.proofReceipt.receiptId);
    expect(run.commandCenter.nextAction).toContain('mock-only');

    // Monthly report input counts the run as allowed and approved.
    const snapshot = monthlyReport.snapshot();
    expect(snapshot.totalRuns).toBe(1);
    expect(snapshot.allowedMockOnly).toBe(1);
    expect(snapshot.humanApprovedNextSteps).toBe(1);

    // Ledger is intact and contains the full audit trail.
    expect(run.ledger.verifyChain()).toBe(true);
    expect(run.ledger.eventsOfType('connector_writeback_recorded')).toHaveLength(1);
  });
});

describe('Sales Closer workflow engine — blocked paths (fail closed)', () => {
  it('blocks on missing consent and still generates a proof receipt', () => {
    const { base } = harness();
    const run = runSalesCloserWorkflow({
      ...base,
      lead: fixtureLead('bw_blocked_missing_consent'),
    });
    expect(run.status).toBe('blocked');
    expect(run.blockedReason?.code).toBe('CONSENT_MISSING');
    expect(run.blockedAtState).toBe('source_rights_checked');
    expect(run.proofReceipt.policyDecision).toBe('blocked');
    expect(run.proofReceipt.blockedReason?.code).toBe('CONSENT_MISSING');
    expect(run.commandCenter.blockers[0]?.code).toBe('CONSENT_MISSING');
    expect(run.commandCenter.nextAction).toContain('consent');
    expect(run.writeback).toBeNull();
  });

  it('blocks on unknown source rights', () => {
    const { base } = harness();
    const run = runSalesCloserWorkflow({
      ...base,
      lead: fixtureLead('bw_blocked_unknown_source_rights'),
    });
    expect(run.status).toBe('blocked');
    expect(run.blockedReason?.code).toBe('SOURCE_RIGHTS_UNKNOWN');
    expect(run.proofReceipt.policyDecision).toBe('blocked');
  });

  it('blocks when no human approval exists — writeback never happens', () => {
    const { connectors, base } = harness();
    const run = runSalesCloserWorkflow({ ...base, lead: fixtureLead('bw_happy_path_mock_only') });
    expect(run.status).toBe('blocked');
    expect(run.blockedReason?.code).toBe('HUMAN_APPROVAL_MISSING');
    expect(run.blockedAtState).toBe('human_approval_required');
    expect(run.writeback).toBeNull();
    expect(connectors.recordedIntents()).toHaveLength(0);
    expect(run.proofReceipt.approval).toBeNull();
    expect(run.commandCenter.approvalState).toBe('missing');
  });

  it('caller-supplied approval fields on the lead payload cannot satisfy the gate', () => {
    const { base } = harness();
    const lead = {
      ...fixtureLead('bw_happy_path_mock_only'),
      humanApproved: true,
      humanApprovalStatus: 'approved',
      approval: { decision: 'approved', approvedBy: 'attacker' },
    };
    const run = runSalesCloserWorkflow({ ...base, lead });
    expect(run.status).toBe('blocked');
    expect(run.blockedReason?.code).toBe('HUMAN_APPROVAL_MISSING');
  });

  it('blocks a forged approval object and reports it as forged', () => {
    const { base } = harness();
    const forged = {
      approvalId: 'appr-0001',
      leadId: 'bw-fake-lead-0001',
      decision: 'approved',
      approvedBy: 'attacker',
      note: null,
      issuedAt: '2026-07-03T10:00:00.000Z',
      token: 'forged-token',
    };
    const run = runSalesCloserWorkflow({
      ...base,
      lead: fixtureLead('bw_happy_path_mock_only'),
      claimedApproval: forged,
    });
    expect(run.status).toBe('blocked');
    expect(run.blockedReason?.code).toBe('FORGED_APPROVAL_REJECTED');
    expect(run.commandCenter.approvalState).toBe('forged');
    expect(run.commandCenter.nextAction).toContain('forged');
    expect(run.writeback).toBeNull();
  });

  it('respects a human denial', () => {
    const { approvals, base } = harness();
    approvals.issue({
      leadId: 'bw-fake-lead-0001',
      decision: 'denied',
      approvedBy: 'operator_fixture_01',
    });
    const run = runSalesCloserWorkflow({ ...base, lead: fixtureLead('bw_happy_path_mock_only') });
    expect(run.status).toBe('blocked');
    expect(run.blockedReason?.code).toBe('HUMAN_APPROVAL_DENIED');
    expect(run.finalState).toBe('human_denied');
  });

  it('respects a human hold', () => {
    const { approvals, base } = harness();
    approvals.issue({
      leadId: 'bw-fake-lead-0001',
      decision: 'hold',
      approvedBy: 'operator_fixture_01',
    });
    const run = runSalesCloserWorkflow({ ...base, lead: fixtureLead('bw_happy_path_mock_only') });
    expect(run.status).toBe('blocked');
    expect(run.blockedReason?.code).toBe('HUMAN_APPROVAL_HOLD');
  });

  it('blocks a live/customer data mode at intake', () => {
    const { base } = harness();
    const lead = { ...fixtureLead('bw_happy_path_mock_only'), dataMode: 'live_customer' };
    const run = runSalesCloserWorkflow({ ...base, lead });
    expect(run.status).toBe('blocked');
    expect(run.blockedReason?.code).toBe('LIVE_DATA_MODE_REJECTED');
    expect(run.lead).toBeNull();
    expect(run.proofReceipt.policyDecision).toBe('blocked');
  });

  it('blocks malformed lead payloads at intake and still produces a receipt', () => {
    const { base } = harness();
    const run = runSalesCloserWorkflow({ ...base, lead: { nonsense: true } });
    expect(run.status).toBe('blocked');
    expect(run.blockedReason?.code).toBe('LEAD_SCHEMA_INVALID');
    expect(run.proofReceipt.receiptId).toBeTruthy();
    expect(run.commandCenter.proofReceiptId).toBe(run.proofReceipt.receiptId);
  });

  it('refuses to run design-only verticals (no adapter)', () => {
    const { base } = harness();
    const lead = { ...fixtureLead('bw_happy_path_mock_only'), vertical: 'skillocate' };
    const run = runSalesCloserWorkflow({ ...base, lead });
    expect(run.status).toBe('blocked');
    expect(run.blockedReason?.code).toBe('VERTICAL_ADAPTER_NOT_AVAILABLE');
  });

  it('disqualifies out-of-vertical leads without external action', () => {
    const { base } = harness();
    const run = runSalesCloserWorkflow({
      ...base,
      lead: fixtureLead('bw_disqualified_out_of_vertical'),
    });
    expect(run.status).toBe('blocked');
    expect(run.blockedReason?.code).toBe('LEAD_DISQUALIFIED');
    expect(run.qualification?.status).toBe('disqualified');
    expect(run.writeback).toBeNull();
  });

  it('blocks when the adapter connector is not mock_only, even with approval', () => {
    const { approvals, connectors, base } = harness();
    approvals.issue({
      leadId: 'bw-fake-lead-0001',
      decision: 'approved',
      approvedBy: 'operator_fixture_01',
    });
    // Re-register the CRM connector in a live-leaning state to prove the deny rule.
    const crm = connectors.get('crm_mock');
    expect(crm).toBeDefined();
    if (crm) connectors.register({ ...crm, state: 'live_blocked' });
    const run = runSalesCloserWorkflow({ ...base, lead: fixtureLead('bw_happy_path_mock_only') });
    expect(run.status).toBe('blocked');
    expect(run.blockedReason?.code).toBe('CONNECTOR_LIVE_BLOCKED');
    expect(run.blockedAtState).toBe('mock_writeback_recorded');
    expect(connectors.recordedIntents()).toHaveLength(0);
    // The blocked attempt is itself proof.
    expect(run.ledger.eventsOfType('connector_blocked')).toHaveLength(1);
  });
});

describe('Sales Closer workflow engine — router output is advisory only', () => {
  it('router output claiming approval cannot change gate outcomes', () => {
    const { base } = harness();
    const clock = fixedClock();
    const router = new ModelRouterHarness({ clock, idFactory: sequentialIds('route') });
    // No approval issued; router runs in mock mode during qualification.
    const run = runSalesCloserWorkflow({
      ...base,
      lead: fixtureLead('bw_happy_path_mock_only'),
      router,
    });
    expect(run.aiAssist?.status).toBe('completed');
    // Even with model output present, the approval gate still fails closed.
    expect(run.status).toBe('blocked');
    expect(run.blockedReason?.code).toBe('HUMAN_APPROVAL_MISSING');
  });

  it('proof receipt is generated on every run: allowed and blocked alike', () => {
    const { approvals, base } = harness();
    const blockedRun = runSalesCloserWorkflow({
      ...base,
      lead: fixtureLead('bw_blocked_missing_consent'),
    });
    approvals.issue({
      leadId: 'bw-fake-lead-0001',
      decision: 'approved',
      approvedBy: 'operator_fixture_01',
    });
    const allowedRun = runSalesCloserWorkflow({
      ...base,
      lead: fixtureLead('bw_happy_path_mock_only'),
    });
    for (const run of [blockedRun, allowedRun]) {
      expect(run.proofReceipt.receiptId).toBeTruthy();
      expect(run.ledger.eventsOfType('proof_receipt_generated')).toHaveLength(1);
    }
    expect(blockedRun.proofReceipt.policyDecision).toBe('blocked');
    expect(allowedRun.proofReceipt.policyDecision).toBe('allowed_mock_only');
  });
});
