import type { GtmProspect } from '@cognitia/core';
import {
  blockIfUnsubscribedOrDnc,
  createComplianceProofEvent,
  evaluateChannelEligibility,
  getDefaultChannelPolicy,
  type ComplianceProofEvent,
} from './compliance';
import type { Channel, ChannelEligibility } from './complianceTypes';
import type { DemoProspectRecord } from './complianceFixtures';

/**
 * W4 Operator Console — view-model for the mock-safe Sales Closer workflow.
 *
 * This is the operator's review/gating surface. Pure, deterministic, and
 * side-effect-free: it composes the existing compliance engine (`./compliance`)
 * and demo fixtures (`./complianceFixtures`) into the panels an operator needs —
 * lead detail, an overall compliance badge, blocked reasons, a human
 * approve/reject decision, simulated CRM/appointment status, and a proof report
 * log. It performs NO network calls, NO persistence, and NO sending.
 *
 * Mock-safe doctrine (consistent with `./compliance`):
 *   - Nothing is ever sent autonomously. Approving a workflow only records a
 *     human gating decision and routes the prospect to a human-gated outreach
 *     step — it never triggers outreach or a live CRM write.
 *   - CRM/appointment status are simulated markers only (`crm.written` is always
 *     false; appointments are simulated, never booked).
 *   - Lead detail is PII-safe: it surfaces only `GtmProspect` business/provenance
 *     fields (masked contact, domain, source) — never raw email/phone (the type
 *     does not even carry them).
 */

/** The operator's human gating decision for a fixture workflow. */
export type OperatorDecision = 'pending' | 'approved' | 'rejected';

/** Workflow-level compliance state shown on the badge. Never `allowed` for outreach. */
export type WorkflowComplianceState = 'human_review_required' | 'blocked';

/** PII-safe lead detail projected from a `GtmProspect` for operator display. */
export interface LeadDetailView {
  companyName: string;
  location: string;
  businessType: string | null;
  source: string;
  sourceRisk: GtmProspect['sourceRisk'];
  contactName: string | null;
  contactRole: string | null;
  contactDomain: string | null;
  contactEmailMasked: string | null;
  contactPhoneMasked: string | null;
  contactBasis: GtmProspect['contactBasis'];
  consentStatus: GtmProspect['consentStatus'];
  unsubscribeStatus: GtmProspect['unsubscribeStatus'];
  doNotContact: boolean;
  fitScore: number;
  packageFit: string | null;
  discoveryStatus: GtmProspect['discoveryStatus'];
}

/** Simulated CRM status. `written` is always false — no live CRM writes ever occur. */
export interface CrmMockStatus {
  written: false;
  system: string;
  note: string;
}

/** Simulated appointment status. Never books a real calendar slot. */
export interface AppointmentMockStatus {
  status: 'none' | 'simulated_slot' | 'simulated_confirmed';
  note: string;
}

export type ProofReportState = 'pending' | 'generated';

export interface ProofReportView {
  state: ProofReportState;
  log: ComplianceProofEvent[];
}

/** The full operator-console view for one fixture workflow. */
export interface OperatorWorkflowView {
  id: string;
  lead: LeadDetailView;
  complianceState: WorkflowComplianceState;
  blockedReasons: string[];
  channels: ChannelEligibility[];
  decision: OperatorDecision;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  crm: CrmMockStatus;
  appointment: AppointmentMockStatus;
  proofReport: ProofReportView;
}

/** Whether the operator may approve a workflow view (not blocked, not yet decided). */
export interface ApprovalGate {
  allowed: boolean;
  reason: string | null;
}

const ALL_CHANNELS: readonly Channel[] = [
  'email',
  'phone',
  'sms',
  'whatsapp',
  'ai_voice',
  'linkedin',
  'manual_task',
];

function projectLead(prospect: GtmProspect): LeadDetailView {
  const location = [prospect.city, prospect.provinceOrState, prospect.country]
    .filter((part): part is string => Boolean(part))
    .join(', ');
  return {
    companyName: prospect.companyName,
    location: location || '—',
    businessType: prospect.businessType,
    source: prospect.source,
    sourceRisk: prospect.sourceRisk,
    contactName: prospect.contactName,
    contactRole: prospect.contactRole,
    contactDomain: prospect.contactDomain,
    contactEmailMasked: prospect.contactEmailMasked,
    contactPhoneMasked: prospect.contactPhoneMasked,
    contactBasis: prospect.contactBasis,
    consentStatus: prospect.consentStatus,
    unsubscribeStatus: prospect.unsubscribeStatus,
    doNotContact: prospect.doNotContact,
    fitScore: prospect.fitScore,
    packageFit: prospect.packageFit,
    discoveryStatus: prospect.discoveryStatus,
  };
}

/**
 * Workflow-level compliance summary. A workflow is `blocked` (cannot advance at
 * all) when the prospect is suppressed (do-not-contact / unsubscribed / blocked
 * consent) or the data source is blocked for prospecting. Otherwise it is
 * `human_review_required` — the strongest non-blocked outcome for outreach.
 */
