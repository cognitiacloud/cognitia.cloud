import { randomUUID } from 'node:crypto';
import {
  canContactProspect,
  createGtmProofEvent,
  normalizeGtmProspect,
  requiresHumanReviewForOutreach,
  GTM_OUTREACH_REQUIRES_HUMAN_APPROVAL,
  type GtmProofEvent,
  type GtmProspect,
  type IsoTimestamp,
  type RawGtmProspectInput,
} from '@cognitia/core';
import type {
  AppointmentResult,
  ApprovalResult,
  CloserPorts,
  ComplianceCheckResult,
  CrmWritebackResult,
  ProofRecordResult,
} from './ports.js';
import { DEFAULT_WORKSPACE_ID, type WorkspaceId } from './workspaces.js';

/**
 * Sales Closer workflow core (mock-safe happy path).
 *
 * A minimal, fully-offline state machine that walks one lead through:
 *   lead in → compliance check → human approval → appointment requested →
 *   CRM (mock) writeback → proof report → completed.
 *
 * Every transition is explicit and individually testable: each phase has a pure
 * `step*` function mapping a boundary result to the next state, and the driver
 * (`SalesCloserWorkflow.run`) sequences them through the injected {@link CloserPorts}.
 * Compliance/approval/CRM/proof are integration boundaries, never fake-success
 * shortcuts — a blocked/rejected/failed boundary halts the workflow in an
 * explicit terminal state.
 */

/** Every state the workflow can occupy. The happy path visits the first seven. */
export type SalesCloserState =
  | 'lead_received'
  | 'compliance_check_required'
  | 'human_approval_required'
  | 'appointment_requested'
  | 'crm_writeback_requested'
  | 'proof_report_requested'
  | 'completed'
  | 'blocked_compliance'
  | 'blocked_approval'
  | 'blocked_appointment'
  | 'blocked_crm'
  | 'blocked_proof';

/** Which boundary produced a given transition (`init` = workflow entry). */
export type TransitionVia = 'init' | 'compliance' | 'approval' | 'appointment' | 'crm' | 'proof';

export interface WorkflowTransition {
  from: SalesCloserState;
  to: SalesCloserState;
  via: TransitionVia;
  at: IsoTimestamp;
  detail?: string;
}

export type WorkflowStatus = 'completed' | 'blocked' | 'awaiting_approval';

export interface WorkflowRun {
  prospect: GtmProspect;
  /** Demo workspace/tenant this run belongs to. Always set. */
  workspaceId: WorkspaceId;
  state: SalesCloserState;
  status: WorkflowStatus;
  transitions: WorkflowTransition[];
  /** Append-only proof events built (and recorded) during the run. */
  proofs: GtmProofEvent[];
  blockedReason?: string;
}

/** Re-exposes the platform invariant: no autonomous outreach — always a human gate. */
export const SALES_CLOSER_REQUIRES_HUMAN_APPROVAL = GTM_OUTREACH_REQUIRES_HUMAN_APPROVAL;

const TERMINAL_STATES: ReadonlySet<SalesCloserState> = new Set<SalesCloserState>([
  'completed',
  'blocked_compliance',
  'blocked_approval',
  'blocked_appointment',
  'blocked_crm',
  'blocked_proof',
]);

/** Whether a state is terminal (no further transitions possible). */
export function isTerminalState(state: SalesCloserState): boolean {
  return TERMINAL_STATES.has(state);
}

/* ---------------------------------------------------------------- transitions */

/**
 * Hard compliance doctrine, evaluated in-code BEFORE the compliance boundary:
 * a prospect that cannot be contacted (unsubscribe / do-not-contact / withdrawn
 * consent) is blocked regardless of any external service. Reuses the canonical
 * `canContactProspect` guardrail.
 */
export function evaluateComplianceDoctrine(prospect: GtmProspect): ComplianceCheckResult {
  if (!canContactProspect(prospect)) {
    return {
      status: 'blocked',
      reason: 'prospect is not contactable (consent / unsubscribe / do-not-contact)',
    };
  }
  return { status: 'pass' };
}

export function stepCompliance(result: ComplianceCheckResult): SalesCloserState {
  return result.status === 'pass' ? 'human_approval_required' : 'blocked_compliance';
}

export function stepApproval(result: ApprovalResult): SalesCloserState {
  if (result.status === 'approved') return 'appointment_requested';
  if (result.status === 'rejected') return 'blocked_approval';
  // pending: stay in the approval gate — never auto-advance past a human.
  return 'human_approval_required';
}

export function stepAppointment(result: AppointmentResult): SalesCloserState {
  return result.status === 'requested' ? 'crm_writeback_requested' : 'blocked_appointment';
}

export function stepCrmWriteback(result: CrmWritebackResult): SalesCloserState {
  return result.status === 'ok' ? 'proof_report_requested' : 'blocked_crm';
}

export function stepProofReport(result: ProofRecordResult): SalesCloserState {
  return result.status === 'ok' ? 'completed' : 'blocked_proof';
}

/* -------------------------------------------------------------------- driver */

export interface CreateSalesCloserWorkflowOptions {
  ports: CloserPorts;
  /** Demo workspace/tenant this workflow runs in. Defaults to {@link DEFAULT_WORKSPACE_ID}. */
  workspace?: WorkspaceId;
  /** Injectable clock for deterministic tests. */
  now?: () => Date;
  /** Injectable id generator for deterministic tests. */
  newId?: () => string;
}

const ACTOR_REF = 'workflow:sales-closer';

export class SalesCloserWorkflow {
  private readonly ports: CloserPorts;
  private readonly workspaceId: WorkspaceId;
  private readonly now: () => Date;
  private readonly newId: () => string;

