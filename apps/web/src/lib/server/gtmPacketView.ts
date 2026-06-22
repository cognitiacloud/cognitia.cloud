/**
 * SERVER-ONLY shape adapter: a real `@cognitia/agents` {@link GtmRunPacket}
 * (B1 assembly output) → the web-local {@link GtmRunPacketView} consumed by
 * `gtmOsAssemblyViewModel`'s `toGtmAssemblyConsoleView`.
 *
 * This is a pure field mapping, NOT a reimplementation of lane logic: it only
 * narrows packet fields onto the view shape the console renderer expects. Both
 * the integrated-demo adapter and the command-center adapter use it, so there
 * is exactly one packet→view mapping.
 *
 * Server-only because it imports `@cognitia/agents` types/values; never import
 * it from a client component.
 */

import type { GtmRunPacket } from '@cognitia/agents';
import type { GtmRunPacketView } from '../gtmOsAssemblyViewModel.js';

/** Map a real assembly packet into the web console view shape. */
export function toPacketView(packet: GtmRunPacket): GtmRunPacketView {
  const status: GtmRunPacketView['status'] =
    packet.status === 'completed' || packet.status === 'awaiting_approval'
      ? packet.status
      : 'blocked';
  return {
    mode: 'mock',
    workspace: { workspaceId: packet.workspace.workspaceId, sandbox: packet.workspace.sandbox },
    prospect: {
      id: packet.prospect.id,
      companyName: packet.prospect.companyName,
      sourceRisk: packet.prospect.sourceRisk,
      consentStatus: packet.prospect.consentStatus,
      fitScore: packet.prospect.fitScore,
    },
    status,
    finalState: packet.finalState,
    blockedReason: packet.blockedReason,
    compliance: packet.compliance,
    approval: packet.approval,
    appointment: packet.appointment,
    crm: packet.crm,
    proofs: packet.proofs.map((p) => ({ kind: p.kind, summaryPublic: p.summaryPublic })),
    timeline: packet.timeline.map((t) => ({
      step: t.step,
      phase: t.phase,
      outcome: t.outcome,
      detail: t.detail,
    })),
    noEgress: { liveSendOccurred: false, statement: packet.noEgress.statement },
  };
}
