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

/** Operator view of a Proof Registry row (COG-003). */
export interface ProofView {
  id: string;
  kind: string;
  subject_type: string;
  subject_id: string;
  evidence_tag: 'verified_fact' | 'likely_inference' | 'unknown';
  evidence_ref: string | null;
  verifier_ref: string | null;
  summary_public: string | null;
  public_safe: boolean;
  redaction_check_passed_at: string | null;
  supersedes_proof_id: string | null;
  created_at: string;
}

/** Public-safe projection — the only shape a non-operator surface may see. */
export interface PublicProofView {
  id: string;
  kind: string;
  evidence_tag: string;
  summary_public: string | null;
  supersedes_proof_id: string | null;
  created_at: string;
}

export interface RedactionCheckView {
  proof: ProofView;
  publish_safe: boolean;
  /** Audit-safe labels (counts + pattern names), never the matched PII. */
  findings: string[];
}

/** Agent registry row with its newest ATC status embedded (COG-004). */
export interface AgentView {
  id: string;
  name: string;
  slug: string;
  runtime_key: string | null;
  kind: string;
  status: string;
  description: string | null;
  created_at: string;
  atc_status: 'active' | 'suspended' | 'revoked' | 'expired' | 'none';
  atc_count: number;
}

export interface AtcView {
  id: string;
  agent_id: string;
  issuer: string;
  subject_ref: string;
  claims: { scope?: string[]; vertical?: string; policy_refs?: string[] };
  status: string;
  issued_at: string;
  expires_at: string | null;
  external_ref: string | null;
  version: number;
}

export interface AgentPermissionView {
  action_key: string;
  effect: 'allow' | 'deny';
  constraints: Record<string, unknown>;
}

export interface AgentDetailView {
  agent: Omit<AgentView, 'atc_status' | 'atc_count'>;
  atcs: AtcView[];
  permissions: AgentPermissionView[];
}

/** Masked lead view (COG-006) — raw PII never appears in lists. */
export interface MaskedLeadView {
  id: string;
  source: string;
  phone_masked: string;
  received_at: string;
  consent_captured: boolean;
  pii_status: string;
  status: string;
}

export interface LeadDetailView {
  lead: MaskedLeadView & { contact_name: string | null; message_body: string | null };
  /** COG-011 aggregate: the lead's full story in one read. */
  actions: Array<
    AgentActionView & {
      simulation?: boolean | null;
      proof_id?: string | null;
      created_at?: string;
    }
  >;
  outcomes: Array<{
    id: string;
    outcome: string;
    evidence_tag: string;
    evidence_source: string | null;
    booking_value_cents: number | null;
    estimated_value_cents: number | null;
    created_at: string;
  }>;
  proofs: Array<{
    id: string;
    kind: string;
    evidence_tag: string;
    summary_public: string | null;
    public_safe: boolean;
    created_at: string;
  }>;
  audit_refs: Array<{ action: string; subject_ref: string; occurred_at: string }>;
}

export interface FrontDeskExecuteView {
  action: AgentActionView & { proof_id?: string | null };
  proof_id: string;
  response_time_ms: number;
}

export interface LeadRescueSummaryView {
  total_leads: number;
  leads_needing_response: number;
  actions_proposed: number;
  rescued_leads: number;
  booking_intents: number;
  booked_jobs: number;
  unknown_outcomes: number;
  estimated_value_cents: number;
  /** Verified (verified_fact) booked value only — doctrine §13. */
  verified_booked_value_cents: number;
}

export interface ReputationSnapshotView {
  id: string;
  agent_id: string;
  score: number;
  computed_at: string;
  inputs_hash: string;
}

/** Agent reputation (COG-008): only verified_fact proofs add to it. */
export interface ReputationView {
  agent_id: string;
  score: number;
  event_count: number;
  events: Array<{
    id: string;
    delta: number;
    reason_code: string;
    proof_id: string;
    created_at: string;
  }>;
  latest_snapshot: ReputationSnapshotView | null;
  snapshot_current: boolean;
}

