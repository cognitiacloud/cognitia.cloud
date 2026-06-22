import { describe, expect, it } from 'vitest';
import {
  appointmentStatusLabel,
  canApprove,
  canReject,
  crmStatusLabel,
  GTM_OS_SCENARIOS,
  proofReceipt,
  runTimeline,
  selectRun,
} from './gtmOsConsoleViewModel.js';

const byId = (id: string) => {
  const s = GTM_OS_SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(`missing scenario ${id}`);
  return s;
};

const CLEAN = 'northwind';
const BLOCKED = 'cypress';

describe('fixtures', () => {
  it('provides a clean, a blocked, and a second clean scenario', () => {
    expect(GTM_OS_SCENARIOS).toHaveLength(3);
    expect(byId(CLEAN).blocked).toBe(false);
    expect(byId(BLOCKED).blocked).toBe(true);
  });

  it('exposes only PII-safe lead detail (masked contact, never raw email/phone)', () => {
    const lead = byId(CLEAN).leadDetail;
    expect(lead.contactEmailMasked).toContain('***');
    expect(lead.contactPhoneMasked).toContain('***');
    expect(lead.contactDomain).toContain('example.com');
    expect(lead).not.toHaveProperty('contactEmail');
    expect(lead).not.toHaveProperty('contactPhone');
  });
});

describe('compliance / blocked reasons', () => {
  it('blocked scenario carries reasons and a compliance_blocked terminal run', () => {
    const s = byId(BLOCKED);
    expect(s.blockedReasons.length).toBeGreaterThan(0);
    expect(s.compliance.passed).toBe(false);
    expect(s.pendingRun.finalState).toBe('compliance_blocked');
  });

  it('clean scenario passes compliance and awaits human approval', () => {
    const s = byId(CLEAN);
    expect(s.compliance.passed).toBe(true);
    expect(s.pendingRun.finalState).toBe('awaiting_human_approval');
  });
});

describe('approve / reject gating', () => {
  it('allows approving a clean, undecided run', () => {
    expect(canApprove(byId(CLEAN), 'pending').allowed).toBe(true);
    expect(canReject(byId(CLEAN), 'pending').allowed).toBe(true);
  });

  it('a blocked lead can never be approved or rejected', () => {
    const s = byId(BLOCKED);
    expect(canApprove(s, 'pending').allowed).toBe(false);
    expect(canApprove(s, 'pending').reason).toMatch(/blocked/i);
    expect(canReject(s, 'pending').allowed).toBe(false);
    // No outcome runs exist for a blocked scenario.
    expect(s.outcomes.approve).toBeNull();
    expect(s.outcomes.reject).toBeNull();
  });

  it('re-deciding is gated once a decision is recorded', () => {
    expect(canApprove(byId(CLEAN), 'approve').allowed).toBe(false);
    expect(canReject(byId(CLEAN), 'reject').allowed).toBe(false);
  });
});

describe('selectRun + outcomes drive the spine-shaped run', () => {
  it('approve selects the full pipeline run ending in proof_ready', () => {
    const s = byId(CLEAN);
    const run = selectRun(s, 'approve');
    expect(run.finalState).toBe('proof_ready');
    expect(run.appointment).not.toBeNull();
    expect(run.crmRecord).not.toBeNull();
    expect(run.proofReport.humanApproved).toBe(true);
  });

  it('reject selects a run ending in rejected with no appointment/CRM', () => {
    const run = selectRun(byId(CLEAN), 'reject');
    expect(run.finalState).toBe('rejected');
    expect(run.appointment).toBeNull();
    expect(run.crmRecord).toBeNull();
  });

  it('pending selects the baseline run', () => {
    expect(selectRun(byId(CLEAN), 'pending').finalState).toBe('awaiting_human_approval');
  });
});

describe('run timeline', () => {
  it('marks visited states reached and the last state current', () => {
    const run = selectRun(byId(CLEAN), 'approve');
    const timeline = runTimeline(run);
    const proof = timeline.find((t) => t.state === 'proof_ready');
    expect(proof?.reached).toBe(true);
    expect(proof?.current).toBe(true);
    // A state never visited on this run is not marked reached.
    const rejected = timeline.find((t) => t.state === 'rejected');
    expect(rejected === undefined || rejected.reached === false).toBe(true);
  });

  it('blocked run surfaces the compliance_blocked terminal as reached', () => {
    const timeline = runTimeline(byId(BLOCKED).pendingRun);
    const blocked = timeline.find((t) => t.state === 'compliance_blocked');
    expect(blocked?.reached).toBe(true);
    expect(blocked?.current).toBe(true);
  });
});

describe('mock-safe display helpers', () => {
  it('CRM and appointment labels always mark themselves mock', () => {
    const run = selectRun(byId(CLEAN), 'approve');
    expect(crmStatusLabel(run).toLowerCase()).toContain('mock');
    expect(appointmentStatusLabel(run).toLowerCase()).toContain('mock');
  });

  it('proof receipt is ready only for the approved (proof_ready) run', () => {
    expect(proofReceipt(selectRun(byId(CLEAN), 'approve')).ready).toBe(true);
    expect(proofReceipt(selectRun(byId(CLEAN), 'pending')).ready).toBe(false);
    expect(proofReceipt(byId(BLOCKED).pendingRun).ready).toBe(false);
  });
});
