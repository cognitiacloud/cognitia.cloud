/**
 * Typed client for the approval-queue API. Framework-agnostic and dependency-free
 * so it compiles/tests under the base toolchain and can be imported by Next.js
 * server components or route handlers once the UI is scaffolded.
 *
 * A `fetch`-compatible function is injected (no reliance on a DOM lib), so the
 * same client works in the browser, in Next.js server code, and in tests.
 */

export interface FetchLike {
  (
    url: string,
    init?: { method?: string; headers?: Record<string, string>; body?: string },
  ): Promise<{
    status: number;
    json(): Promise<unknown>;
  }>;
}

/** Structured "why" sent with every approve/reject; codes mirror @cognitia/core. */
export interface DecisionReasonInput {
  reason_code: string;
  note?: string;
}

/** Keep in sync with approveReasonCode / rejectReasonCode in @cognitia/core. */
export const APPROVE_REASON_CODES = [
  'accurate_and_relevant',
  'high_value_target',
  'meets_playbook',
  'other',
] as const;
export const REJECT_REASON_CODES = [
  'wrong_target',
  'factually_wrong',
  'tone_off_brand',
  'policy_or_risk',
  'duplicate_or_stale',
  'other',
] as const;

export interface DecisionLabelView {
  id: string;
  subject_ref: string;
  label: string;
  detail: Record<string, unknown>;
  created_at: string;
}

/** Execution preview (GOV-1); mirrors ActionLedger.previewExecution. */
export interface ExecutionPreviewView {
  action_id: string;
  action_type: string;
  target_ref: string;
  risk_level: string;
  approval_status: string;
  execution_status: string;
  would_execute: boolean;
  denial_reason?: string;
  idempotent_replay_expected: boolean;
  guardrail_results: unknown[];
  evidence_refs: string[];
  plan: {
    system: string;
    object: string;
    operation: string;
    target_ref: string;
    idempotency_key: string;
    idempotency_property: string;
    properties: Record<string, string | number>;
  };
}

/** Trust metrics (MET-1); mirrors apps/api trustMetrics.ts. */
export interface TrustMetricsView {
  actions: {
    proposed: number;
    approved: number;
    rejected: number;
    executed: number;
    failed: number;
  };
  approval_rate: number | null;
  approve_reasons: Record<string, number>;
  reject_reasons: Record<string, number>;
  median_decision_seconds: number | null;
  duplicate_writes_prevented: number;
}

/** Per-id outcome of a batch approve/reject (UX-2). */
export interface BatchDecisionResult {
  kind: 'approve' | 'reject';
  requested: number;
  succeeded: number;
  results: Array<{ id: string; ok: boolean; status: number; error?: string }>;
}

export interface AgentActionView {
  id: string;
  action_type: string;
  risk_level: string;
  approval_status: string;
  execution_status: string;
  target_ref: string;
  evidence_refs: string[];
  draft: { subject_line: string; body: string; evidence_refs: string[] } | null;
}

export interface ApiClientOptions {
  baseUrl: string;
  /**
   * Optional: operator routes derive the tenant from the verified session, so the
   * console omits this. Kept for webhook-style callers/tests that still pass it.
   */
  tenantId?: string;
  fetch: FetchLike;
}

export class ApiClient {
  constructor(private readonly opts: ApiClientOptions) {}

  private headers(): Record<string, string> {
    const h: Record<string, string> = { 'content-type': 'application/json' };
    if (this.opts.tenantId) h['x-tenant-id'] = this.opts.tenantId;
    return h;
  }

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.opts.fetch(`${this.opts.baseUrl}${path}`, {
      method,
      headers: this.headers(),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json()) as T;
    if (res.status >= 400) {
      throw new ApiError(res.status, json);
    }
    return json;
  }

  listProposed(): Promise<{ actions: AgentActionView[] }> {
    return this.req('GET', '/agent-actions?status=proposed');
  }
  /** List actions, optionally filtered by approval status; no filter = all. */
  listActions(status?: string): Promise<{ actions: AgentActionView[] }> {
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.req('GET', `/agent-actions${q}`);
  }
  /** Approve with a required structured reason (decision flywheel label). */
  approve(id: string, reason: DecisionReasonInput): Promise<AgentActionView> {
    return this.req('POST', `/agent-actions/${id}/approve`, { reason });
  }
  /** Reject with a required structured reason (decision flywheel label). */
  reject(id: string, reason: DecisionReasonInput): Promise<AgentActionView> {
    return this.req('POST', `/agent-actions/${id}/reject`, { reason });
  }
  /** Batch approve with one shared reason; per-id results (UX-2). */
  batchApprove(ids: string[], reason: DecisionReasonInput): Promise<BatchDecisionResult> {
    return this.req('POST', '/agent-actions/batch-approve', { ids, reason });
  }
  /** Batch reject with one shared reason; per-id results (UX-2). */
  batchReject(ids: string[], reason: DecisionReasonInput): Promise<BatchDecisionResult> {
    return this.req('POST', '/agent-actions/batch-reject', { ids, reason });
  }
  /** Decision labels recorded for one action (the queryable eval feed). */
  listDecisions(id: string): Promise<{ decisions: DecisionLabelView[] }> {
    return this.req('GET', `/agent-actions/${id}/decisions`);
  }
  /** All decision labels for the tenant — the decision-history view (UX-2). */
  listAllDecisions(): Promise<{ decisions: DecisionLabelView[] }> {
    return this.req('GET', '/decisions');
  }
  /** Tenant trust metrics (MET-1) — the numbers a design partner audits. */
  trustMetrics(): Promise<TrustMetricsView> {
    return this.req('GET', '/metrics/trust');
  }
  /** GOV-1 — the exact typed CRM write this action will perform. */
  previewAction(id: string): Promise<ExecutionPreviewView> {
    return this.req('GET', `/agent-actions/${id}/preview`);
  }
  execute(id: string): Promise<AgentActionView> {
    return this.req('POST', `/agent-actions/${id}/execute`);
  }
  runMira(
    body: { objective?: string } = {},
  ): Promise<{ runId: string; proposedActionIds: string[] }> {
    return this.req('POST', '/agent-runs/mira', body);
  }
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly payload: unknown,
  ) {
    super(`api error ${status}`);
    this.name = 'ApiError';
  }
}