/** Internal credits account (COG-009): accounting only, never a currency. */
export interface CreditsAccountView {
  id: string;
  owner_type: string;
  owner_id: string;
  status: string;
  balance: number;
  created_at: string;
}

export interface CreditsTransferResultView {
  idempotency_key: string;
  amount: number;
  replayed: boolean;
  from_balance: number;
  to_balance: number;
}

/** Inert wallet placeholder (Lane C): no keys, no chain activity. */
export interface WalletBindingView {
  id: string;
  owner_type: string;
  owner_id: string;
  chain: string;
  address: string | null;
  status: string;
}

/** AGENT-ECONOMY-001 work order (internal credits escrow; simulation-only). */
export interface WorkOrderView {
  id: string;
  requester_agent_id: string;
  worker_agent_id: string | null;
  skill_version_id: string | null;
  title: string;
  description: string | null;
  status: string;
  requested_credits: number;
  escrow_status: string;
  proof_required: boolean;
  proof_id: string | null;
  outcome_type: string | null;
  evidence_tag: string | null;
  /** AGENT-ECONOMY-002: set when an owner resolved a dispute. */
  resolution_proof_id?: string | null;
  resolution?: {
    decision: string;
    reason_code: string;
    worker_credits: number;
    requester_credits: number;
  } | null;
  created_at: string;
}

/** AGENT-ECONOMY-003: an agent's ask on the Action Ledger (approval-gated). */
export interface EconomyAgentActionView {
  id: string;
  action_type: string;
  risk_level: string;
  approval_status: string;
  execution_status: string;
  target_ref: string;
  proof_id: string | null;
  result: {
    proposed_payload?: { work_order_id: string; agent_id: string };
    requires_human_approval?: boolean;
  } | null;
  decisions: Array<{ label: string; detail: Record<string, unknown> }>;
  created_at: string;
}

/** AGENT-ECONOMY-004: tier-aware internal marketplace view. */
export interface MarketplaceMatchView {
  listing: { id: string; price_credits: number; summary: string | null; status: string };
  skill: { id: string; name: string; slug: string };
  version: { id: string; version: string; proof_tier: number };
  agent: { id: string; name: string; slug: string };
  atc_active: boolean;
  reputation_score: number;
  verified_work_orders: number;
  match_score: number;
  eligible_for_verified_work: boolean;
}
export interface MarketplaceViewResponse {
  matches: MarketplaceMatchView[];
  suppressed: Array<{ listing_id: string; reason: string }>;
  withdrawn_count: number;
  ranking_rule: string;
}

/** AGENT-ECONOMY-001 lab summary; mirrors apps/api buildEconomySummary. */
export interface EconomySummaryView {
  work_orders: { total: number; by_status: Record<string, number> };
  escrow: {
    rail: string;
    reserved_credits: number;
    released_credits: number;
    refunded_credits: number;
    disputed_credits: number;
    resolved_credits: number;
  };
  agents: { total: number };
  skills: { total: number };
  marketplace: { active_listings: number; withdrawn_listings: number; visibility: string };
  reputation: { economy_events: number; economy_delta_sum: number };
  wallet_placeholders: { total: number; statuses: string[] };
  token_public_status: string;
  legal_gate: string;
}

/** COG-007 Command Dashboard aggregate. Keys mirror apps/api commandSummary. */
export interface CommandSummaryView {
  trustSummary: Record<string, number>;
  skillproofSummary: Record<string, number | string>;
  frontdeskSummary: Record<string, number>;
  reputationSummary: {
    agents_with_snapshots: number;
    top_agents_by_score: Array<{ agent_id: string; score: number }>;
    verified_completed_actions: number;
    failed_actions: number;
    blocked_actions: number;
    unknown_claims: number;
    last_recalculated_at: string | null;
  };
  creditsSummary: Record<string, number | string | boolean>;
  cryptoReadinessSummary: Record<string, string | string[]>;
  blockers: Array<{ key: string; status: string; note: string }>;
}

