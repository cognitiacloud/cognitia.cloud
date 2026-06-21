/**
 * Mock runner for the Sales Closer workflow.
 *
 * Drives a lead through the state machine:
 *   received → compliance gate → human approval → appointment → mock CRM
 *   writeback → proof report.
 *
 * Pure orchestration over injected dependencies: a mock CRM, an optional human
 * decision, and injectable clock/id generators for deterministic tests. It makes
 * NO live vendor or network calls. End-to-end it is idempotent — running the
 * same intake against the same `crm` instance yields the same CRM external ref
 * and a single CRM record.
 */

import { createGtmProofEvent, GTM_OUTREACH_REQUIRES_HUMAN_APPROVAL } from '@cognitia/core';
import type { GtmProofEvent } from '@cognitia/core';
import { contentFingerprint } from '@cognitia/core';
import { randomUUID } from 'node:crypto';
import { evaluateCompliance } from './compliance.js';
import { INITIAL_STATE, transition } from './stateMachine.js';
import type {
  CloserAppointment,
  CloserComplianceDecision,
  CloserCrmRecord,
  CloserLeadIntake,
  CloserProofReport,
  CloserStateTransition,
  CloserWorkflowDeps,
  CloserWorkflowEvent,
  CloserWorkflowRun,
  CloserWorkflowState,
} from './types.js';

const ACTOR_REF = 'agent:closer';
const APPOINTMENT_LEAD_MS = 24 * 60 * 60 * 1000; // book ~1 day out
const APPOINTMENT_DURATION_MS = 30 * 60 * 1000; // 30-minute discovery call

/** Deterministic mock appointment derived from the lead identity + clock. */
function bookMockAppointment(intake: CloserLeadIntake, when: Date): CloserAppointment {
  const start = new Date(when.getTime() + APPOINTMENT_LEAD_MS);
  const end = new Date(start.getTime() + APPOINTMENT_DURATION_MS);
  const appointmentRef = `appt_${contentFingerprint(`${intake.tenantId}:${intake.leadRef}`).slice(0, 16)}`;
  return {
    appointmentRef,
    tenantId: intake.tenantId,
    leadRef: intake.leadRef,
    slotStart: start.toISOString(),
    slotEnd: end.toISOString(),
    mode: 'mock',
  };
}

/**
 * Run a lead through the Sales Closer workflow. Defaults to approving the human
 * gate (happy path); pass `deps.decision = 'reject'` to exercise rejection.
 */
