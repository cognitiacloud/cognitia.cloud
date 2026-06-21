import { describe, expect, it } from 'vitest';
import { evaluateCompliance } from './compliance.js';
import { InMemoryCloserCrm } from './crm.js';
import { makeBlockedLeadIntake, makeCloserLeadIntake } from './fixtures.js';
import { runCloserWorkflow } from './runner.js';
import { INITIAL_STATE, isTerminal, transition } from './stateMachine.js';
import type { CloserWorkflowDeps } from './types.js';

/** Deterministic clock + id generator for stable assertions. */
function deterministicDeps(extra: Partial<CloserWorkflowDeps> = {}): CloserWorkflowDeps {
  const fixedNow = new Date('2026-06-21T12:00:00.000Z');
  let n = 0;
  return {
    crm: new InMemoryCloserCrm({ now: () => fixedNow }),
    now: () => fixedNow,
    newId: () => `id-${++n}`,
    ...extra,
  };
}

describe('closer state machine', () => {
  it('starts at received and walks the full happy path', () => {
    let state = INITIAL_STATE;
    expect(state).toBe('received');

    const gate = transition(state, { type: 'RUN_COMPLIANCE_GATE', passed: true });
    expect(gate).toMatchObject({ ok: true, to: 'awaiting_human_approval' });
    state = gate.ok ? gate.to : state;

    const decided = transition(state, { type: 'HUMAN_DECISION', decision: 'approve' });
    state = decided.ok ? decided.to : state;
    expect(state).toBe('approved');

    state = stepOk(state, { type: 'BOOK_APPOINTMENT' });
    expect(state).toBe('appointment_ready');
    state = stepOk(state, { type: 'WRITE_CRM' });
    expect(state).toBe('crm_written');
    state = stepOk(state, { type: 'EMIT_PROOF' });
    expect(state).toBe('proof_ready');
    expect(isTerminal(state)).toBe(true);
  });

  it('routes a failed compliance gate to compliance_blocked (terminal)', () => {
    const res = transition('received', { type: 'RUN_COMPLIANCE_GATE', passed: false });
    expect(res).toMatchObject({ ok: true, to: 'compliance_blocked' });
    expect(isTerminal('compliance_blocked')).toBe(true);
  });

  it('routes a human rejection to rejected (terminal)', () => {
    const res = transition('awaiting_human_approval', {
      type: 'HUMAN_DECISION',
      decision: 'reject',
    });
    expect(res).toMatchObject({ ok: true, to: 'rejected' });
  });

  it('rejects invalid transitions without throwing', () => {
    const fromReceived = transition('received', { type: 'WRITE_CRM' });
    expect(fromReceived.ok).toBe(false);
    if (!fromReceived.ok) expect(fromReceived.reason).toMatch(/WRITE_CRM not allowed/);

    const fromTerminal = transition('proof_ready', { type: 'EMIT_PROOF' });
    expect(fromTerminal.ok).toBe(false);
    if (!fromTerminal.ok) expect(fromTerminal.reason).toMatch(/terminal/);
  });
});

describe('closer compliance gate', () => {
  it('passes a contactable lead and drops raw PII', () => {
    const intake = makeCloserLeadIntake();
    const decision = evaluateCompliance(intake);
    expect(decision.passed).toBe(true);
    // Normalized prospect is PII-safe: hash/mask/domain only, no raw values.
    expect(decision.prospect.contactEmailHash).toBeTruthy();
    expect(decision.prospect.contactDomain).toBe('northwind-auto.example.com');
    expect(JSON.stringify(decision.prospect)).not.toContain('pat@northwind-auto.example.com');
    expect(JSON.stringify(decision.prospect)).not.toContain('555-0100');
  });

  it('blocks do-not-contact, unsubscribed, and do_not_contact consent', () => {
    expect(evaluateCompliance(makeBlockedLeadIntake('do_not_contact')).passed).toBe(false);
    expect(evaluateCompliance(makeBlockedLeadIntake('unsubscribed')).passed).toBe(false);
    expect(evaluateCompliance(makeBlockedLeadIntake('consent_do_not_contact')).passed).toBe(false);
  });
});