/** Internal crypto-readiness summary (Lane C; operator-only, no marketing). */
export interface CryptoReadinessView {
  statement: string;
  credits_accounts: number;
  ledger_entries: number;
  wallet_bindings: number;
  conceptual_rails: Array<{ rail: string; status: string }>;
  token_public_status: string;
  legal_gate: string;
  real_payment_execution: string;
  base_evm_optionality: string;
  future_integration_refs: string[];
  dex_or_liquidity_plan: string;
  staking_or_reward_programs: string;
  public_token_launch_readiness: string;
}

/** Internal SkillProof listing (COG-005); never a marketplace. */
export interface SkillListView {
  id: string;
  name: string;
  slug: string;
  namespace: string;
  category: string;
  visibility: string;
  source_path: string | null;
  version_count: number;
  proof_count: number;
  top_proof_tier: number;
  yanked: boolean;
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

  // --- COG-003: Proof Registry ---

  /** Operator proof list, optionally filtered by evidence tag. */
  listProofs(evidenceTag?: string): Promise<{ proofs: ProofView[] }> {
    const q = evidenceTag ? `?evidence_tag=${encodeURIComponent(evidenceTag)}` : '';
    return this.req('GET', `/proofs${q}`);
  }
  /** Public-safe projection (redaction-checked rows, public fields only). */
  listPublicProofs(): Promise<{ proofs: PublicProofView[] }> {
    return this.req('GET', '/proofs/public');
  }
  /** Run the PII redaction check; flips public_safe only when the scan is clean. */
  proofRedactionCheck(id: string): Promise<RedactionCheckView> {
    return this.req('POST', `/proofs/${id}/redaction-check`);
  }

  // --- COG-004: agents + Agent Trust Credentials ---

  listAgents(): Promise<{ agents: AgentView[] }> {
    return this.req('GET', '/agents');
  }
  getAgent(id: string): Promise<AgentDetailView> {
    return this.req('GET', `/agents/${id}`);
  }
  registerAgent(body: {
    name: string;
    slug: string;
    kind?: string;
    description?: string;
  }): Promise<{ agent: AgentDetailView['agent'] }> {
    return this.req('POST', '/agents', body);
  }
  issueAtc(
    agentId: string,
    claims: { scope?: string[]; vertical?: string; policy_refs?: string[] } = {},
  ): Promise<{ atc: AtcView }> {
    return this.req('POST', `/agents/${agentId}/atc`, { claims });
  }
  /** suspend/resume/expire: operator+; revoke: owner-only (terminal). */
  atcTransition(
    id: string,
    action: 'suspend' | 'resume' | 'expire' | 'revoke',
  ): Promise<{ atc: AtcView }> {
    return this.req('POST', `/atc/${id}/${action}`);
  }

  // --- COG-008: Reputation v0 (read + recompute; events are never posted) ---

  getAgentReputation(agentId: string): Promise<ReputationView> {
    return this.req('GET', `/agents/${agentId}/reputation`);
  }
  recomputeReputation(
    agentId: string,
  ): Promise<{ snapshot: ReputationSnapshotView; was_current: boolean }> {
    return this.req('POST', `/agents/${agentId}/reputation/recompute`);
  }

  // --- COG-006: MoverOS AI Front Desk (simulation-first) ---