export function summarizeCompliance(record: DemoProspectRecord): {
  state: WorkflowComplianceState;
  blockedReasons: string[];
  channels: ChannelEligibility[];
} {
  const { prospect, evidence } = record;
  const policy = getDefaultChannelPolicy();
  const channels = ALL_CHANNELS.map((channel) =>
    evaluateChannelEligibility(prospect, channel, evidence, policy),
  );

  const suppression = blockIfUnsubscribedOrDnc(prospect);
  if (suppression) {
    return { state: 'blocked', blockedReasons: suppression.reasons, channels };
  }
  if (prospect.sourceRisk === 'blocked') {
    return {
      state: 'blocked',
      blockedReasons: ['Data source is blocked for prospecting.'],
      channels,
    };
  }
  return { state: 'human_review_required', blockedReasons: [], channels };
}

function appointmentForDiscovery(prospect: GtmProspect): AppointmentMockStatus {
  if (prospect.discoveryStatus === 'booked') {
    return { status: 'simulated_confirmed', note: 'Mock — simulated confirmation, not booked.' };
  }
  if (prospect.discoveryStatus === 'qualified' || prospect.discoveryStatus === 'researching') {
    return { status: 'simulated_slot', note: 'Mock — proposed slot only, nothing booked.' };
  }
  return { status: 'none', note: 'Mock — no slot proposed.' };
}

/**
 * Build the initial operator-console view for one fixture workflow. Seeds the
 * proof report with a `channel_eligibility_checked` event and (for blocked
 * workflows) a `human_review_required` event documenting why it is held.
 */
export function buildOperatorWorkflowView(
  record: DemoProspectRecord,
  now = '1970-01-01T00:00:00.000Z',
): OperatorWorkflowView {
  const { prospect } = record;
  const summary = summarizeCompliance(record);

  const log: ComplianceProofEvent[] = [
    createComplianceProofEvent({
      type: 'channel_eligibility_checked',
      prospectId: prospect.id,
      summary: `Channel eligibility evaluated for ${prospect.companyName} (mock).`,
      createdAt: now,
    }),
  ];
  if (summary.state === 'blocked') {
    log.push(
      createComplianceProofEvent({
        type: 'human_review_required',
        prospectId: prospect.id,
        decision: 'blocked',
        summary: `Workflow blocked — ${summary.blockedReasons.join(' ')} (mock).`,
        createdAt: now,
      }),
    );
  }

  return {
    id: prospect.id,
    lead: projectLead(prospect),
    complianceState: summary.state,
    blockedReasons: summary.blockedReasons,
    channels: summary.channels,
    decision: 'pending',
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
    crm: { written: false, system: 'MockCRM', note: 'Mock only — no live CRM write.' },
    appointment: appointmentForDiscovery(prospect),
    proofReport: { state: 'pending', log },
  };
}

/** Whether the operator may approve this workflow. */
export function canApprove(view: OperatorWorkflowView): ApprovalGate {
  if (view.decision !== 'pending') {
    return { allowed: false, reason: `Already ${view.decision}.` };
  }
  if (view.complianceState === 'blocked') {
    return { allowed: false, reason: 'Workflow is blocked by compliance.' };
  }
  return { allowed: true, reason: null };
}

/** Whether the operator may reject this workflow. */
export function canReject(view: OperatorWorkflowView): ApprovalGate {
  if (view.decision !== 'pending') {
    return { allowed: false, reason: `Already ${view.decision}.` };
  }
  return { allowed: true, reason: null };
}

export class OperatorDecisionError extends Error {}

/**
 * Apply an operator approve/reject decision. Returns a NEW view (the input is
 * never mutated) with the decision recorded and a proof event appended. Throws
 * `OperatorDecisionError` if the decision is not allowed (e.g. approving a
 * blocked workflow).
 *
 * Mock-safe: approving records a human gating decision and routes to a
 * human-gated outreach step. It NEVER sends outreach and NEVER writes to a CRM —
 * `crm.written` stays false.
 */
export function applyOperatorDecision(
  view: OperatorWorkflowView,
  action: 'approve' | 'reject',
  operator: string,
  note = '',
  now = new Date().toISOString(),
): OperatorWorkflowView {
  const gate = action === 'approve' ? canApprove(view) : canReject(view);
  if (!gate.allowed) {
    throw new OperatorDecisionError(gate.reason ?? 'Decision not allowed.');
  }

  const trimmed = note.trim();
  const decision: OperatorDecision = action === 'approve' ? 'approved' : 'rejected';
  const event: ComplianceProofEvent =
    action === 'approve'
      ? createComplianceProofEvent({
          type: 'human_review_required',
          prospectId: view.id,
          decision: 'human_review_required',
          summary: `Operator approved workflow for human-gated outreach (mock). No outreach sent, no live CRM write.${
            trimmed ? ` Note: ${trimmed}` : ''
          }`,
          createdAt: now,
        })
      : createComplianceProofEvent({
          type: 'compliance_decision_logged',
          prospectId: view.id,
          decision: 'blocked',
          summary: `Operator rejected workflow (mock).${trimmed ? ` Note: ${trimmed}` : ''}`,
          createdAt: now,
        });

  return {
    ...view,
    decision,
    decidedBy: operator,
    decidedAt: now,
    decisionNote: trimmed || null,
    proofReport: { state: 'generated', log: [...view.proofReport.log, event] },
  };
}
