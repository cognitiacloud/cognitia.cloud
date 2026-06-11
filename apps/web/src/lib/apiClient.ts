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
/** Decision rationale (WHY-1); mirrors apps/api rationale.ts. */
export interface DecisionRationaleView {
  action_id: string;
  target_ref: string;
  account: {
    id: string;
    name: string;
    industry: string | null;
    employee_count: number | null;
    region: string | null;
  } | null;
  score: { fit: number; timing: number; combined: number } | null;
  evidence: Array<{ claim: string; source_ref: string; score: number }>;
  evidence_refs_on_action: number;
  freshness: {
    data_updated_at: string;
    age_days: number;
    proposed_at: string;
    stale_since_proposal: boolean;
  } | null;
}

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

/** Preflight report (SIM-1); mirrors apps/api preflight.ts. */
export interface PreflightReportView {
  simulated: true;
  writes_performed: 0;
  objective: string;
  accounts_considered: number;
  ranked_accounts: Array<{ accountId: string; combined: number }>;
  proposals: Array<{
    action_type: string;
    target_ref: string;
    risk_level: string;
    evidence_refs: string[];
    plan: ExecutionPreviewView['plan'];
  }>;
  excluded_suppressed: string[];
}

/** ENF-1 views; mirror apps/api handlers/governance.ts. */
export interface IntegrationStatusView {
  system: string;
  status: string;
  updated_at: string | null;
  kill_switch: { enforced: boolean; halted: boolean };
}
export interface GovernanceMatrixView {
  derived_from_code: boolean;
  description: string;
  action_types: Array<{
    action_type: string;
    risk_level: string;
    requires_human_approval: boolean;
    blocked_when_suppressed: boolean;
    suppression_reason: string;
    executable_in_deployment: boolean;
    rollback_supported: boolean;
  }>;
  roles: Array<{ role: string; can: string[] }>;
  kill_switch: { enforced: boolean; semantics: string };
}
export interface AuditTrailView {
  events: Array<{
    actor_ref: string;
    action: string;
    subject_ref: string;
    detail: Record<string, unknown>;
    created_at: string;
  }>;
  total: number;
}
/** Integration sync run (EVID-1); mirrors SyncRunsTable. */
export interface SyncRunView {
  id: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  stats: Record<string, unknown>;
  created_at: string;
}
/** Opportunity (EVID-1); mirrors OpportunitiesTable. */
export interface OpportunityView {
  id: string;
  account_id: string | null;
  name: string;
  stage: string | null;
  amount: number | null;
  owner_ref: string | null;
}

/** Connection readiness (RDY-1); mirrors apps/api readiness checker. */
export interface ReadinessView {
  ready: boolean;
  reason?: string;
  connection_status?: string;
  checks?: Array<{ name: string; ok: boolean; detail: string }>;
  missing_properties?: { tasks: string[]; notes: string[] };
}

/** Trust metrics (MET-1); mirrors apps/api trustMetrics.ts. */
/** Run/plan rollup (RUN-1); mirrors apps/api runPlans.ts. */
export interface RunPlanView {
  run_id: string;
  agent: string;
  objective: string;
  status: string;
  created_at: string;
  rollup: {
    total: number;
    proposed: number;
    approved: number;
    rejected: number;
    executed: number;
    rolled_back: number;
    action_types: Record<string, number>;
  };
  fully_reviewed: boolean;
}

/** Per-segment scorecards (LEARN-1); mirrors apps/api scorecards.ts. */
export interface SegmentScorecardView {
  segment: string;
  action_type: string;
  risk_level: string;
  metrics: TrustMetricsView;
  autonomy_indicator: { meets_threshold: boolean; reasons: string[] };
}
export interface ScorecardReportView {
  description: string;
  overall: TrustMetricsView;
  segments: SegmentScorecardView[];
}

export interface TrustMetricsView {
  actions: {
    proposed: number;
    approved: number;
    rejected: number;
    executed: number;
    failed: number;
    rolled_back: number;
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
  /** LEARN-1 — per-segment governance scorecards. */
  scorecards(): Promise<ScorecardReportView> {
    return this.req('GET', '/metrics/scorecards');
  }
  /** RUN-1 — runs with governance rollups (the operator's unit of work). */
  runPlans(): Promise<{ runs: RunPlanView[] }> {
    return this.req('GET', '/agent-runs');
  }
  /** TRUST-2 — exportable trust packet (procurement/security artifact). */
  trustPacket(): Promise<Record<string, unknown>> {
    return this.req('GET', '/reports/trust-packet');
  }
  /** REGR-1 — anonymized regression-scenario candidate from a rejection. */
  regressionCandidate(id: string): Promise<{ candidate: Record<string, unknown> }> {
    return this.req('GET', `/agent-actions/${id}/regression-candidate`);
  }
  /** ENF-1 — connection + kill-switch state. */
  integrationStatus(): Promise<IntegrationStatusView> {
    return this.req('GET', '/integrations/status');
  }
  /** RDY-1 — go-live readiness gate (portal properties + connection). */
  integrationReadiness(): Promise<ReadinessView> {
    return this.req('GET', '/integrations/readiness');
  }
  /** ENF-1 — emergency stop (any operator). */
  pauseIntegration(system = 'hubspot'): Promise<{ system: string; status: string }> {
    return this.req('POST', `/integrations/${system}/pause`);
  }
  /** ENF-1 — resume (owner only). */
  resumeIntegration(system = 'hubspot'): Promise<{ system: string; status: string }> {
    return this.req('POST', `/integrations/${system}/resume`);
  }
  /** ENF-1 — code-derived governance matrix. */
  governance(): Promise<GovernanceMatrixView> {
    return this.req('GET', '/governance');
  }
  /** ENF-1 — queryable audit trail (newest first). */
  auditTrail(limit = 100): Promise<AuditTrailView> {
    return this.req('GET', `/audit?limit=${limit}`);
  }
  /** EVID-1 — integration sync history (newest first). */
  syncHistory(): Promise<{ sync_runs: SyncRunView[] }> {
    return this.req('GET', '/integrations/sync-history');
  }
  /** EVID-1 — opportunities visibility. */
  opportunities(): Promise<{ opportunities: OpportunityView[] }> {
    return this.req('GET', '/opportunities');
  }
  /** GOV-1 — the exact typed CRM write this action will perform. */
  previewAction(id: string): Promise<ExecutionPreviewView> {
    return this.req('GET', `/agent-actions/${id}/preview`);
  }
  /** WHY-1 — decision rationale (score + grounding facts + data freshness). */
  actionRationale(id: string): Promise<DecisionRationaleView> {
    return this.req('GET', `/agent-actions/${id}/rationale`);
  }
  /** SIM-1 — zero-write preflight simulation over the tenant's synced data. */
  preflight(body: { objective?: string; maxAccounts?: number } = {}): Promise<PreflightReportView> {
    return this.req('POST', '/agent-runs/mira/preflight', body);
  }
  execute(id: string): Promise<AgentActionView> {
    return this.req('POST', `/agent-actions/${id}/execute`);
  }
  /** UNDO-1 — undo an executed CRM write (requires a structured reason). */
  rollback(id: string, reason: DecisionReasonInput): Promise<AgentActionView> {
    return this.req('POST', `/agent-actions/${id}/rollback`, { reason });
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
