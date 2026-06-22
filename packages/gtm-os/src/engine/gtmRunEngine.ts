import { MockAppointmentAdapter } from '../adapters/mockAppointmentAdapter.js';
import { MockCrmAdapter } from '../adapters/mockCrmAdapter.js';
import { ApprovalQueue, type DecisionInput } from '../approval/approvalQueue.js';
import { evaluateCompliance } from '../compliance/complianceGate.js';
import { AppendOnlyLedger } from '../ledger/actionLedger.js';
import { buildProofReceipt } from '../proof/proofReceipt.js';
import { generateProofReport, type ProofReport } from '../proof/proofReport.js';
import { assertTransition } from '../stateMachine/runStateMachine.js';
import {
  CONSEQUENTIAL_STATES,
  type ComplianceDecision,
  type FixtureLead,
  type ProofDecision,
  type ProofReceipt,
  type RunState,
  type RuntimeEnv,
  type Tenant,
  type TenantId,
} from '../types.js';

/**
 * The GtmRunEngine is the single chokepoint that drives a run through the
 * authorized flow and is the ONLY place a run's state changes. Every state
 * change goes through {@link GtmRunEngine.transition}, which emits a proof
 * receipt — so "a proof receipt on every transition" holds by construction.
 *
 * Consequential states (mock appointment / CRM writeback) are guarded twice:
 * here (the run cannot enter them without a human approval on record) and again
 * inside each adapter — there is no approval-to-send loophole.
 */

export interface GtmRun {
  id: string;
  tenantId: TenantId;
  leadId: string;
  state: RunState;
  receipts: ProofReceipt[];
  approvalRequestId: string | null;
  createdAt: string;
}

export class RunStateError extends Error {}
export class ApprovalGuardError extends Error {}

export class GtmRunEngine {
  constructor(
    private readonly env: RuntimeEnv,
    private readonly ledger: AppendOnlyLedger,
    private readonly approvals: ApprovalQueue,
    private readonly appointments: MockAppointmentAdapter,
    private readonly crm: MockCrmAdapter,
  ) {}

  /** Create a run and attest its genesis state with the first proof receipt. */
  start(input: { tenantId: TenantId; lead: FixtureLead }): GtmRun {
    const run: GtmRun = {
      id: this.env.id('run'),
      tenantId: input.tenantId,
      leadId: input.lead.id,
      state: 'lead_received',
      receipts: [],
      approvalRequestId: null,
      createdAt: this.env.now(),
    };
    const created = this.ledger.append({
      runId: run.id,
      tenantId: run.tenantId,
      kind: 'run.created',
      summary: 'run created from inbound lead',
      detail: { leadId: run.leadId },
    });
    this.recordReceipt(run, null, 'lead_received', 'noop', [], created.hash);
    return run;
  }

  /** Run the consent/compliance gate. Blocks (terminal) or advances to approval. */
  runCompliance(run: GtmRun, lead: FixtureLead, tenant: Tenant): ComplianceDecision {
    this.requireState(run, 'lead_received');
    const decision = evaluateCompliance(lead, tenant);
    this.ledger.append({
      runId: run.id,
      tenantId: run.tenantId,
      kind: 'compliance.decision',
      summary: decision.allowed ? 'compliance: allowed' : 'compliance: blocked',
      detail: {
        allowed: decision.allowed,
        reasons: decision.reasons,
        checks: decision.checks.map((c) => ({ name: c.name, passed: c.passed })),
      },
    });

    this.transition(
      run,
      'compliance_evaluated',
      decision.allowed ? 'allowed' : 'blocked',
      decision.reasons,
    );

    if (!decision.allowed) {
      this.transition(run, 'blocked', 'blocked', decision.reasons);
      return decision;
    }

    this.transition(run, 'awaiting_approval', 'allowed', []);
    const request = this.approvals.request({
      runId: run.id,
      tenantId: run.tenantId,
      action: 'appointment+crm_writeback',
      summary: 'mock appointment booking + mock CRM writeback',
    });
    run.approvalRequestId = request.id;
    this.ledger.append({
      runId: run.id,
      tenantId: run.tenantId,
      kind: 'approval.requested',
      summary: 'human approval requested before consequential action',
      detail: { requestId: request.id, action: request.action },
    });
    return decision;
  }

  /** Apply a human's approve/reject decision and advance the run accordingly. */
  submitApproval(run: GtmRun, requestId: string, decision: DecisionInput): void {
    this.requireState(run, 'awaiting_approval');
    const req = this.approvals.decide(requestId, decision);
    if (decision.outcome === 'approved') {
      this.ledger.append({
        runId: run.id,
        tenantId: run.tenantId,
        kind: 'approval.granted',
        summary: 'human approved consequential action',
        detail: { requestId, approver: req.approver, note: req.note },
      });
      this.transition(run, 'approved', 'approved', []);
    } else {
      this.ledger.append({
        runId: run.id,
        tenantId: run.tenantId,
        kind: 'approval.rejected',
        summary: 'human rejected consequential action',
        detail: { requestId, approver: req.approver, note: req.note },
      });
      this.transition(run, 'rejected', 'rejected', decision.note ? [decision.note] : []);
    }
  }

