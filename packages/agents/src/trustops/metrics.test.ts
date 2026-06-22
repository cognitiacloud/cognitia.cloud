import { describe, expect, it } from 'vitest';
import {
  classifyBlockStage,
  computeTrustOpsMetrics,
  computeTrustScore,
  type WorkflowRunSummary,
} from './metrics.js';

/** A fully happy, completed run (mock/sandbox). */
function happyRun(runId: string): WorkflowRunSummary {
  return {
    runId,
    tenant: 'budget_wheels_demo',
    status: 'completed',
    compliance: 'pass',
    approval: 'approved',
    appointment: 'succeeded',
    crm: 'ok',
    proofEventsRecorded: 2,
  };
}

describe('computeTrustOpsMetrics — funnel', () => {
  it('counts a single happy completed run', () => {
    const m = computeTrustOpsMetrics([happyRun('r1')]);
    expect(m.funnel).toMatchObject({
      leadsReceived: 1,
      compliancePass: 1,
      complianceBlock: 0,
      approvalApproved: 1,
      appointmentRequested: 1,
      appointmentSucceeded: 1,
      crmWritten: 1,
      proofEventsRecorded: 2,
      completed: 1,
      blocked: 0,
      awaitingApproval: 0,
    });
    expect(m.approvalCoverage).toBe(1);
  });

  it('counts compliance-blocked runs', () => {
    const run: WorkflowRunSummary = {
      runId: 'r1',
      status: 'blocked',
      compliance: 'blocked',
      blockedReason: 'prospect is not contactable',
    };
    const m = computeTrustOpsMetrics([run]);
    expect(m.funnel.complianceBlock).toBe(1);
    expect(m.funnel.compliancePass).toBe(0);
    expect(m.funnel.blocked).toBe(1);
    expect(m.blockedReasons).toEqual([
      { stage: 'compliance', reason: 'prospect is not contactable', count: 1 },
    ]);
  });

  it('counts rejected approval as blocked at the approval stage', () => {
    const run: WorkflowRunSummary = {
      runId: 'r1',
      status: 'blocked',
      compliance: 'pass',
      approval: 'rejected',
      blockedReason: 'human rejected outreach',
    };
    const m = computeTrustOpsMetrics([run]);
    expect(m.funnel.approvalRejected).toBe(1);
    expect(classifyBlockStage(run)).toBe('approval');
    expect(m.blockedReasons[0]).toMatchObject({ stage: 'approval', count: 1 });
  });

  it('counts pending approval as awaiting_approval', () => {
    const run: WorkflowRunSummary = {
      runId: 'r1',
      status: 'awaiting_approval',
      compliance: 'pass',
      approval: 'pending',
    };
    const m = computeTrustOpsMetrics([run]);
    expect(m.funnel.approvalPending).toBe(1);
    expect(m.funnel.awaitingApproval).toBe(1);
    // pending reached the gate but got no decision → coverage 0.
    expect(m.approvalCoverage).toBe(0);
  });

  it('counts appointment / crm / proof block stages', () => {
    const apptFail: WorkflowRunSummary = {
      runId: 'a',
      status: 'blocked',
      compliance: 'pass',
      approval: 'approved',
      appointment: 'failed',
      blockedReason: 'scheduler unavailable',
    };
    const crmFail: WorkflowRunSummary = {
      runId: 'c',
      status: 'blocked',
      compliance: 'pass',
      approval: 'approved',
      appointment: 'requested',
      crm: 'failed',
      blockedReason: 'crm write failed',
    };
    const proofFail: WorkflowRunSummary = {
      runId: 'p',
      status: 'blocked',
      compliance: 'pass',
      approval: 'approved',
      appointment: 'requested',
      crm: 'ok',
      blockedReason: 'proof ledger unavailable',
    };
    expect(classifyBlockStage(apptFail)).toBe('appointment');
    expect(classifyBlockStage(crmFail)).toBe('crm');
    expect(classifyBlockStage(proofFail)).toBe('proof');
    const m = computeTrustOpsMetrics([apptFail, crmFail, proofFail]);
    expect(m.funnel.blocked).toBe(3);
    expect(m.blockedReasons).toHaveLength(3);
  });

  it('groups identical blocked reasons and sorts by count desc', () => {
    const mk = (id: string): WorkflowRunSummary => ({
      runId: id,
      status: 'blocked',
      compliance: 'blocked',
      blockedReason: 'not contactable',
    });
    const other: WorkflowRunSummary = {
      runId: 'x',
      status: 'blocked',
      compliance: 'pass',
      approval: 'rejected',
      blockedReason: 'rejected',
    };
    const m = computeTrustOpsMetrics([mk('a'), mk('b'), other]);
    expect(m.blockedReasons[0]).toEqual({
      stage: 'compliance',
      reason: 'not contactable',
      count: 2,
    });
    expect(m.blockedReasons[1]!.count).toBe(1);
  });

  it('handles empty input deterministically', () => {
    const m = computeTrustOpsMetrics([]);
    expect(m.funnel.leadsReceived).toBe(0);
    expect(m.blockedReasons).toEqual([]);
    expect(m.approvalCoverage).toBe(1);
    expect(m.egress.noLiveEgress).toBe(true);
  });

  it('labels missing blocked reason as (unspecified)', () => {
    const run: WorkflowRunSummary = {
      runId: 'r',
      status: 'blocked',
      compliance: 'blocked',
    };
    const m = computeTrustOpsMetrics([run]);
    expect(m.blockedReasons[0]!.reason).toBe('(unspecified)');
  });

  it('is deterministic across repeated calls', () => {
    const runs = [happyRun('r1'), happyRun('r2')];
    expect(computeTrustOpsMetrics(runs)).toEqual(computeTrustOpsMetrics(runs));
  });

  it('always carries a no-live-egress attestation', () => {
    const m = computeTrustOpsMetrics([happyRun('r1')]);
    expect(m.egress).toMatchObject({ noLiveEgress: true, mode: 'MOCK_SANDBOX' });
    expect(m.egress.statement).toMatch(/no live network egress/i);
  });
});

