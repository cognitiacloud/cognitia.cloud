import { randomUUID } from 'node:crypto';
import { ActionLedger } from './actionLedger.js';
import type { HumanApprovalRegistry, ApprovalEvent, ApprovalVerification } from './approvalGate.js';
import { buildCommandCenterSummary } from './commandCenterSummary.js';
import type { CommandCenterSummary } from './commandCenterSummary.js';
import { evaluateConsentGate } from './consentGate.js';
import type { ConsentGateEvaluation } from './consentGate.js';
import type { ConnectorRegistry, WritebackResult } from './connectorRegistry.js';
import type { MonthlyProofReportAccumulator } from './demandGen.js';
import { intakeLead } from './leadIntake.js';
import type { ModelRouterHarness, ModelRouteResult } from './modelRouter.js';
import { buildProofReceipt } from './proofReceipt.js';
import type { ProofReceipt } from './proofReceipt.js';
import { qualifyLead } from './qualification.js';
import type { QualificationResult } from './qualification.js';
import { adapterAllowsDataMode, getVerticalAdapter } from './verticalAdapters.js';
import type { VerticalAdapter } from './verticalAdapters.js';
import { blockedReason } from './types.js';
import type {
  BlockedReason,
  Clock,
  DemandaraLead,
  IdFactory,
  RawLeadInput,
  WorkflowState,
} from './types.js';

/**
 * Sales Closer workflow engine — the governed lead-to-close spine
 * (04_SALES_CLOSER_WORKFLOW_CONTEXT.md):
 *
 *   lead intake -> source rights/consent gate -> qualification -> trust gap ->
 *   next step -> human approval -> mock connector writeback -> proof receipt ->
 *   Command Center summary -> monthly report update
 *
 * Non-negotiable properties:
 *   - deny by default: the first failed gate blocks the run;
 *   - a proof receipt is generated on EVERY run, allowed or blocked;
 *   - approval comes only from the HumanApprovalRegistry — never from the
 *     lead payload, never from model output;
 *   - the only "writeback" is a mock intent record; there is no egress.
 */

export interface StateTraceEntry {
  state: WorkflowState;
  at: string;
  ok: boolean;
  note: string | null;
}

export interface WorkflowRunOptions {
  lead: RawLeadInput;
  approvals: HumanApprovalRegistry;
  connectors: ConnectorRegistry;
  ledger?: ActionLedger;
  /** Optional mock/replay brain harness; its output is advisory copy only. */
  router?: ModelRouterHarness;
  /**
   * Caller-supplied approval candidate. Demonstrates the anti-forgery
   * invariant: anything not issued by `approvals` is rejected as forged.
   */
  claimedApproval?: unknown;
  monthlyReport?: MonthlyProofReportAccumulator;
  clock?: Clock;
  idFactory?: IdFactory;
}

export interface WorkflowRunResult {
  runId: string;
  status: 'completed_mock_only' | 'blocked';
  finalState: WorkflowState;
  blockedReason: BlockedReason | null;
  blockedAtState: WorkflowState | null;
  lead: DemandaraLead | null;
  gate: ConsentGateEvaluation | null;
  qualification: QualificationResult | null;
  approval: ApprovalVerification | null;
  writeback: WritebackResult | null;
  /** Advisory mock/replay route result, if a router was supplied. */
  aiAssist: ModelRouteResult | null;
  proofReceipt: ProofReceipt;
  commandCenter: CommandCenterSummary;
  stateTrace: readonly StateTraceEntry[];
  ledger: ActionLedger;
}