  listLeads(): Promise<{ leads: MaskedLeadView[] }> {
    return this.req('GET', '/leads');
  }
  getLead(id: string): Promise<LeadDetailView> {
    return this.req('GET', `/leads/${id}`);
  }
  ingestLead(body: {
    source: 'sms_sim' | 'web' | 'manual';
    contact_name?: string;
    contact_phone: string;
    message_body: string;
    consent_captured: boolean;
  }): Promise<{ lead: MaskedLeadView }> {
    return this.req('POST', '/leads', body);
  }
  /** Propose a front-desk action (propose_sms_reply runs the SMS pipeline). */
  proposeLeadAction(
    leadId: string,
    action: string,
    note?: string,
  ): Promise<{ action: AgentActionView & { simulation?: boolean }; proof_id: string | null }> {
    return this.req('POST', `/leads/${leadId}/actions`, { action, note });
  }
  /** Simulated send of an APPROVED front-desk action; real SMS is refused. */
  executeFrontDeskAction(actionId: string): Promise<FrontDeskExecuteView> {
    return this.req('POST', `/front-desk/actions/${actionId}/execute`);
  }
  recordLeadOutcome(
    leadId: string,
    body: {
      outcome: string;
      evidence_tag: 'verified_fact' | 'likely_inference' | 'unknown';
      evidence_source?: string;
      estimated_value_cents?: number;
      booked_value_cents?: number;
      agent_id?: string;
    },
  ): Promise<{ outcome_id: string; proof_id: string; reputation_event_id: string | null }> {
    return this.req('POST', `/leads/${leadId}/outcomes`, body);
  }
  leadRescueSummary(): Promise<LeadRescueSummaryView> {
    return this.req('GET', '/front-desk/summary');
  }
  purgeLeadPii(leadId: string): Promise<{ lead: MaskedLeadView }> {
    return this.req('POST', `/leads/${leadId}/purge-pii`);
  }

  // --- COG-009: internal credits + wallet placeholders (no payments) ---

  listCreditsAccounts(): Promise<{ accounts: CreditsAccountView[] }> {
    return this.req('GET', '/credits/accounts');
  }
  openCreditsAccount(body: {
    owner_type: 'tenant' | 'agent' | 'system';
    owner_id: string;
  }): Promise<{ account: CreditsAccountView }> {
    return this.req('POST', '/credits/accounts', body);
  }
  transferCredits(body: {
    from_account_id: string;
    to_account_id: string;
    amount: number;
    reason_code: string;
    idempotency_key: string;
  }): Promise<CreditsTransferResultView> {
    return this.req('POST', '/credits/transfer', body);
  }
  listWalletBindings(): Promise<{ bindings: WalletBindingView[] }> {
    return this.req('GET', '/wallet-bindings');
  }
  createWalletBinding(body: {
    owner_type: 'tenant' | 'agent';
    owner_id: string;
  }): Promise<{ binding: WalletBindingView }> {
    return this.req('POST', '/wallet-bindings', body);
  }
  deactivateWalletBinding(id: string): Promise<{ binding: WalletBindingView }> {
    return this.req('POST', `/wallet-bindings/${id}/deactivate`);
  }
  cryptoReadiness(): Promise<CryptoReadinessView> {
    return this.req('GET', '/crypto-readiness');
  }
  /** COG-007: the Command Dashboard aggregate (no PII; honest zeros). */
  commandSummary(): Promise<CommandSummaryView> {
    return this.req('GET', '/cognitia/command/summary');
  }

  // --- AGENT-ECONOMY-001: Agent Economy Lab (internal, simulation-only) ---