export function runCloserWorkflow(
  intake: CloserLeadIntake,
  deps: CloserWorkflowDeps,
): CloserWorkflowRun {
  const now = deps.now ?? (() => new Date());
  const newId = deps.newId ?? (() => randomUUID());
  // Doctrine: no autonomous outreach — every lead passes the human gate.
  const requiresHumanApproval = GTM_OUTREACH_REQUIRES_HUMAN_APPROVAL;
  const decision = deps.decision ?? 'approve';

  let state: CloserWorkflowState = INITIAL_STATE;
  const history: CloserWorkflowState[] = [state];
  const transitions: CloserStateTransition[] = [];
  const proofEvents: GtmProofEvent[] = [];

  const apply = (event: CloserWorkflowEvent): CloserStateTransition => {
    const result = transition(state, event);
    transitions.push(result);
    if (result.ok) {
      state = result.to;
      history.push(state);
    }
    return result;
  };

  const proof = (
    kind: Parameters<typeof createGtmProofEvent>[0]['kind'],
    subjectId: string,
    summaryPublic: string,
    detailsPrivate?: Record<string, unknown>,
  ): void => {
    proofEvents.push(
      createGtmProofEvent(
        {
          kind,
          subjectType: 'closer_lead',
          subjectId,
          evidenceTag: 'verified_fact',
          summaryPublic,
          detailsPrivate,
          actorRef: ACTOR_REF,
        },
        { id: newId(), occurredAt: now() },
      ),
    );
  };

  const finish = (args: {
    compliance: CloserComplianceDecision;
    appointment: CloserAppointment | null;
    crmRecord: CloserCrmRecord | null;
    crmCreated: boolean;
    humanApproved: boolean;
  }): CloserWorkflowRun => {
    const proofReport: CloserProofReport = {
      tenantId: intake.tenantId,
      leadRef: intake.leadRef,
      finalState: state,
      compliancePassed: args.compliance.passed,
      humanApproved: args.humanApproved,
      appointmentRef: args.appointment?.appointmentRef ?? null,
      crmExternalRef: args.crmRecord?.externalId ?? null,
      states: [...history],
      proofEvents: [...proofEvents],
      generatedAt: now().toISOString(),
      summary: summarize(state, args.compliance),
    };
    return {
      finalState: state,
      history: [...history],
      transitions: [...transitions],
      compliance: args.compliance,
      appointment: args.appointment,
      crmRecord: args.crmRecord,
      crmCreated: args.crmCreated,
      proofReport,
    };
  };

  // 1. Compliance / consent gate.
  const compliance = evaluateCompliance(intake, { now });
  const subjectId = compliance.prospect.id;
  proof(
    'gtm.prospect.sourced.v1',
    subjectId,
    `Lead received for ${compliance.prospect.companyName}` +
      (compliance.prospect.contactDomain ? ` (${compliance.prospect.contactDomain})` : ''),
  );
  apply({ type: 'RUN_COMPLIANCE_GATE', passed: compliance.passed });

  if (!compliance.passed) {
    proof(
      'gtm.outreach.review_required.v1',
      subjectId,
      `Blocked at compliance gate: ${compliance.reason}`,
    );
    return finish({
      compliance,
      appointment: null,
      crmRecord: null,
      crmCreated: false,
      humanApproved: false,
    });
  }

  // 2. Human approval gate (always required — no autonomous path).
  void requiresHumanApproval;
  apply({ type: 'HUMAN_DECISION', decision });
  if (decision === 'reject') {
    proof('gtm.outreach.review_required.v1', subjectId, 'Human reviewer rejected the lead.');
    return finish({
      compliance,
      appointment: null,
      crmRecord: null,
      crmCreated: false,
      humanApproved: false,
    });
  }

  // 3. Appointment booking (mock).
  apply({ type: 'BOOK_APPOINTMENT' });
  const appointment = bookMockAppointment(intake, now());

  // 4. CRM writeback (mock, idempotent).
  apply({ type: 'WRITE_CRM' });
  const { record, created } = deps.crm.writeBack({
    tenantId: intake.tenantId,
    leadRef: intake.leadRef,
    companyName: compliance.prospect.companyName,
    contactDomain: compliance.prospect.contactDomain,
    appointmentRef: appointment.appointmentRef,
    slotStart: appointment.slotStart,
  });

  // 5. Proof report.
  proof(
    'gtm.discovery.booked.v1',
    subjectId,
    `Discovery booked for ${compliance.prospect.companyName}; CRM ref ${record.externalId}`,
    { appointmentRef: appointment.appointmentRef, crmExternalId: record.externalId },
  );
  apply({ type: 'EMIT_PROOF' });

  return finish({
    compliance,
    appointment,
    crmRecord: record,
    crmCreated: created,
    humanApproved: true,
  });
}

function summarize(state: CloserWorkflowState, compliance: CloserComplianceDecision): string {
  switch (state) {
    case 'proof_ready':
      return 'Lead closed through the full pipeline: consent cleared, human-approved, appointment booked, CRM written, proof emitted.';
    case 'compliance_blocked':
      return `Lead blocked at the compliance gate (${compliance.reason}).`;
    case 'rejected':
      return 'Lead cleared compliance but was rejected by the human reviewer.';
    default:
      return `Lead halted in state '${state}'.`;
  }
}