  constructor(opts: CreateSalesCloserWorkflowOptions) {
    this.ports = opts.ports;
    this.workspaceId = opts.workspace ?? DEFAULT_WORKSPACE_ID;
    this.now = opts.now ?? (() => new Date());
    this.newId = opts.newId ?? (() => randomUUID());
  }

  /**
   * Drive one lead through the workflow. Returns a full {@link WorkflowRun}
   * record (ordered transition log + collected proof events). Pure of IO beyond
   * the injected ports; safe to run entirely offline with the mock ports.
   */
  async run(rawLead: RawGtmProspectInput): Promise<WorkflowRun> {
    const prospect = normalizeGtmProspect(rawLead, { id: this.newId(), now: this.now() });
    const transitions: WorkflowTransition[] = [];
    const proofs: GtmProofEvent[] = [];
    let state: SalesCloserState = 'lead_received';

    const advance = (to: SalesCloserState, via: TransitionVia, detail?: string): void => {
      transitions.push({ from: state, to, via, at: this.now().toISOString(), detail });
      state = to;
    };

    const blocked = (reason?: string): WorkflowRun => ({
      prospect,
      workspaceId: this.workspaceId,
      state,
      status: 'blocked',
      transitions,
      proofs,
      blockedReason: reason,
    });

    // Phase 1 — compliance check. Doctrine first, then the external boundary.
    advance('compliance_check_required', 'init');
    const doctrine = evaluateComplianceDoctrine(prospect);
    const compliance =
      doctrine.status === 'blocked' ? doctrine : await this.ports.compliance.check(prospect);
    const afterCompliance = stepCompliance(compliance);
    advance(afterCompliance, 'compliance', compliance.reason);
    if (afterCompliance === 'blocked_compliance') return blocked(compliance.reason);

    // Phase 2 — human approval. Always required (no autonomous path).
    const reviewReason = requiresHumanReviewForOutreach(prospect)
      ? 'elevated review (consent not established or high-risk source)'
      : 'standard human approval gate';
    const approval = await this.ports.approval.requestApproval({
      prospectId: prospect.id,
      summary: `Approve Sales Closer outreach for ${prospect.companyName}`,
      reason: reviewReason,
      workspaceId: this.workspaceId,
    });
    const afterApproval = stepApproval(approval);
    advance(afterApproval, 'approval', approval.reason ?? reviewReason);
    if (afterApproval === 'blocked_approval') return blocked(approval.reason);
    if (afterApproval === 'human_approval_required') {
      // pending: halt awaiting a human decision; nothing downstream runs.
      return {
        prospect,
        workspaceId: this.workspaceId,
        state,
        status: 'awaiting_approval',
        transitions,
        proofs,
      };
    }

    // Phase 3 — appointment requested.
    const appointment = await this.ports.appointment.requestAppointment({
      prospectId: prospect.id,
    });
    const afterAppointment = stepAppointment(appointment);
    advance(afterAppointment, 'appointment', appointment.reason);
    if (afterAppointment === 'blocked_appointment') return blocked(appointment.reason);
    proofs.push(
      this.buildProof(
        'gtm.discovery.booked.v1',
        prospect,
        `Appointment requested for ${prospect.companyName}.`,
        { appointmentRef: appointment.appointmentRef ?? null },
      ),
    );

    // Phase 4 — CRM mock writeback.
    const crm = await this.ports.crm.writeback({
      prospectId: prospect.id,
      appointmentRef: appointment.appointmentRef,
      workspaceId: this.workspaceId,
    });
    const afterCrm = stepCrmWriteback(crm);
    advance(afterCrm, 'crm', crm.reason);
    if (afterCrm === 'blocked_crm') return blocked(crm.reason);
    proofs.push(
      this.buildProof(
        'gtm.proposal.generated.v1',
        prospect,
        `CRM record written (mock) for ${prospect.companyName}.`,
        { crmRecordRef: crm.recordRef ?? null },
      ),
    );

    // Phase 5 — proof report. Record every collected proof through the boundary.
    let proofOutcome: ProofRecordResult = { status: 'ok' };
    for (const event of proofs) {
      const result = await this.ports.proof.record(event);
      if (result.status === 'failed') {
        proofOutcome = result;
        break;
      }
    }
    const afterProof = stepProofReport(proofOutcome);
    advance(afterProof, 'proof', proofOutcome.reason);
    if (afterProof === 'blocked_proof') return blocked(proofOutcome.reason);

    return {
      prospect,
      workspaceId: this.workspaceId,
      state,
      status: 'completed',
      transitions,
      proofs,
    };
  }

  private buildProof(
    kind: GtmProofEvent['kind'],
    prospect: GtmProspect,
    summaryPublic: string,
    detailsPrivate: Record<string, unknown>,
  ): GtmProofEvent {
    return createGtmProofEvent(
      {
        kind,
        subjectType: 'gtm_prospect',
        subjectId: prospect.id,
        evidenceTag: 'verified_fact',
        summaryPublic,
        // Receipt/report-side tag uses snake_case `workspace_id` (the public
        // interfaces use `workspaceId`). No core type change: this rides in the
        // proof event's existing open `detailsPrivate` bag.
        detailsPrivate: { ...detailsPrivate, workspace_id: this.workspaceId },
        actorRef: ACTOR_REF,
      },
      { id: this.newId(), occurredAt: this.now() },
    );
  }
}

export function createSalesCloserWorkflow(
  opts: CreateSalesCloserWorkflowOptions,
): SalesCloserWorkflow {
  return new SalesCloserWorkflow(opts);
}
