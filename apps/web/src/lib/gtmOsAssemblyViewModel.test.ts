import { describe, it, expect } from 'vitest';
import { toGtmAssemblyConsoleView, type GtmRunPacketView } from './gtmOsAssemblyViewModel.js';

/**
 * A completed mock-safe packet fixture. Mirrors the shape produced by the
 * agents-side `assembleGtmRunPacket`; business-only, `.example` domain, no raw
 * PII. The view-model is intentionally decoupled from `@cognitia/agents` (no
 * cross-package import), so the fixture is declared structurally here.
 */
function packet(over: Partial<GtmRunPacketView> = {}): GtmRunPacketView {
  return {
    mode: 'mock',
    workspace: { workspaceId: 'budget_wheels_demo', sandbox: true },
    prospect: {
      id: '22222222-2222-2222-2222-222222222220',
      companyName: 'Lakeshore Motors',
      sourceRisk: 'low',
      consentStatus: 'implied_possible',
      fitScore: 0,
    },
    status: 'completed',
    finalState: 'completed',
    compliance: { passed: true, blocked: false },
    approval: { status: 'approved' },
    appointment: { requested: true },
    crm: { written: true },
    proofs: [
      { kind: 'gtm.discovery.booked.v1', summaryPublic: 'Appointment requested.' },
      { kind: 'gtm.proposal.generated.v1', summaryPublic: 'CRM record written (mock).' },
    ],
    timeline: [
      { step: 1, phase: 'Lead received', outcome: 'advanced' },
      { step: 2, phase: 'Compliance check', outcome: 'advanced' },
      { step: 3, phase: 'Human approval gate', outcome: 'advanced' },
      { step: 4, phase: 'Appointment requested', outcome: 'advanced' },
      { step: 5, phase: 'CRM writeback (mock)', outcome: 'advanced' },
      { step: 6, phase: 'Proof report', outcome: 'advanced' },
    ],
    noEgress: {
      liveSendOccurred: false,
      statement: 'MOCK/SANDBOX: no live egress occurred.',
    },
    ...over,
  };
}

describe('gtm-os assembly console view-model', () => {
  it('maps a completed packet to a success console view', () => {
    const view = toGtmAssemblyConsoleView(packet());
    expect(view.workspaceId).toBe('budget_wheels_demo');
    expect(view.sandbox).toBe(true);
    expect(view.company).toBe('Lakeshore Motors');
    expect(view.badge).toEqual({ label: 'Completed', tone: 'success' });
    expect(view.complianceLabel).toBe('Cleared');
    expect(view.approvalLabel).toBe('Approved by human');
    expect(view.proofCount).toBe(2);
    expect(view.timeline).toHaveLength(6);
    expect(view.blockedReason).toBeNull();
    expect(view.mockSafe).toBe(true);
  });

  it('surfaces a blocked-compliance halt with a danger badge + reason', () => {
    const view = toGtmAssemblyConsoleView(
      packet({
        status: 'blocked',
        finalState: 'blocked_compliance',
        blockedReason: 'legal review',
        compliance: { passed: false, blocked: true, reason: 'legal review' },
        approval: { status: 'pending' },
        appointment: { requested: false },
        crm: { written: false },
        proofs: [],
        timeline: [
          { step: 1, phase: 'Lead received', outcome: 'advanced' },
          { step: 2, phase: 'Compliance check', outcome: 'blocked' },
        ],
      }),
    );
    expect(view.badge).toEqual({ label: 'Blocked', tone: 'danger' });
    expect(view.blockedReason).toBe('legal review');
    expect(view.complianceLabel).toBe('Blocked — legal review');
    expect(view.proofCount).toBe(0);
    expect(view.timeline.at(-1)?.outcome).toBe('blocked');
  });

  it('surfaces a rejected approval', () => {
    const view = toGtmAssemblyConsoleView(
      packet({
        status: 'blocked',
        finalState: 'blocked_approval',
        approval: { status: 'rejected', reason: 'not a fit' },
        proofs: [],
      }),
    );
    expect(view.badge.tone).toBe('danger');
    expect(view.approvalLabel).toBe('Rejected — not a fit');
  });

  it('surfaces a pending approval with a warning badge', () => {
    const view = toGtmAssemblyConsoleView(
      packet({
        status: 'awaiting_approval',
        finalState: 'human_approval_required',
        approval: { status: 'pending' },
        appointment: { requested: false },
        crm: { written: false },
        proofs: [],
        timeline: [
          { step: 1, phase: 'Lead received', outcome: 'advanced' },
          { step: 2, phase: 'Compliance check', outcome: 'advanced' },
          { step: 3, phase: 'Human approval gate', outcome: 'halted' },
        ],
      }),
    );
    expect(view.badge).toEqual({ label: 'Awaiting approval', tone: 'warning' });
    expect(view.approvalLabel).toBe('Pending human review');
    expect(view.timeline.at(-1)?.outcome).toBe('halted');
  });

  it('reports mockSafe=false if an egress attestation is ever violated', () => {
    const view = toGtmAssemblyConsoleView(
      packet({ noEgress: { liveSendOccurred: true, statement: 'tampered' } }),
    );
    expect(view.mockSafe).toBe(false);
  });

  it('emits no raw PII (no email) in the rendered view', () => {
    const view = toGtmAssemblyConsoleView(packet());
    expect(JSON.stringify(view)).not.toMatch(/@/);
  });
});
