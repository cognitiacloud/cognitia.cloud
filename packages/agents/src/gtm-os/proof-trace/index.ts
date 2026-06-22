/**
 * GTM proof / action trace — the single auditable evidence object.
 *
 * The assembly island ({@link GtmRunPacket}) already carries the proof events
 * and the operator timeline. The B2 dry-run channel plan and the B3 CRM-lite
 * records live alongside it on the integrated route. This module folds all of
 * those into ONE ordered, PII-safe trace that maps the full action chain:
 *
 *   lead → compliance → approval → dry-run plan → CRM-lite → TrustOps
 *
 * Each step records what happened, how it resolved, and which append-only proof
 * events back it — so an auditor can read a single artifact and see, per lead,
 * exactly which boundary advanced, halted, or blocked, and which evidence was
 * recorded. The trace also carries the canonical TrustOps run summary it
 * contributes, binding the per-lead chain to the aggregate B5 metrics.
 *
 * MOCK / SANDBOX by construction:
 *   - No raw PII. Steps reference only proof `kind`/`id`/`evidenceTag` and the
 *     already-`public_safe` `summaryPublic`; raw `detailsPrivate` is never
 *     projected onto the trace. {@link assertTraceNoRawPii} is a belt-and-braces
 *     guard run before any trace is returned.
 *   - No live egress. The dry-run plan is `sent:false` by type; the trace
 *     merely counts and references the planned actions.
 *
 * This module imports only `@cognitia/core` types, the sibling assembly island,
 * the channel/CRM lane types it summarizes, and the self-contained TrustOps
 * summary shape — never a network/vendor module.
 */

import type { GtmEvidenceTag, GtmProofEvent, GtmProofKind } from '@cognitia/core';
import type { GtmRunPacket } from '../assembly/index.js';
import { assertNoRawPii } from '../assembly/guards.js';
import type { DryRunAction } from '../../channels/dryRunChannels.js';
import type { Opportunity } from '../../crm-lite/mockCrmLite.js';
import type { WorkflowRunSummary, RunStatus } from '../../trustops/metrics.js';

/** The ordered stages of the GTM action chain. */
export type ProofTraceStage =
  | 'lead'
  | 'compliance'
  | 'approval'
  | 'dry_run_plan'
  | 'crm_lite'
  | 'trustops';

/** How a single stage resolved for one lead. */
export type ProofTraceStatus = 'passed' | 'halted' | 'blocked' | 'not_reached';

/** A PII-safe reference to a proof event recorded during the run. */
export interface ProofRef {
  id: string;
  kind: GtmProofKind;
  evidenceTag: GtmEvidenceTag;
  /** Already `public_safe` summary string (business facts only, no PII). */
  summaryPublic: string | null;
}

/** One stage of the action chain, with its outcome and backing proofs. */
export interface ProofTraceStep {
  stage: ProofTraceStage;
  /** Short operator-facing label, e.g. "Compliance check". */
  label: string;
  status: ProofTraceStatus;
  /** Non-PII detail (reason / count / summary) for the stage. */
  detail?: string;
  /** Proof events recorded at (or attributable to) this stage. */
  proofs: ProofRef[];
}

/** Ordered, PII-safe evidence object for a single lead's run. */
export interface GtmProofTrace {
  /** Opaque, non-PII lead reference (the prospect id). */
  leadRef: string;
  /** Business name (not PII under platform doctrine). */
  company: string;
  /** Always 'mock' — the assembly island has no live mode. */
  mode: GtmRunPacket['mode'];
  /** Workspace/tenant the run is attributed to. */
  workspaceId: string;
  sandbox: boolean;
  /** Terminal disposition mirrored from the run. */
  status: RunStatus;
  blockedReason?: string;
  /** The full ordered chain: lead → … → trustops. */
  steps: ProofTraceStep[];
  /** Total append-only proof events recorded during the run. */
  proofEventCount: number;
  /** Number of planned dry-run actions (all `sent:false`). */
  dryRunActionCount: number;
  /** Canonical TrustOps run summary this lead contributes to B5 metrics. */
  trustOpsSummary: WorkflowRunSummary;
  /** Runtime attestation copied from the packet's no-egress guard. */
  noEgressStatement: string;
}

/** Map each proof kind to the stage of the chain it backs. Total over the union. */
const PROOF_STAGE: Record<GtmProofKind, ProofTraceStage> = {
  'gtm.prospect.sourced.v1': 'lead',
  'gtm.source.reviewed.v1': 'compliance',
  'gtm.outreach.review_required.v1': 'approval',
  'gtm.outreach.drafted.v1': 'dry_run_plan',
  // Appointment + proposal proofs are recorded around the CRM writeback phase.
  'gtm.discovery.booked.v1': 'crm_lite',
  'gtm.proposal.generated.v1': 'crm_lite',
};

