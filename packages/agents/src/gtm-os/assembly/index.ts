import type { GtmProofEvent, RawGtmProspectInput } from '@cognitia/core';
import {
  createSalesCloserWorkflow,
  type CreateSalesCloserWorkflowOptions,
  type SalesCloserState,
  type WorkflowRun,
  type WorkflowStatus,
} from '../../closer/salesCloserWorkflow.js';
import { createMockCloserPorts, type MockPortOverrides } from '../../closer/mockPorts.js';
import {
  assertNoLiveEgress,
  assertNoRawPii,
  toPiiSafeProspect,
  type AssemblyMode,
  type NoEgressAttestation,
  type PiiSafeProspect,
} from './guards.js';
import { toOperatorTimeline, type TimelineRow } from './timeline.js';

/**
 * GTM assembly island — the canonical mock-safe composer.
 *
 * `assembleGtmRunPacket` runs ONE lead through the Sales Closer workflow (via
 * injected ports; mock ports by default) and folds the result into a single
 * "run packet": a PII-safe prospect, workspace attribution, the compliance /
 * approval / appointment / CRM states, the proof trace, an ordered operator
 * timeline, and a no-live-egress attestation.
 *
 * MOCK/SANDBOX: every boundary is an in-memory mock. There is NO network, no
 * vendor SDK, no live email/SMS/call/CRM sync. The packet reflects each
 * terminal/halt state honestly (completed / blocked / awaiting_approval).
 *
 * This module is self-contained: it imports only `@cognitia/core` and the
 * sibling `closer/` workflow — never a network/vendor module, never another new
 * lane.
 */

/** Workspace/tenant attribution carried on every packet. Sandbox only. */
export interface WorkspaceAttribution {
  workspaceId: string;
  /** True for the Budget Wheels demo / Tenant Zero sandbox. */
  sandbox: boolean;
}

/** Compliance state distilled from the run. */
export interface PacketComplianceState {
  /** Whether the run cleared the compliance gate. */
  passed: boolean;
  blocked: boolean;
  reason?: string;
}

/** Human-approval state distilled from the run. */
export interface PacketApprovalState {
  status: 'approved' | 'rejected' | 'pending';
  reason?: string;
}

/** Appointment state distilled from the run. */
export interface PacketAppointmentState {
  requested: boolean;
  reason?: string;
}

/** CRM (mock) writeback state distilled from the run. */
export interface PacketCrmState {
  written: boolean;
  reason?: string;
}

/** The single composed artifact this island produces. */
export interface GtmRunPacket {
  mode: AssemblyMode;
  workspace: WorkspaceAttribution;
  prospect: PiiSafeProspect;
  /** Terminal/halt classification straight from the workflow run. */
  status: WorkflowStatus;
  finalState: SalesCloserState;
  blockedReason?: string;
  compliance: PacketComplianceState;
  approval: PacketApprovalState;
  appointment: PacketAppointmentState;
  crm: PacketCrmState;
  /** Append-only proof events recorded during the run. */
  proofs: GtmProofEvent[];
  /** Ordered operator timeline derived from the workflow transitions. */
  timeline: TimelineRow[];
  /** Runtime attestation that no live egress occurred. */
  noEgress: NoEgressAttestation;
}

export interface AssembleGtmRunPacketOptions {
  lead: RawGtmProspectInput;
  /** Workspace this run is attributed to. Defaults to the Budget Wheels demo. */
  workspaceId?: string;
  /** Mock-port outcomes to drive happy / blocked / rejected / pending paths. */
  portOverrides?: MockPortOverrides;
  /** Injectable clock + id generator for determinism (forwarded to the workflow). */
  now?: CreateSalesCloserWorkflowOptions['now'];
  newId?: CreateSalesCloserWorkflowOptions['newId'];
}

const DEFAULT_WORKSPACE_ID = 'budget_wheels_demo';

/** Did the run reach (or pass through) a given state? */
function reachedState(run: WorkflowRun, state: SalesCloserState): boolean {
  return run.transitions.some((t) => t.to === state);
}

/** Find the transition produced by a given boundary, if any. */
function transitionVia(run: WorkflowRun, via: 'compliance' | 'approval' | 'appointment' | 'crm') {
  return run.transitions.find((t) => t.via === via);
}

function deriveCompliance(run: WorkflowRun): PacketComplianceState {
  const t = transitionVia(run, 'compliance');
  const blocked = run.state === 'blocked_compliance';
  return {
    passed: t?.to === 'human_approval_required',
    blocked,
    reason: blocked ? (run.blockedReason ?? t?.detail) : undefined,
  };
}

function deriveApproval(run: WorkflowRun): PacketApprovalState {
  const t = transitionVia(run, 'approval');
  if (run.state === 'blocked_approval') {
    return { status: 'rejected', reason: run.blockedReason ?? t?.detail };
  }
  if (run.status === 'awaiting_approval') {
    return { status: 'pending', reason: t?.detail };
  }
  // Only reached the appointment phase (or beyond) if approval was granted.
  if (t?.to === 'appointment_requested') {
    return { status: 'approved', reason: t.detail };
  }
  // Compliance blocked before approval was ever requested.
  return { status: 'pending', reason: t?.detail };
}

function deriveAppointment(run: WorkflowRun): PacketAppointmentState {
  const t = transitionVia(run, 'appointment');
  if (run.state === 'blocked_appointment') {
    return { requested: false, reason: run.blockedReason ?? t?.detail };
  }
  return { requested: reachedState(run, 'crm_writeback_requested'), reason: t?.detail };
}

function deriveCrm(run: WorkflowRun): PacketCrmState {
  const t = transitionVia(run, 'crm');
  if (run.state === 'blocked_crm') {
    return { written: false, reason: run.blockedReason ?? t?.detail };
  }
  return { written: reachedState(run, 'proof_report_requested'), reason: t?.detail };
}

/**
 * Run a lead through the Sales Closer workflow and assemble the full run packet.
 * Async only because the workflow ports are async; with mock ports it resolves
 * entirely in-memory with no IO. Asserts the no-PII / no-egress invariants
 * before returning.
 */
export async function assembleGtmRunPacket(
  opts: AssembleGtmRunPacketOptions,
): Promise<GtmRunPacket> {
  const mode: AssemblyMode = 'mock';
  const noEgress = assertNoLiveEgress(mode);

  const workflow = createSalesCloserWorkflow({
    ports: createMockCloserPorts(opts.portOverrides ?? {}),
    now: opts.now,
    newId: opts.newId,
  });
  const run = await workflow.run(opts.lead);

  const packet: GtmRunPacket = {
    mode,
    workspace: {
      workspaceId: opts.workspaceId ?? DEFAULT_WORKSPACE_ID,
      sandbox: true,
    },
    prospect: toPiiSafeProspect(run.prospect),
    status: run.status,
    finalState: run.state,
    blockedReason: run.blockedReason,
    compliance: deriveCompliance(run),
    approval: deriveApproval(run),
    appointment: deriveAppointment(run),
    crm: deriveCrm(run),
    proofs: run.proofs,
    timeline: toOperatorTimeline(run.transitions),
    noEgress,
  };

  // Belt-and-braces: the packet must never serialize a raw email.
  assertNoRawPii(packet, 'run packet');
  return packet;
}

export * from './guards.js';
export * from './timeline.js';