describe('computeTrustScore', () => {
  it('gives a perfect score for all-happy runs', () => {
    const m = computeTrustOpsMetrics([happyRun('r1'), happyRun('r2')]);
    const s = computeTrustScore(m);
    expect(s.score).toBe(100);
    expect(s.components.reduce((sum, c) => sum + c.weight, 0)).toBe(100);
    expect(s.components.reduce((sum, c) => sum + c.earned, 0)).toBe(100);
  });

  it('penalizes pending (uncovered) approvals', () => {
    const pending: WorkflowRunSummary = {
      runId: 'p',
      status: 'awaiting_approval',
      compliance: 'pass',
      approval: 'pending',
    };
    const s = computeTrustScore(computeTrustOpsMetrics([pending]));
    const approval = s.components.find((c) => c.key === 'approvalCoverage');
    expect(approval?.earned).toBe(0);
    expect(s.score).toBeLessThan(100);
  });

  it('keeps egressClean at full weight', () => {
    const s = computeTrustScore(computeTrustOpsMetrics([happyRun('r1')]));
    const egress = s.components.find((c) => c.key === 'egressClean');
    expect(egress?.earned).toBe(egress?.weight);
  });

  it('reduces proof coverage when completed runs lack proof events', () => {
    const noProof: WorkflowRunSummary = {
      runId: 'r',
      status: 'completed',
      compliance: 'pass',
      approval: 'approved',
      appointment: 'succeeded',
      crm: 'ok',
      proofEventsRecorded: 0,
    };
    const s = computeTrustScore(computeTrustOpsMetrics([noProof]));
    const proof = s.components.find((c) => c.key === 'proofCoverage');
    expect(proof?.earned).toBe(0);
  });

  it('clamps score into [0, 100]', () => {
    const s = computeTrustScore(computeTrustOpsMetrics([]));
    expect(s.score).toBeGreaterThanOrEqual(0);
    expect(s.score).toBeLessThanOrEqual(100);
  });
});

describe('PII safety', () => {
  it('metrics contain no raw PII fields', () => {
    const run: WorkflowRunSummary = {
      runId: 'r1',
      status: 'completed',
      compliance: 'pass',
      approval: 'approved',
      appointment: 'succeeded',
      crm: 'ok',
      proofEventsRecorded: 1,
    };
    const json = JSON.stringify(computeTrustOpsMetrics([run]));
    // No emails / phone numbers should ever appear in aggregate metrics.
    expect(json).not.toMatch(/@/);
    expect(json).not.toMatch(/\b\d{3}[-.]\d{3}[-.]\d{4}\b/);
  });
});
