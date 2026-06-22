/**
 * TrustOps analytics over mock Sales-Closer workflow + proof events.
 *
 * This module is intentionally SELF-CONTAINED: it defines its own input event
 * vocabulary (mirroring — but not importing — the Sales Closer workflow run
 * shape) so analytics can be computed over any source of mock workflow-run
 * summaries. All functions here are pure and deterministic: identical input
 * always yields identical output, with no clock, randomness, or IO.
 *
 * Everything analyzed here is MOCK / SANDBOX data. The metrics deliberately
 * carry NO raw PII — only aggregate counts, references, and reason strings.
 */

/* ------------------------------------------------------------------ vocabulary */

/** Compliance boundary outcome (mirrors the workflow compliance result). */
export type ComplianceOutcome = 'pass' | 'blocked';

/** Human-approval boundary outcome (mirrors the workflow approval result). */
export type ApprovalOutcome = 'approved' | 'rejected' | 'pending';

/** Appointment boundary outcome. */
export type AppointmentOutcome = 'requested' | 'succeeded' | 'failed' | 'skipped';

/** CRM mock-writeback boundary outcome. */
export type CrmOutcome = 'ok' | 'failed' | 'skipped';

/** Terminal disposition of a single workflow run. */
export type RunStatus = 'completed' | 'blocked' | 'awaiting_approval';

/**
 * A single mock workflow-run summary. This is the analytics input unit — one
 * record per lead driven through the (mock) Sales Closer workflow.
 *
 * Self-contained by design: it is NOT imported from the closer lane. Callers
 * adapt their own run records into this shape. It carries NO raw PII; the only
 * identifier is an opaque `runId` (and optional opaque references).
 */
export interface WorkflowRunSummary {
  /** Opaque, non-PII run identifier. */
  runId: string;
  /** Tenant scope. Sandbox analytics expect the demo tenant. */
  tenant?: string;
  /** Terminal disposition of the run. */
  status: RunStatus;
  /** Compliance boundary outcome (every run reaches compliance). */
  compliance: ComplianceOutcome;
  /** Human-approval outcome. `undefined` when the run blocked before approval. */
  approval?: ApprovalOutcome;
  /** Appointment outcome. `undefined` when never reached. */
  appointment?: AppointmentOutcome;
  /** CRM mock-writeback outcome. `undefined` when never reached. */
  crm?: CrmOutcome;
  /** Count of proof events recorded during the run. */
  proofEventsRecorded?: number;
  /** Human-readable reason when the run was blocked (no PII). */
  blockedReason?: string;
}

/** Where a run was blocked, derived from which boundary produced the block. */
export type BlockStage = 'compliance' | 'approval' | 'appointment' | 'crm' | 'proof' | 'unknown';

/* -------------------------------------------------------------------- metrics */

export interface FunnelMetrics {
  /** Leads received = total runs analyzed. */
  leadsReceived: number;
  compliancePass: number;
  complianceBlock: number;
  approvalApproved: number;
  approvalRejected: number;
  approvalPending: number;
  appointmentRequested: number;
  appointmentSucceeded: number;
  crmWritten: number;
  proofEventsRecorded: number;
  completed: number;
  blocked: number;
  awaitingApproval: number;
}

/** A grouped blocked-reason count. */
export interface BlockedReasonGroup {
  stage: BlockStage;
  reason: string;
  count: number;
}

/** No-live-egress attestation embedded in every metrics computation. */
export interface EgressAttestation {
  /** Always true for sandbox analytics — no network egress occurs. */
  noLiveEgress: true;
  /** Fixed mode label. */
  mode: 'MOCK_SANDBOX';
  /** Human-readable statement. */
  statement: string;
}

export interface TrustOpsMetrics {
  funnel: FunnelMetrics;
  /** Blocked runs grouped by (stage, reason), sorted deterministically. */
  blockedReasons: BlockedReasonGroup[];
  /**
   * Approval coverage = fraction of runs that reached the approval gate and
   * received an explicit human decision (approved or rejected, not pending),
   * in [0, 1]. A coverage of 1 means every run that needed a human got one.
   */
  approvalCoverage: number;
  /** No-live-egress attestation. */
  egress: EgressAttestation;
}

const EGRESS_ATTESTATION: EgressAttestation = {
  noLiveEgress: true,
  mode: 'MOCK_SANDBOX',
  statement:
    'All analyzed events are mock/sandbox. No live network egress occurred during ' +
    'workflow execution or analytics computation.',
};

/** Map a blocked run to the stage at which it blocked, using its outcomes. */
export function classifyBlockStage(run: WorkflowRunSummary): BlockStage {
  if (run.status !== 'blocked') return 'unknown';
  if (run.compliance === 'blocked') return 'compliance';
  if (run.approval === 'rejected') return 'approval';
  if (run.appointment === 'failed') return 'appointment';
  if (run.crm === 'failed') return 'crm';
  // Reached the end of the known boundaries but still blocked → proof stage.
  if (run.crm === 'ok') return 'proof';
  return 'unknown';
}

/** Normalize a missing/blank reason into a stable label. */
function reasonLabel(reason: string | undefined): string {
  const trimmed = (reason ?? '').trim();
  return trimmed.length > 0 ? trimmed : '(unspecified)';
}

/**
 * Compute funnel + safety metrics over a list of mock workflow-run summaries.
 * Pure and deterministic. The result carries an egress attestation and no PII.
 */