const STAGE_LABEL: Record<ProofTraceStage, string> = {
  lead: 'Lead received',
  compliance: 'Compliance check',
  approval: 'Human approval gate',
  dry_run_plan: 'Dry-run channel plan',
  crm_lite: 'CRM-lite writeback (mock)',
  trustops: 'TrustOps aggregation',
};

/** Project a proof event onto a PII-safe reference (drops `detailsPrivate`). */
function toProofRef(event: GtmProofEvent): ProofRef {
  return {
    id: event.id,
    kind: event.kind,
    evidenceTag: event.evidenceTag,
    summaryPublic: event.summaryPublic,
  };
}

/** Normalize the packet's tri-state status onto the TrustOps run vocabulary. */
function toRunStatus(packet: GtmRunPacket): RunStatus {
  return packet.status === 'completed' || packet.status === 'awaiting_approval'
    ? packet.status
    : 'blocked';
}

/**
 * Canonical mapping from a real assembly packet to a TrustOps run summary (B5
 * input). This is the single source of truth so the integrated route and the
 * trace agree — TrustOps metrics are always computed over real packet outputs,
 * never a hand-rolled mirror. Carries no raw PII (only the opaque prospect id,
 * the workspace, and aggregate outcomes/counts).
 */
export function packetToRunSummary(packet: GtmRunPacket): WorkflowRunSummary {
  return {
    runId: `run-${packet.prospect.id}`,
    tenant: packet.workspace.workspaceId,
    status: toRunStatus(packet),
    compliance: packet.compliance.blocked ? 'blocked' : 'pass',
    approval: packet.approval.status,
    appointment: packet.appointment.requested ? 'requested' : 'skipped',
    crm: packet.crm.written ? 'ok' : 'skipped',
    proofEventsRecorded: packet.proofs.length,
    blockedReason: packet.blockedReason,
  };
}

export interface BuildProofTraceInput {
  packet: GtmRunPacket;
  /** Real B2 dry-run actions planned for this lead (all `sent:false`). */
  dryRunActions?: readonly DryRunAction[];
  /** Real B3 CRM-lite opportunities written for this lead (mock). */
  crmRecords?: readonly Opportunity[];
}

/** Derive the compliance step from the packet. */
function complianceStep(packet: GtmRunPacket, proofs: ProofRef[]): ProofTraceStep {
  if (packet.compliance.blocked) {
    return {
      stage: 'compliance',
      label: STAGE_LABEL.compliance,
      status: 'blocked',
      detail: packet.compliance.reason ?? 'compliance gate blocked the run',
      proofs,
    };
  }
  return {
    stage: 'compliance',
    label: STAGE_LABEL.compliance,
    status: packet.compliance.passed ? 'passed' : 'not_reached',
    detail: packet.compliance.reason,
    proofs,
  };
}

/** Derive the approval step from the packet. */
function approvalStep(packet: GtmRunPacket, proofs: ProofRef[]): ProofTraceStep {
  // If compliance blocked, approval was never reached.
  if (packet.compliance.blocked) {
    return {
      stage: 'approval',
      label: STAGE_LABEL.approval,
      status: 'not_reached',
      detail: 'compliance blocked before the approval gate',
      proofs,
    };
  }
  const status: ProofTraceStatus =
    packet.approval.status === 'approved'
      ? 'passed'
      : packet.approval.status === 'rejected'
        ? 'blocked'
        : 'halted';
  return {
    stage: 'approval',
    label: STAGE_LABEL.approval,
    status,
    detail: packet.approval.reason,
    proofs,
  };
}

/** Derive the dry-run plan step from the planned (sent:false) actions. */
function dryRunStep(
  packet: GtmRunPacket,
  actions: readonly DryRunAction[],
  proofs: ProofRef[],
): ProofTraceStep {
  const proceeded = packet.approval.status === 'approved' && !packet.compliance.blocked;
  if (!proceeded) {
    return {
      stage: 'dry_run_plan',
      label: STAGE_LABEL.dry_run_plan,
      status: 'not_reached',
      detail: 'lead halted before outreach; no channel actions planned',
      proofs,
    };
  }
  // Every planned action is sent:false by construction; assert it here too.
  const liveLeak = actions.find((a) => a.sent !== false);
  if (liveLeak) {
    throw new Error(`gtm proof-trace: dry-run action for ${liveLeak.channel} is not sent:false`);
  }
  const channels = actions.map((a) => a.channel).join(', ');
  return {
    stage: 'dry_run_plan',
    label: STAGE_LABEL.dry_run_plan,
    status: 'passed',
    detail:
      actions.length > 0
        ? `${actions.length} action(s) planned (sent:false): ${channels}`
        : 'no channels configured for plan',
    proofs,
  };
}