describe('closer mock runner', () => {
  it('runs the valid path end-to-end to proof_ready', () => {
    const run = runCloserWorkflow(makeCloserLeadIntake(), deterministicDeps());

    expect(run.finalState).toBe('proof_ready');
    expect(run.history).toEqual([
      'received',
      'awaiting_human_approval',
      'approved',
      'appointment_ready',
      'crm_written',
      'proof_ready',
    ]);
    expect(run.transitions.every((t) => t.ok)).toBe(true);
    expect(run.appointment?.mode).toBe('mock');
    expect(run.crmRecord?.externalId).toBeTruthy();
    expect(run.crmCreated).toBe(true);
    expect(run.proofReport.crmExternalRef).toBe(run.crmRecord?.externalId);
    expect(run.proofReport.proofEvents.length).toBeGreaterThan(0);
    expect(run.proofReport.proofEvents.map((e) => e.kind)).toContain('gtm.discovery.booked.v1');
  });

  it('stops at compliance_blocked and never writes to the CRM', () => {
    const deps = deterministicDeps();
    const run = runCloserWorkflow(makeBlockedLeadIntake('do_not_contact'), deps);

    expect(run.finalState).toBe('compliance_blocked');
    expect(run.history).toEqual(['received', 'compliance_blocked']);
    expect(run.crmRecord).toBeNull();
    expect(run.proofReport.compliancePassed).toBe(false);
    expect(deps.crm.records()).toHaveLength(0);
  });

  it('stops at compliance_blocked for an unsubscribed lead', () => {
    const run = runCloserWorkflow(makeBlockedLeadIntake('unsubscribed'), deterministicDeps());
    expect(run.finalState).toBe('compliance_blocked');
  });

  it('stops at rejected on human rejection and never writes to the CRM', () => {
    const deps = deterministicDeps({ decision: 'reject' });
    const run = runCloserWorkflow(makeCloserLeadIntake(), deps);

    expect(run.finalState).toBe('rejected');
    expect(run.history).toEqual(['received', 'awaiting_human_approval', 'rejected']);
    expect(run.crmRecord).toBeNull();
    expect(run.proofReport.humanApproved).toBe(false);
    expect(deps.crm.records()).toHaveLength(0);
  });

  it('is idempotent: a replay reuses the CRM record, no duplicate', () => {
    const crm = new InMemoryCloserCrm({ now: () => new Date('2026-06-21T12:00:00.000Z') });
    const intake = makeCloserLeadIntake();

    const first = runCloserWorkflow(intake, deterministicDeps({ crm }));
    const second = runCloserWorkflow(intake, deterministicDeps({ crm }));

    expect(first.crmCreated).toBe(true);
    expect(second.crmCreated).toBe(false);
    expect(second.crmRecord?.externalId).toBe(first.crmRecord?.externalId);
    expect(crm.records()).toHaveLength(1);
    expect(second.finalState).toBe('proof_ready');
  });

  it('keeps raw PII out of the CRM record and proof report', () => {
    const run = runCloserWorkflow(makeCloserLeadIntake(), deterministicDeps());
    const serialized = JSON.stringify({ crm: run.crmRecord, proof: run.proofReport });
    expect(serialized).not.toContain('pat@northwind-auto.example.com');
    expect(serialized).not.toContain('555-0100');
  });

  it('is deterministic under injected clock and id generator', () => {
    const intake = makeCloserLeadIntake();
    const a = runCloserWorkflow(intake, deterministicDeps());
    const b = runCloserWorkflow(intake, deterministicDeps());

    expect(a.appointment?.appointmentRef).toBe(b.appointment?.appointmentRef);
    expect(a.appointment?.slotStart).toBe(b.appointment?.slotStart);
    expect(a.proofReport.proofEvents.map((e) => e.id)).toEqual(
      b.proofReport.proofEvents.map((e) => e.id),
    );
    expect(a.crmRecord?.externalId).toBe(b.crmRecord?.externalId);
  });
});

/** Helper: assert an event applies and return the next state. */
function stepOk(
  state: Parameters<typeof transition>[0],
  event: Parameters<typeof transition>[1],
): Parameters<typeof transition>[0] {
  const res = transition(state, event);
  if (!res.ok) throw new Error(`expected ok transition: ${res.reason}`);
  return res.to;
}