export function runSalesCloserWorkflow(options: WorkflowRunOptions): WorkflowRunResult {
  const clock = options.clock ?? (() => new Date());
  const idFactory = options.idFactory ?? randomUUID;
  const ledger = options.ledger ?? new ActionLedger({ clock, idFactory });
  const runId = idFactory();

  const trace: StateTraceEntry[] = [];
  const mark = (state: WorkflowState, ok: boolean, note?: string): void => {
    trace.push({ state, at: clock().toISOString(), ok, note: note ?? null });
  };

  let lead: DemandaraLead | null = null;
  let adapter: VerticalAdapter | null = null;
  let gate: ConsentGateEvaluation | null = null;
  let qualification: QualificationResult | null = null;
  let approval: ApprovalVerification | null = null;
  let approvalEvent: ApprovalEvent | null = null;
  let writeback: WritebackResult | null = null;
  let aiAssist: ModelRouteResult | null = null;
  let blocked: BlockedReason | null = null;
  let blockedAtState: WorkflowState | null = null;
  let finalState: WorkflowState = 'lead_received';

  const block = (state: WorkflowState, reason: BlockedReason): void => {
    blocked = reason;
    blockedAtState = state;
    finalState = state;
    mark(state, false, `[${reason.code}] ${reason.detail}`);
    ledger.append('workflow_blocked', {
      runId,
      state,
      reasonCode: reason.code,
      detail: reason.detail,
      leadId: lead?.leadId ?? null,
    });
  };

  // 1. lead_received — intake validation + data-mode audit.
  const intake = intakeLead(options.lead);
  if (!intake.ok) {
    ledger.append('lead_intake_rejected', { runId, reasonCode: intake.reason.code });
    block('lead_received', intake.reason);
  } else {
    lead = intake.lead;
    finalState = 'lead_received';
    mark('lead_received', true, `lead ${lead.leadId} (${lead.dataMode})`);
    ledger.append('lead_received', {
      runId,
      leadId: lead.leadId,
      scenarioId: lead.scenarioId,
      vertical: lead.vertical,
      dataMode: lead.dataMode,
      sourceType: lead.sourceType,
    });

    // Resolve the vertical adapter; reference/design-only verticals refuse to run.
    const resolved = getVerticalAdapter(lead.vertical);
    if (!resolved) {
      block(
        'lead_received',
        blockedReason('VERTICAL_ADAPTER_NOT_AVAILABLE', `Vertical: ${lead.vertical}.`),
      );
    } else if (!adapterAllowsDataMode(resolved, lead)) {
      block(
        'lead_received',
        blockedReason('DATA_MODE_NOT_ALLOWED_FOR_VERTICAL', `Mode: ${lead.dataMode}.`),
      );
    } else {
      adapter = resolved;
    }
  }

  // 2. source_rights_checked — combined source-rights + consent gate.
  if (!blocked && lead && adapter) {
    gate = evaluateConsentGate(lead);
    ledger.append('source_rights_checked', {
      runId,
      leadId: lead.leadId,
      sourceRightsStatus: lead.sourceRightsStatus,
      allowed: gate.sourceRights.allowed,
    });
    ledger.append('consent_checked', {
      runId,
      leadId: lead.leadId,
      consentStatus: lead.consentStatus,
      contactAllowed: lead.contactAllowed,
      allowed: gate.consent.allowed,
    });
    if (!gate.allowed && gate.blocked) {
      block('source_rights_checked', gate.blocked);
    } else {
      finalState = 'source_rights_checked';
      mark('source_rights_checked', true);
    }
  }

  // 3-5. qualification, trust gap, recommended next step.
  if (!blocked && lead && adapter) {
    qualification = qualifyLead(lead, adapter);
    ledger.append(qualification.status === 'qualified' ? 'lead_qualified' : 'lead_disqualified', {
      runId,
      leadId: lead.leadId,
      avatarFit: qualification.avatarFit,
      urgency: qualification.urgency,
      compositeScore: qualification.compositeScore,
    });
    if (qualification.status === 'disqualified') {
      block(
        'qualified_or_disqualified',
        blockedReason('LEAD_DISQUALIFIED', qualification.disqualifiedBecause ?? undefined),
      );
    } else {
      finalState = 'qualified_or_disqualified';
      mark('qualified_or_disqualified', true, `composite ${qualification.compositeScore}`);
      ledger.append('trust_gap_identified', {
        runId,
        leadId: lead.leadId,
        trustGap: qualification.trustGap.label,
        severity: qualification.trustGap.severity,
      });
      finalState = 'trust_gap_identified';
      mark('trust_gap_identified', true, qualification.trustGap.label);

      // Optional advisory copy from the mock/replay brain harness. The result
      // is stored as evidence only — no field of it is read back into gates.
      if (options.router) {
        aiAssist = options.router.route(
          {
            taskKind: 'next_step_copy',
            providerMode: 'mock',
            input: `vertical=${lead.vertical}; segment=${lead.avatarSegment}; pain=${lead.painCategory}`,
          },
          ledger,
        );
      }

      ledger.append('next_step_recommended', {
        runId,
        leadId: lead.leadId,
        nextStep: qualification.recommendedNextStep,
      });
      finalState = 'recommended_next_step_generated';
      mark('recommended_next_step_generated', true, qualification.recommendedNextStep);
    }
  }

  // 6-7. human approval gate. The registry is the ONLY source of truth.
  if (!blocked && lead && adapter && qualification) {
    finalState = 'human_approval_required';
    mark('human_approval_required', true);
    approval = options.approvals.verify(lead.leadId, options.claimedApproval);
    ledger.append('approval_checked', {
      runId,
      leadId: lead.leadId,
      status: approval.status,
      approvalId: 'event' in approval ? approval.event.approvalId : null,
    });
    switch (approval.status) {
      case 'approved':
        approvalEvent = approval.event;
        finalState = 'human_approved';
        mark('human_approved', true, `by ${approval.event.approvedBy}`);
        break;
      case 'denied':
        finalState = 'human_denied';
        mark('human_denied', true, `by ${approval.event.approvedBy}`);
        block('human_denied', blockedReason('HUMAN_APPROVAL_DENIED'));
        break;
      case 'hold':
        finalState = 'human_hold';
        mark('human_hold', true, `by ${approval.event.approvedBy}`);
        block('human_hold', blockedReason('HUMAN_APPROVAL_HOLD'));
        break;
      case 'missing':
        block('human_approval_required', blockedReason('HUMAN_APPROVAL_MISSING'));
        break;
      case 'forged':
        block('human_approval_required', blockedReason('FORGED_APPROVAL_REJECTED'));
        break;
    }
  }

  // 8. mock writeback — only with a trusted approval event, only mock_only connectors.
  if (!blocked && lead && adapter && approvalEvent && qualification) {
    writeback = options.connectors.recordWritebackIntent(
      {
        connectorId: adapter.mockWritebackConnectorId,
        leadId: lead.leadId,
        vertical: lead.vertical,
        target: adapter.mockWritebackTarget,
        payloadSummary: {
          scenarioId: lead.scenarioId,
          avatarSegment: lead.avatarSegment,
          recommendedNextStep: qualification.recommendedNextStep,
          approvalId: approvalEvent.approvalId,
        },
        approval: approvalEvent,
      },
      ledger,
    );
    if (writeback.status === 'blocked') {
      block('mock_writeback_recorded', writeback.reason);
    } else {
      finalState = 'mock_writeback_recorded';
      mark('mock_writeback_recorded', true, `intent ${writeback.intent.intentId}`);
    }
  }

  // 9. proof receipt — ALWAYS generated, allowed or blocked.
  const receipt = buildProofReceipt(
    {
      runId,
      templateId: adapter?.proofReceiptTemplateId ?? 'demandara_chassis.unrouted.v1',
      leadId: lead?.leadId ?? null,
      scenarioId: lead?.scenarioId ?? null,
      vertical: lead?.vertical ?? null,
      dataMode: lead?.dataMode ?? null,
      policyDecision: blocked ? 'blocked' : 'allowed_mock_only',
      finalState: blocked ? finalState : 'proof_receipt_generated',
      consentState: lead?.consentStatus ?? null,
      sourceRightsState: lead?.sourceRightsStatus ?? null,
      approval: approvalEvent,
      writebackIntent: writeback?.status === 'recorded_mock_intent' ? writeback.intent : null,
      blockedReason: blocked,
      blockedAtState,
      ledgerEventIds: ledger.events().map((event) => event.id),
    },
    { clock, idFactory },
  );
  ledger.append('proof_receipt_generated', {
    runId,
    receiptId: receipt.receiptId,
    policyDecision: receipt.policyDecision,
    blockedReasonCode: receipt.blockedReason?.code ?? null,
  });
  if (!blocked) {
    finalState = 'proof_receipt_generated';
    mark('proof_receipt_generated', true, receipt.receiptId);
  }

  // 10. monthly report input — every run counts, blocked runs included.
  options.monthlyReport?.record({
    runId,
    leadId: lead?.leadId ?? null,
    vertical: lead?.vertical ?? null,
    policyDecision: receipt.policyDecision,
    blockedReason: blocked,
    proofReceiptId: receipt.receiptId,
    qualified: qualification ? qualification.status === 'qualified' : null,
    approvalDecision: approval && 'event' in approval ? approval.event.decision : null,
  });
  ledger.append('monthly_report_updated', {
    runId,
    receiptId: receipt.receiptId,
    recorded: options.monthlyReport !== undefined,
  });
  if (!blocked) {
    finalState = 'monthly_report_updated';
    mark('monthly_report_updated', true);
  }

  const commandCenter = buildCommandCenterSummary({
    runId,
    leadId: lead?.leadId ?? null,
    scenarioId: lead?.scenarioId ?? null,
    vertical: lead?.vertical ?? null,
    dataMode: lead?.dataMode ?? null,
    finalState,
    qualification,
    consentState: lead?.consentStatus ?? null,
    sourceRightsState: lead?.sourceRightsStatus ?? null,
    approval,
    writeback,
    proofReceiptId: receipt.receiptId,
    blockedReason: blocked,
  });

  return {
    runId,
    status: blocked ? 'blocked' : 'completed_mock_only',
    finalState,
    blockedReason: blocked,
    blockedAtState,
    lead,
    gate,
    qualification,
    approval,
    writeback,
    aiAssist,
    proofReceipt: receipt,
    commandCenter,
    stateTrace: trace,
    ledger,
  };
}
