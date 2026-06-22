/**
 * View-model for the GTM assembly island operator console.
 *
 * Pure transforms over a GTM "run packet" (produced by the agents-side
 * `assembleGtmRunPacket`). Presentation only — no React, no IO. The eventual
 * Next.js components stay thin and the rendering logic is unit-tested here.
 *
 * The packet is described structurally here (the same view-model pattern as
 * `apiClient.ts` / `approvalQueue.ts`) so this file depends only on its own
 * shapes and `@cognitia/core` — not on a cross-package export. A real packet
 * from `@cognitia/agents` is assignable to {@link GtmRunPacketView}.
 *
 * MOCK/SANDBOX: the underlying packet is always mock-mode with a no-egress
 * attestation; this view-model surfaces that to the operator.
 */

/** Structural view of the agents-side run packet (PII-safe by construction). */
export interface GtmRunPacketView {
  mode: 'mock';
  workspace: { workspaceId: string; sandbox: boolean };
  prospect: {
    id: string;
    companyName: string;
    sourceRisk: string;
    consentStatus: string;
    fitScore: number;
  };
  status: 'completed' | 'blocked' | 'awaiting_approval';
  finalState: string;
  blockedReason?: string;
  compliance: { passed: boolean; blocked: boolean; reason?: string };
  approval: { status: 'approved' | 'rejected' | 'pending'; reason?: string };
  appointment: { requested: boolean; reason?: string };
  crm: { written: boolean; reason?: string };
  proofs: ReadonlyArray<{ kind: string; summaryPublic: string | null }>;
  timeline: ReadonlyArray<{
    step: number;
    phase: string;
    outcome: 'advanced' | 'halted' | 'blocked';
    detail?: string;
  }>;
  noEgress: { liveSendOccurred: boolean; statement: string };
}

/** Badge tone for the status pill. */
export type StatusTone = 'success' | 'warning' | 'danger';

export interface StatusBadge {
  label: string;
  tone: StatusTone;
}

export interface TimelineRowView {
  step: number;
  phase: string;
  outcome: 'advanced' | 'halted' | 'blocked';
  detail: string | null;
}

/** Presentation-ready shape for the operator console. */
export interface GtmAssemblyConsoleView {
  workspaceId: string;
  sandbox: boolean;
  company: string;
  badge: StatusBadge;
  /** Why the run halted/was blocked, if it did. */
  blockedReason: string | null;
  complianceLabel: string;
  approvalLabel: string;
  proofCount: number;
  timeline: TimelineRowView[];
  /** True only when no live egress occurred (always true for the mock island). */
  mockSafe: boolean;
  egressStatement: string;
}

function statusBadge(packet: GtmRunPacketView): StatusBadge {
  switch (packet.status) {
    case 'completed':
      return { label: 'Completed', tone: 'success' };
    case 'awaiting_approval':
      return { label: 'Awaiting approval', tone: 'warning' };
    case 'blocked':
    default:
      return { label: 'Blocked', tone: 'danger' };
  }
}

function complianceLabel(packet: GtmRunPacketView): string {
  if (packet.compliance.blocked) {
    return `Blocked — ${packet.compliance.reason ?? 'compliance'}`;
  }
  return packet.compliance.passed ? 'Cleared' : 'Not evaluated';
}

function approvalLabel(packet: GtmRunPacketView): string {
  switch (packet.approval.status) {
    case 'approved':
      return 'Approved by human';
    case 'rejected':
      return `Rejected — ${packet.approval.reason ?? 'no reason given'}`;
    case 'pending':
    default:
      return 'Pending human review';
  }
}

/** Build the operator console view-model from a run packet. Pure. */
export function toGtmAssemblyConsoleView(packet: GtmRunPacketView): GtmAssemblyConsoleView {
  return {
    workspaceId: packet.workspace.workspaceId,
    sandbox: packet.workspace.sandbox,
    company: packet.prospect.companyName,
    badge: statusBadge(packet),
    blockedReason: packet.blockedReason ?? null,
    complianceLabel: complianceLabel(packet),
    approvalLabel: approvalLabel(packet),
    proofCount: packet.proofs.length,
    timeline: packet.timeline.map((row) => ({
      step: row.step,
      phase: row.phase,
      outcome: row.outcome,
      detail: row.detail ?? null,
    })),
    mockSafe: packet.mode === 'mock' && packet.noEgress.liveSendOccurred === false,
    egressStatement: packet.noEgress.statement,
  };
}