  listWorkOrders(): Promise<{ work_orders: WorkOrderView[] }> {
    return this.req('GET', '/agent-economy/work-orders');
  }
  createWorkOrder(body: {
    requester_agent_id: string;
    title: string;
    description?: string;
    skill_version_id?: string;
    requested_credits: number;
  }): Promise<{ work_order: WorkOrderView }> {
    return this.req('POST', '/agent-economy/work-orders', body);
  }
  acceptWorkOrder(
    id: string,
    body: { worker_agent_id: string },
  ): Promise<{ work_order: WorkOrderView }> {
    return this.req('POST', `/agent-economy/work-orders/${id}/accept`, body);
  }
  deliverWorkOrder(
    id: string,
    body: { result_summary?: string; proof_id?: string } = {},
  ): Promise<{ work_order: WorkOrderView }> {
    return this.req('POST', `/agent-economy/work-orders/${id}/deliver`, body);
  }
  /** Owner-only: releases escrow against a verified_fact proof. */
  verifyWorkOrder(id: string): Promise<{ work_order: WorkOrderView }> {
    return this.req('POST', `/agent-economy/work-orders/${id}/verify`);
  }
  rejectWorkOrder(id: string, reasonCode: string): Promise<{ work_order: WorkOrderView }> {
    return this.req('POST', `/agent-economy/work-orders/${id}/reject`, {
      reason: { reason_code: reasonCode },
    });
  }
  disputeWorkOrder(id: string, reasonCode: string): Promise<{ work_order: WorkOrderView }> {
    return this.req('POST', `/agent-economy/work-orders/${id}/dispute`, {
      reason: { reason_code: reasonCode },
    });
  }
  cancelWorkOrder(id: string): Promise<{ work_order: WorkOrderView }> {
    return this.req('POST', `/agent-economy/work-orders/${id}/cancel`);
  }
  // AGENT-ECONOMY-003: agent proposals via the Action Ledger. Approval rides
  // the existing approveAction/rejectAction methods above.
  listEconomyActions(): Promise<{ actions: EconomyAgentActionView[] }> {
    return this.req('GET', '/agent-economy/actions');
  }
  proposeEconomyAction(
    workOrderId: string,
    kind: 'accept' | 'deliver' | 'dispute',
    body: {
      agent_id: string;
      proof_id?: string;
      result_summary?: string;
      reason_code?: string;
    },
  ): Promise<{ action: EconomyAgentActionView; proof_id: string | null; replayed: boolean }> {
    return this.req('POST', `/agent-economy/work-orders/${workOrderId}/propose-${kind}`, body);
  }
  executeEconomyAction(
    actionId: string,
  ): Promise<{ action: EconomyAgentActionView; work_order: WorkOrderView | null }> {
    return this.req('POST', `/agent-economy/actions/${actionId}/execute`);
  }
  // AGENT-ECONOMY-004: internal marketplace skeleton (visibility check-locked).
  getMarketplace(): Promise<MarketplaceViewResponse> {
    return this.req('GET', '/agent-economy/marketplace');
  }
  createMarketplaceListing(body: {
    agent_id: string;
    skill_version_id: string;
    price_credits: number;
    summary?: string;
  }): Promise<{ listing: { id: string } }> {
    return this.req('POST', '/agent-economy/marketplace/listings', body);
  }
  setListingStatus(
    id: string,
    action: 'unlist' | 'relist',
  ): Promise<{ listing: { id: string; status: string } }> {
    return this.req('POST', `/agent-economy/marketplace/listings/${id}/${action}`);
  }
  orderFromListing(
    id: string,
    body: { requester_agent_id: string; title?: string },
  ): Promise<{
    work_order: WorkOrderView;
    accept_ask: EconomyAgentActionView | null;
    accept_ask_blocked: string | null;
  }> {
    return this.req('POST', `/agent-economy/marketplace/listings/${id}/order`, body);
  }
  /** Owner-only arbitration over held escrow (AGENT-ECONOMY-002). */
  resolveWorkOrder(
    id: string,
    body: {
      decision: 'release' | 'refund' | 'split';
      reason_code: string;
      worker_credits?: number;
      requester_credits?: number;
    },
  ): Promise<{ work_order: WorkOrderView }> {
    return this.req('POST', `/agent-economy/work-orders/${id}/resolve`, body);
  }
  economySummary(): Promise<EconomySummaryView> {
    return this.req('GET', '/agent-economy/summary');
  }

  // --- COG-005: SkillProof (internal-only) ---

  listSkills(): Promise<{ skills: SkillListView[] }> {
    return this.req('GET', '/skills');
  }
  importCoreSkills(): Promise<{
    imported: number;
    with_real_source: number;
    seeded_without_source: number;
    skipped_existing: number;
  }> {
    return this.req('POST', '/skills/import-core');
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
