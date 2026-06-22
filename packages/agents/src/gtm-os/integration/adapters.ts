/**
 * Integration adapters — Sales Closer GTM, integration-hardening lane.
 *
 * These are pure READ-MODEL adapters. They map the canonical B1 run packet
 * ({@link GtmRunPacket}, from `../assembly`) onto the *input* shapes that the
 * sibling lanes already accept, WITHOUT importing or rewriting those lanes'
 * logic:
 *
 *   - {@link toWorkflowRunSummary} → the TrustOps (B5) analytics unit.
 *   - {@link projectCrmLite} → drives the CRM-lite (B3) entity graph + timeline.
 *   - {@link deriveOpportunityStage} → an honest opportunity stage from the run.
 *
 * Every adapter is pure (given an injected clock) and emits NO raw PII: the run
 * packet's prospect is already PII-safe, and the CRM projection records only
 * non-PII roles, opaque refs, and generic phase summaries. This module imports
 * only `@cognitia/core` types and the sibling lane modules — never a network /
 * vendor / DB primitive.
 */

import type { GtmRunPacket } from '../assembly/index.js';
import {
  MockCrmLite,
  type Company,
  type Contact,
  type CrmLiteDeps,
  type Opportunity,
  type OpportunityStage,
} from '../../crm-lite/mockCrmLite.js';
import type { TimelineEvent } from '../../crm-lite/timeline.js';
import type { WorkflowRunSummary } from '../../trustops/metrics.js';

/**
 * Map a finished run packet onto the TrustOps {@link WorkflowRunSummary} input.
 *
 * Honest by construction: outcomes are `undefined` for any boundary the run
 * never reached (e.g. approval is `undefined` when compliance blocked first),
 * so the funnel counts only what actually happened.
 */
export function toWorkflowRunSummary(packet: GtmRunPacket): WorkflowRunSummary {
  const compliance = packet.compliance.blocked ? 'blocked' : 'pass';

  // Approval is only meaningful once compliance passed; otherwise it never ran.
  const approval = packet.compliance.blocked ? undefined : packet.approval.status;

  // Appointment: failed if the run halted there, requested if it was reached.
  let appointment: WorkflowRunSummary['appointment'];
  if (packet.finalState === 'blocked_appointment') appointment = 'failed';
  else if (packet.appointment.requested) appointment = 'requested';

  // CRM (mock): ok when written, failed if the run halted at the CRM boundary.
  let crm: WorkflowRunSummary['crm'];
  if (packet.crm.written) crm = 'ok';
  else if (packet.finalState === 'blocked_crm') crm = 'failed';

  return {
    runId: packet.prospect.id,
    tenant: packet.workspace.workspaceId,
    status: packet.status,
    compliance,
    approval,
    appointment,
    crm,
    proofEventsRecorded: packet.proofs.length,
    blockedReason: packet.blockedReason,
  };
}

/**
 * Derive an honest CRM opportunity stage from the run's terminal disposition.
 * A rejected lead is `lost`; a compliance/approval halt stays a `lead`; a run
 * that reached the appointment is `appointment_set`; a completed run that wrote
 * back + produced a proposal proof is `proposal`.
 */
export function deriveOpportunityStage(packet: GtmRunPacket): OpportunityStage {
  if (packet.finalState === 'blocked_approval') return 'lost';
  if (packet.status === 'completed' || packet.crm.written) return 'proposal';
  if (packet.appointment.requested) return 'appointment_set';
  return 'lead';
}

/** The CRM-lite read model projected from a single run. PII-safe by construction. */
export interface CrmLiteProjection {
  companies: Company[];
  contacts: Contact[];
  opportunities: Opportunity[];
  timeline: TimelineEvent[];
}

/**
 * Project a run packet into the CRM-lite (B3) entity graph + operator timeline.
 *
 * Idempotent and PII-safe: it upserts a company / contact / opportunity for the
 * prospect and records one timeline event per workflow phase that occurred,
 * using only non-PII roles, opaque refs, and generic phase summaries. Returns
 * the resulting read model. The `MockCrmLite` instance is created internally
 * (in-memory; not a database) so the projection is self-contained.
 */
export function projectCrmLite(packet: GtmRunPacket, deps: CrmLiteDeps = {}): CrmLiteProjection {
  const crm = new MockCrmLite(deps);
  const workspaceId = packet.workspace.workspaceId;
  const prospectId = packet.prospect.id;

  const company = crm.upsertCompany({
    workspaceId,
    companyName: packet.prospect.companyName,
    attributes: {
      city: packet.prospect.city,
      provinceOrState: packet.prospect.provinceOrState,
      country: packet.prospect.country,
      businessType: packet.prospect.businessType,
      sourceRisk: packet.prospect.sourceRisk,
    },
  });

  crm.upsertContact({
    workspaceId,
    prospectId,
    companyId: company.id,
    role: packet.prospect.contactRole,
  });

  crm.upsertOpportunity({
    workspaceId,
    prospectId,
    companyId: company.id,
    stage: deriveOpportunityStage(packet),
  });

  // One timeline event per phase the run actually walked. Summaries are generic
  // and carry no PII; the CRM timeline's own guard would reject raw PII anyway.
  const t = crm.timeline;
  t.record({
    workspaceId,
    prospectId,
    kind: 'compliance',
    outcome: packet.compliance.blocked ? 'blocked' : 'pass',
    summary: packet.compliance.blocked
      ? 'Compliance gate blocked the run.'
      : 'Compliance gate passed.',
  });

  if (!packet.compliance.blocked) {
    t.record({
      workspaceId,
      prospectId,
      kind: 'approval',
      outcome: packet.approval.status,
      summary: `Human approval gate: ${packet.approval.status}.`,
    });
  }

  if (packet.appointment.requested || packet.finalState === 'blocked_appointment') {
    t.record({
      workspaceId,
      prospectId,
      kind: 'appointment',
      outcome: packet.appointment.requested ? 'ok' : 'blocked',
      summary: packet.appointment.requested
        ? 'Appointment requested (mock).'
        : 'Appointment request blocked.',
    });
  }

  if (packet.crm.written || packet.finalState === 'blocked_crm') {
    t.record({
      workspaceId,
      prospectId,
      kind: 'crm_writeback',
      outcome: packet.crm.written ? 'ok' : 'blocked',
      summary: packet.crm.written ? 'CRM writeback recorded (mock).' : 'CRM writeback blocked.',
    });
  }

  for (const proof of packet.proofs) {
    t.record({
      workspaceId,
      prospectId,
      kind: 'proof',
      outcome: 'info',
      summary: `Proof event recorded: ${proof.kind}.`,
    });
  }

  return {
    companies: crm.listCompanies(workspaceId),
    contacts: crm.listContacts(workspaceId),
    opportunities: crm.listOpportunities(workspaceId),
    timeline: crm.readTimeline({ workspaceId }),
  };
}
