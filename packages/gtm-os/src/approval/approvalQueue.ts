import type { ApprovalOutcome, ApprovalRequest, RuntimeEnv, TenantId } from '../types.js';

/**
 * Mandatory human-approval queue. A consequential action (mock appointment +
 * mock CRM writeback) may only proceed once a request here has been explicitly
 * decided by a named human operator. The queue records *who* decided and the
 * structured note; it cannot auto-approve (every decision requires a non-empty
 * approver), and a request can only be decided once.
 */

export class ApprovalError extends Error {}

export interface RequestInput {
  runId: string;
  tenantId: TenantId;
  action: string;
  summary: string;
}

export interface DecisionInput {
  outcome: ApprovalOutcome;
  /** Identifier of the human operator. Required and non-empty — no auto-approve. */
  approver: string;
  note?: string;
}

export class ApprovalQueue {
  private readonly requests = new Map<string, ApprovalRequest>();

  constructor(private readonly env: RuntimeEnv) {}

  request(input: RequestInput): ApprovalRequest {
    const req: ApprovalRequest = {
      id: this.env.id('appr'),
      runId: input.runId,
      tenantId: input.tenantId,
      action: input.action,
      summary: input.summary,
      status: 'pending',
      requestedAt: this.env.now(),
      decidedAt: null,
      approver: null,
      note: null,
    };
    this.requests.set(req.id, req);
    return { ...req };
  }

  decide(requestId: string, input: DecisionInput): ApprovalRequest {
    const req = this.requests.get(requestId);
    if (!req) throw new ApprovalError(`unknown approval request: ${requestId}`);
    if (req.status !== 'pending') {
      throw new ApprovalError(`approval request ${requestId} already decided (${req.status})`);
    }
    if (input.approver.trim() === '') {
      throw new ApprovalError('an approval decision requires a named human approver');
    }
    const decided: ApprovalRequest = {
      ...req,
      status: input.outcome,
      decidedAt: this.env.now(),
      approver: input.approver,
      note: input.note ?? null,
    };
    this.requests.set(requestId, decided);
    return { ...decided };
  }

  get(requestId: string): ApprovalRequest | null {
    const req = this.requests.get(requestId);
    return req ? { ...req } : null;
  }

  forRun(runId: string): ApprovalRequest[] {
    return [...this.requests.values()].filter((r) => r.runId === runId).map((r) => ({ ...r }));
  }

  /** True iff this run has at least one request approved by a human. */
  isApproved(runId: string): boolean {
    return [...this.requests.values()].some(
      (r) => r.runId === runId && r.status === 'approved' && (r.approver ?? '') !== '',
    );
  }

  approvedRequest(runId: string): ApprovalRequest | null {
    const found = [...this.requests.values()].find(
      (r) => r.runId === runId && r.status === 'approved',
    );
    return found ? { ...found } : null;
  }
}