  /**
   * Execute the approved consequential actions (mock appointment then mock CRM
   * writeback) and complete the run, returning the proof report. Refuses unless
   * the run is in `approved`.
   */
  executeApprovedActions(run: GtmRun, lead: FixtureLead, opts: { slotIso: string }): ProofReport {
    this.requireState(run, 'approved');

    this.appointments.book({
      runId: run.id,
      tenantId: run.tenantId,
      slotIso: opts.slotIso,
      prospectRef: `lead:${lead.id}`,
    });
    this.transition(run, 'appointment_booked', 'executed', []);

    this.crm.upsert({
      runId: run.id,
      tenantId: run.tenantId,
      externalKey: `${run.tenantId}:${lead.id}`,
      fields: { leadRef: lead.id, source: lead.source },
    });
    this.transition(run, 'crm_written', 'executed', []);

    this.transition(run, 'completed', 'executed', []);
    const report = generateProofReport(run, this.ledger);
    this.ledger.append({
      runId: run.id,
      tenantId: run.tenantId,
      kind: 'proof.report',
      summary: 'proof report emitted on completion',
      detail: {
        outcome: report.outcome,
        eventCount: report.integrity.eventCount,
        receiptCount: report.integrity.receiptCount,
        ledgerValid: report.integrity.ledgerValid,
        receiptChainValid: report.integrity.receiptChainValid,
        noRawPii: report.noRawPii,
      },
    });
    return report;
  }

  /** Build a proof report for a run in any state (e.g. a blocked/rejected run). */
  report(run: GtmRun): ProofReport {
    return generateProofReport(run, this.ledger);
  }

  // --- internals ---------------------------------------------------------

  private requireState(run: GtmRun, expected: RunState): void {
    if (run.state !== expected) {
      throw new RunStateError(`run ${run.id} must be in '${expected}' but is '${run.state}'`);
    }
  }

  /** The sole state-mutating path. Validates, guards, ledgers, and attests. */
  private transition(
    run: GtmRun,
    to: RunState,
    decision: ProofDecision,
    reasons: string[],
  ): ProofReceipt {
    assertTransition(run.state, to);

    if (
      (CONSEQUENTIAL_STATES as readonly RunState[]).includes(to) &&
      !this.approvals.isApproved(run.id)
    ) {
      this.ledger.append({
        runId: run.id,
        tenantId: run.tenantId,
        kind: 'action.blocked',
        summary: `transition to ${to} blocked: approval required`,
        detail: { to, reason: 'approval_required' },
      });
      throw new ApprovalGuardError(`cannot enter '${to}' without a human approval on record`);
    }

    const event = this.ledger.append({
      runId: run.id,
      tenantId: run.tenantId,
      kind: 'run.transition',
      summary: `${run.state} -> ${to}`,
      detail: { from: run.state, to, decision, reasons },
    });
    return this.recordReceipt(run, run.state, to, decision, reasons, event.hash);
  }

  private recordReceipt(
    run: GtmRun,
    fromState: RunState | null,
    toState: RunState,
    decision: ProofDecision,
    reasons: string[],
    eventHash: string,
  ): ProofReceipt {
    const prev = run.receipts[run.receipts.length - 1];
    const receipt = buildProofReceipt({
      env: this.env,
      runId: run.id,
      tenantId: run.tenantId,
      seq: run.receipts.length,
      fromState,
      toState,
      decision,
      reasons,
      eventHash,
      prevReceiptHash: prev ? prev.receiptHash : null,
    });
    this.ledger.append({
      runId: run.id,
      tenantId: run.tenantId,
      kind: 'proof.receipt',
      summary: `proof receipt #${receipt.seq} for ${toState}`,
      detail: {
        receiptId: receipt.receiptId,
        seq: receipt.seq,
        toState,
        decision,
        reasons,
        eventHash,
        receiptHash: receipt.receiptHash,
        prevReceiptHash: receipt.prevReceiptHash,
      },
    });
    run.state = toState;
    run.receipts.push(receipt);
    return receipt;
  }
}

/** Wire a fresh, fully-connected engine and its collaborators. */
export function createEngine(env: RuntimeEnv): {
  engine: GtmRunEngine;
  ledger: AppendOnlyLedger;
  approvals: ApprovalQueue;
  appointments: MockAppointmentAdapter;
  crm: MockCrmAdapter;
} {
  const ledger = new AppendOnlyLedger(env);
  const approvals = new ApprovalQueue(env);
  const appointments = new MockAppointmentAdapter(env, ledger, approvals);
  const crm = new MockCrmAdapter(env, ledger, approvals);
  const engine = new GtmRunEngine(env, ledger, approvals, appointments, crm);
  return { engine, ledger, approvals, appointments, crm };
}