/** Derive the CRM-lite step from the packet + the real CRM records for the lead. */
function crmStep(
  packet: GtmRunPacket,
  records: readonly Opportunity[],
  proofs: ProofRef[],
): ProofTraceStep {
  if (packet.finalState === 'blocked_crm') {
    return {
      stage: 'crm_lite',
      label: STAGE_LABEL.crm_lite,
      status: 'blocked',
      detail: packet.crm.reason ?? 'CRM writeback blocked',
      proofs,
    };
  }
  if (!packet.crm.written) {
    return {
      stage: 'crm_lite',
      label: STAGE_LABEL.crm_lite,
      status: 'not_reached',
      detail: 'CRM writeback never reached',
      proofs,
    };
  }
  const stages = records.map((r) => r.stage).join(', ');
  return {
    stage: 'crm_lite',
    label: STAGE_LABEL.crm_lite,
    status: 'passed',
    detail:
      records.length > 0
        ? `${records.length} mock record(s): ${stages}`
        : 'CRM writeback recorded (mock)',
    proofs,
  };
}

/**
 * Build the ordered, PII-safe proof/action trace for one lead's run.
 *
 * Folds the assembly packet (compliance/approval/CRM states + proof events),
 * the real B2 dry-run plan, and the real B3 CRM-lite records into a single
 * chain, attaches each proof event to the stage it backs, and appends the
 * canonical TrustOps run summary this lead contributes. Pure (no IO). Asserts
 * the no-raw-PII invariant before returning.
 */
export function buildProofTrace(input: BuildProofTraceInput): GtmProofTrace {
  const { packet } = input;
  const dryRunActions = input.dryRunActions ?? [];
  const crmRecords = input.crmRecords ?? [];

  // Bucket proof refs by the stage each kind backs.
  const byStage = new Map<ProofTraceStage, ProofRef[]>();
  for (const event of packet.proofs) {
    const stage = PROOF_STAGE[event.kind];
    const bucket = byStage.get(stage) ?? [];
    bucket.push(toProofRef(event));
    byStage.set(stage, bucket);
  }
  const proofsFor = (stage: ProofTraceStage): ProofRef[] => byStage.get(stage) ?? [];

  const trustOpsSummary = packetToRunSummary(packet);

  const steps: ProofTraceStep[] = [
    {
      stage: 'lead',
      label: STAGE_LABEL.lead,
      status: 'passed',
      detail: `Lead received for ${packet.prospect.companyName} (source: ${packet.prospect.source}).`,
      proofs: proofsFor('lead'),
    },
    complianceStep(packet, proofsFor('compliance')),
    approvalStep(packet, proofsFor('approval')),
    dryRunStep(packet, dryRunActions, proofsFor('dry_run_plan')),
    crmStep(packet, crmRecords, proofsFor('crm_lite')),
    {
      stage: 'trustops',
      label: STAGE_LABEL.trustops,
      status: 'passed',
      detail:
        `Contributed to TrustOps as ${trustOpsSummary.status} ` +
        `(${trustOpsSummary.proofEventsRecorded ?? 0} proof event(s) recorded).`,
      proofs: [],
    },
  ];

  const trace: GtmProofTrace = {
    leadRef: packet.prospect.id,
    company: packet.prospect.companyName,
    mode: packet.mode,
    workspaceId: packet.workspace.workspaceId,
    sandbox: packet.workspace.sandbox,
    status: trustOpsSummary.status,
    blockedReason: packet.blockedReason,
    steps,
    proofEventCount: packet.proofs.length,
    dryRunActionCount: dryRunActions.length,
    trustOpsSummary,
    noEgressStatement: packet.noEgress.statement,
  };

  assertTraceNoRawPii(trace);
  return trace;
}

/**
 * Belt-and-braces guard: throw if a serialized trace contains a raw email. The
 * trace projects only `public_safe` summaries and opaque refs, so this should
 * never fire — but a regression that leaks `detailsPrivate` onto a step is
 * caught loudly here rather than shipped. Reuses the assembly island guard.
 */
export function assertTraceNoRawPii(trace: GtmProofTrace): void {
  assertNoRawPii(trace, 'proof trace');
}