export function computeTrustOpsMetrics(runs: readonly WorkflowRunSummary[]): TrustOpsMetrics {
  const funnel: FunnelMetrics = {
    leadsReceived: runs.length,
    compliancePass: 0,
    complianceBlock: 0,
    approvalApproved: 0,
    approvalRejected: 0,
    approvalPending: 0,
    appointmentRequested: 0,
    appointmentSucceeded: 0,
    crmWritten: 0,
    proofEventsRecorded: 0,
    completed: 0,
    blocked: 0,
    awaitingApproval: 0,
  };

  // (stage::reason) → group accumulator.
  const blockedMap = new Map<string, BlockedReasonGroup>();

  // Runs that reached the approval gate, and of those, how many got a decision.
  let approvalReached = 0;
  let approvalDecided = 0;

  for (const run of runs) {
    // Compliance.
    if (run.compliance === 'pass') funnel.compliancePass += 1;
    else funnel.complianceBlock += 1;

    // Approval.
    if (run.approval === 'approved') funnel.approvalApproved += 1;
    else if (run.approval === 'rejected') funnel.approvalRejected += 1;
    else if (run.approval === 'pending') funnel.approvalPending += 1;

    if (run.approval !== undefined) {
      approvalReached += 1;
      if (run.approval === 'approved' || run.approval === 'rejected') approvalDecided += 1;
    }

    // Appointment.
    if (run.appointment === 'requested') funnel.appointmentRequested += 1;
    else if (run.appointment === 'succeeded') {
      // A succeeded appointment was necessarily requested.
      funnel.appointmentRequested += 1;
      funnel.appointmentSucceeded += 1;
    }

    // CRM (mock).
    if (run.crm === 'ok') funnel.crmWritten += 1;

    // Proof events.
    funnel.proofEventsRecorded += Math.max(0, run.proofEventsRecorded ?? 0);

    // Status rollup.
    if (run.status === 'completed') funnel.completed += 1;
    else if (run.status === 'blocked') funnel.blocked += 1;
    else funnel.awaitingApproval += 1;

    // Blocked-reason grouping.
    if (run.status === 'blocked') {
      const stage = classifyBlockStage(run);
      const reason = reasonLabel(run.blockedReason);
      const key = `${stage}::${reason}`;
      const existing = blockedMap.get(key);
      if (existing) existing.count += 1;
      else blockedMap.set(key, { stage, reason, count: 1 });
    }
  }

  const blockedReasons = [...blockedMap.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (a.stage !== b.stage) return a.stage < b.stage ? -1 : 1;
    return a.reason < b.reason ? -1 : a.reason > b.reason ? 1 : 0;
  });

  const approvalCoverage = approvalReached === 0 ? 1 : approvalDecided / approvalReached;

  return {
    funnel,
    blockedReasons,
    approvalCoverage,
    egress: EGRESS_ATTESTATION,
  };
}

/* ------------------------------------------------------------- trust/safety score */

/** Transparent breakdown of the 0-100 trust/safety score. */
export interface TrustScoreComponent {
  /** Component key. */
  key: 'approvalCoverage' | 'complianceBlockHandling' | 'egressClean' | 'proofCoverage';
  /** Human-readable label. */
  label: string;
  /** Max points this component can contribute. */
  weight: number;
  /** Normalized achievement in [0, 1]. */
  ratio: number;
  /** Points earned = round(weight * ratio). */
  earned: number;
}

export interface TrustScore {
  /** Total score in [0, 100]. */
  score: number;
  /** Per-component breakdown; weights sum to 100. */
  components: TrustScoreComponent[];
}

/**
 * Compute a transparent 0-100 trust/safety score from metrics. Each component
 * is independently auditable; weights sum to 100. Deterministic and pure.
 *
 * Components:
 *  - approvalCoverage (40): every run needing a human got an explicit decision.
 *  - complianceBlockHandling (25): blocked-compliance runs are correctly halted
 *    (no completed run ever skipped a compliance block). 1.0 when no completed
 *    run came from a compliance-blocked path.
 *  - egressClean (25): the no-live-egress attestation holds (binary).
 *  - proofCoverage (10): completed runs recorded at least one proof event each.
 */
export function computeTrustScore(metrics: TrustOpsMetrics): TrustScore {
  const { funnel, approvalCoverage, egress } = metrics;

  // complianceBlockHandling: a blocked-compliance run must never be completed.
  // We can only observe aggregates here, so the invariant is: the number of
  // completed runs cannot exceed the number that passed compliance.
  const complianceHandlingRatio =
    funnel.compliancePass === 0
      ? 1
      : Math.min(1, Math.max(0, funnel.compliancePass) / Math.max(1, funnel.compliancePass)) *
        (funnel.completed <= funnel.compliancePass ? 1 : 0);

  // proofCoverage: every completed run should have produced >= 1 proof event.
  // Expected minimum is one proof per completed run.
  const proofRatio =
    funnel.completed === 0
      ? 1
      : Math.min(1, funnel.proofEventsRecorded / funnel.completed);

  const components: TrustScoreComponent[] = [
    {
      key: 'approvalCoverage',
      label: 'Human-approval coverage',
      weight: 40,
      ratio: clamp01(approvalCoverage),
      earned: 0,
    },
    {
      key: 'complianceBlockHandling',
      label: 'Compliance-block handling',
      weight: 25,
      ratio: clamp01(complianceHandlingRatio),
      earned: 0,
    },
    {
      key: 'egressClean',
      label: 'No-live-egress attestation',
      weight: 25,
      ratio: egress.noLiveEgress ? 1 : 0,
      earned: 0,
    },
    {
      key: 'proofCoverage',
      label: 'Proof-event coverage of completed runs',
      weight: 10,
      ratio: clamp01(proofRatio),
      earned: 0,
    },
  ];

  let score = 0;
  for (const c of components) {
    c.earned = Math.round(c.weight * c.ratio);
    score += c.earned;
  }

  return { score: Math.max(0, Math.min(100, score)), components };
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
