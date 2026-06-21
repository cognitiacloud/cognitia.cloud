import type { ApprovalStatus, GtmProspect, IsoTimestamp, Uuid } from '@cognitia/core';
import type { Channel, ComplianceDecision, ComplianceLog, EvidenceField } from './complianceTypes';
import {
  type ComplianceProofEvent,
  GATED_CHANNELS,
  blockIfUnsubscribedOrDnc,
  checkChannelCompliance,
  createComplianceLogEntry,
  createComplianceProofEvent,
  getDefaultChannelPolicy,
  hasRequiredEvidence,
} from './compliance.js';

/**
 * Client Zero compliance gate — the code-enforced adapter between the mock
 * "Client Zero / Auto Growth OS" workflow and the merged compliance engine
 * (`./compliance.ts`, #96/#97).
 *
 * The Client Zero package (PR #106) ships strong human-approval / finance &
 * trade-in HARD-STOP doctrine, but only as prose. This adapter turns that
 * doctrine into a deterministic, side-effect-free decision: given a workflow
 * action (draft / send / booking on some surface + channel for a PII-safe
 * prospect), it returns a stable `ClientZeroGateDecision` with reason codes and
 * an audit/proof-friendly shape.
 *
 * Cardinal rules (mirrors `compliance.ts`): nothing is ever sent autonomously;
 * suppression (do-not-contact / unsubscribe) is supreme; gated channels stay
 * off; regulated surfaces (finance / trade-in) always route to a human; and
 * every draft / send / booking requires a human approval gate. No network, no
 * persistence, no sending. No raw PII ever leaves this layer — decisions carry a
 * prospect id and reason codes only, never raw contact email / phone.
 */

// ---------------------------------------------------------------------------
// Mock-workflow stub interface (the seam a Client Zero runner provides).
// ---------------------------------------------------------------------------

/**
 * Client Zero workflow surfaces. `finance` and `trade_in` are the highest-
 * regulatory surfaces (collect-and-handoff only); `pricing` is approval-gated
 * (quotes are never firm without human sign-off).
 */
export type ClientZeroSurface =
  | 'discovery'
  | 'proposal'
  | 'pricing'
  | 'finance'
  | 'trade_in'
  | 'inventory'
  | 'general_outreach';

/** A side-effecting workflow action that must pass the gate before it runs. */
export type ClientZeroActionKind = 'draft' | 'send' | 'booking';

/**
 * Human approval gate model. Approval is ALWAYS required before a draft / send /
 * booking. Only a `human`-typed, `approved` record clears the generic approval
 * gate; an agent can never self-approve, and an approval never clears a `blocked`
 * or `handoff_required` outcome.
 */
export interface HumanApprovalState {
  required: boolean;
  status: ApprovalStatus; // 'proposed' | 'approved' | 'rejected'
  approverType?: 'human' | 'agent';
  approverId?: string;
  approvedAt?: IsoTimestamp;
}

/**
 * One Client Zero workflow action to evaluate. The prospect is the shared
 * PII-safe `GtmProspect` (hashes / masks / domain only — never raw contact PII).
 */
export interface ClientZeroWorkflowAction {
  surface: ClientZeroSurface;
  actionKind: ClientZeroActionKind;
  channel: Channel;
  prospect: GtmProspect;
  evidence?: EvidenceField[];
  approval?: HumanApprovalState;
}

// ---------------------------------------------------------------------------
// Reason codes + decision shape.
// ---------------------------------------------------------------------------

/** Stable reason codes for a gated / blocked / handed-off action. */
export type ClientZeroReasonCode =
  | 'CZ_DO_NOT_CONTACT'
  | 'CZ_UNSUBSCRIBED'
  | 'CZ_CONSENT_MISSING'
  | 'CZ_CHANNEL_GATED_OFF'
  | 'CZ_SOURCE_BLOCKED'
  | 'CZ_SOURCE_HIGH_RISK'
  | 'CZ_EVIDENCE_INCOMPLETE'
  | 'CZ_FINANCE_HANDOFF_REQUIRED'
  | 'CZ_TRADE_IN_HANDOFF_REQUIRED'
  | 'CZ_PRICING_APPROVAL_REQUIRED'
  | 'CZ_HUMAN_APPROVAL_REQUIRED'
  | 'CZ_APPROVAL_NOT_GRANTED';

/** Gate outcomes, ordered from most to least restrictive. */
export type ClientZeroGateOutcome =
  | 'blocked'
  | 'handoff_required'
  | 'approval_required'
  | 'proceed';

/** Audit/proof-friendly decision. Carries prospect id + reason codes — no raw PII. */
export interface ClientZeroGateDecision {
  outcome: ClientZeroGateOutcome;
  surface: ClientZeroSurface;
  actionKind: ClientZeroActionKind;
  channel: Channel;
  reasonCodes: ClientZeroReasonCode[];
  reasons: string[];
  requiresHumanApproval: boolean;
  prospectId?: Uuid;
  policyVersion: string;
  decidedAt: IsoTimestamp;
}

/** Current Client Zero gate policy version (stamped into decisions + audit logs). */
export const CLIENT_ZERO_GATE_POLICY_VERSION = 'client-zero-gate-v1';

/** Human-readable text for each reason code (no PII — codes are surface/state only). */
const REASON_TEXT: Record<ClientZeroReasonCode, string> = {
  CZ_DO_NOT_CONTACT: 'Prospect is on the do-not-contact list — hard block.',
  CZ_UNSUBSCRIBED: 'Contact has unsubscribed — hard block.',
  CZ_CONSENT_MISSING: 'No established consent / contact basis for outreach.',
  CZ_CHANNEL_GATED_OFF: 'Channel is gated off by default until explicitly approved.',
  CZ_SOURCE_BLOCKED: 'Data source is blocked for prospecting.',
  CZ_SOURCE_HIGH_RISK: 'High-risk data source — human review required.',
  CZ_EVIDENCE_INCOMPLETE: 'Required provenance evidence is incomplete.',
  CZ_FINANCE_HANDOFF_REQUIRED:
    'Finance is a regulated surface — collect-and-handoff to a human only.',
  CZ_TRADE_IN_HANDOFF_REQUIRED:
    'Trade-in is a regulated surface — collect-and-handoff to a human only.',
  CZ_PRICING_APPROVAL_REQUIRED:
    'Pricing is never a firm quote without human approval — approval required.',
  CZ_HUMAN_APPROVAL_REQUIRED: 'Human approval is required before this action may run.',
  CZ_APPROVAL_NOT_GRANTED: 'Human approval was requested but not granted (proposed/rejected).',
};

const SEVERITY: Record<ClientZeroGateOutcome, number> = {
  proceed: 0,
  approval_required: 1,
  handoff_required: 2,
  blocked: 3,
};

/**
 * Severity of a reason code. `CZ_CONSENT_MISSING` is context-dependent: missing
 * consent hard-blocks an actual `send` / `booking`, but only requires approval
 * for a `draft` (you may prepare a draft for a human, never dispatch it).
 */
function severityOf(
  code: ClientZeroReasonCode,
  actionKind: ClientZeroActionKind,
): ClientZeroGateOutcome {
  switch (code) {
    case 'CZ_DO_NOT_CONTACT':
    case 'CZ_UNSUBSCRIBED':
    case 'CZ_CHANNEL_GATED_OFF':
    case 'CZ_SOURCE_BLOCKED':
    case 'CZ_APPROVAL_NOT_GRANTED':
      return 'blocked';
    case 'CZ_CONSENT_MISSING':
      return actionKind === 'draft' ? 'approval_required' : 'blocked';
    case 'CZ_FINANCE_HANDOFF_REQUIRED':
    case 'CZ_TRADE_IN_HANDOFF_REQUIRED':
      return 'handoff_required';
    case 'CZ_SOURCE_HIGH_RISK':
    case 'CZ_EVIDENCE_INCOMPLETE':
    case 'CZ_PRICING_APPROVAL_REQUIRED':
    case 'CZ_HUMAN_APPROVAL_REQUIRED':
      return 'approval_required';
  }
}

/** Whether an approval record clears the GENERIC human-approval gate. */
export function isHumanApprovalGranted(approval?: HumanApprovalState): boolean {
  return approval?.status === 'approved' && approval.approverType === 'human';
}

/**
 * Evaluate a Client Zero workflow action against the compliance engine and the
 * Client-Zero-specific surface rules. Accumulates reason codes, then derives the
 * outcome from the worst (most restrictive) code. Pure and deterministic.
 */
export function evaluateClientZeroGate(
  action: ClientZeroWorkflowAction,
  opts: { policyVersion?: string; now?: IsoTimestamp } = {},
): ClientZeroGateDecision {
  const { surface, actionKind, channel, prospect } = action;
  const evidence = action.evidence ?? [];
  const policy = getDefaultChannelPolicy();
  const codes = new Set<ClientZeroReasonCode>();

  // 1. Hard suppression (supreme). Use the engine helper so behaviour can never
  //    drift from core `canContactProspect`.
  const suppressed = blockIfUnsubscribedOrDnc(prospect);
  if (suppressed) {
    if (prospect.doNotContact || prospect.consentStatus === 'do_not_contact') {
      codes.add('CZ_DO_NOT_CONTACT');
    }
    if (
      prospect.unsubscribeStatus === 'unsubscribed' ||
      prospect.consentStatus === 'unsubscribed'
    ) {
      codes.add('CZ_UNSUBSCRIBED');
    }
  }

  // 2. Channel gating + source risk.
  if (GATED_CHANNELS.includes(channel)) codes.add('CZ_CHANNEL_GATED_OFF');
  if (prospect.sourceRisk === 'blocked') codes.add('CZ_SOURCE_BLOCKED');
  if (prospect.sourceRisk === 'high') codes.add('CZ_SOURCE_HIGH_RISK');

  // 3. Consent + evidence.
  if (prospect.consentStatus === 'not_established') codes.add('CZ_CONSENT_MISSING');
  if (!hasRequiredEvidence(evidence)) codes.add('CZ_EVIDENCE_INCOMPLETE');

  // 4. Regulated surfaces (Client Zero doctrine: finance / trade-in HARD-STOP).
  if (surface === 'finance') codes.add('CZ_FINANCE_HANDOFF_REQUIRED');
  if (surface === 'trade_in') codes.add('CZ_TRADE_IN_HANDOFF_REQUIRED');
  if (surface === 'pricing') codes.add('CZ_PRICING_APPROVAL_REQUIRED');

  // 5. Human approval is ALWAYS required for a draft / send / booking. A granted
  //    human approval clears only this generic gate — never a blocked or
  //    handoff_required outcome.
  if (!isHumanApprovalGranted(action.approval)) {
    codes.add(
      action.approval?.status === 'rejected'
        ? 'CZ_APPROVAL_NOT_GRANTED'
        : 'CZ_HUMAN_APPROVAL_REQUIRED',
    );
  }

  const reasonCodes = [...codes];
  const outcome = reasonCodes.reduce<ClientZeroGateOutcome>((worst, code) => {
    const sev = severityOf(code, actionKind);
    return SEVERITY[sev] > SEVERITY[worst] ? sev : worst;
  }, 'proceed');

  const reasons =
    reasonCodes.length > 0
      ? reasonCodes.map((c) => REASON_TEXT[c])
      : ['Human approval granted; Client Zero workflow may proceed.'];

  return {
    outcome,
    surface,
    actionKind,
    channel,
    reasonCodes,
    reasons,
    requiresHumanApproval: outcome !== 'proceed',
    prospectId: prospect.id,
    policyVersion: opts.policyVersion ?? CLIENT_ZERO_GATE_POLICY_VERSION,
    decidedAt: opts.now ?? '1970-01-01T00:00:00.000Z',
  };
}

/** Map a gate outcome onto the engine's `ComplianceDecision` vocabulary. */
export function gateOutcomeToComplianceDecision(
  outcome: ClientZeroGateOutcome,
): ComplianceDecision {
  if (outcome === 'blocked') return 'blocked';
  if (outcome === 'proceed') return 'allowed';
  return 'human_review_required';
}

/**
 * Build an append-only compliance log entry from a gate decision (reuses the
 * engine builder). PII-safe: carries prospect id + reason codes only.
 */
export function clientZeroDecisionToLog(
  decision: ClientZeroGateDecision,
  action: ClientZeroWorkflowAction,
  actorId = 'system:client-zero-gate',
): ComplianceLog {
  return createComplianceLogEntry({
    prospect: action.prospect,
    actorType: 'system',
    actorId,
    actionType: `client_zero.${action.surface}.${action.actionKind}`,
    channel: decision.channel,
    decision: gateOutcomeToComplianceDecision(decision.outcome),
    reason: `[${decision.reasonCodes.join(', ') || 'NONE'}] ${decision.reasons.join(' ')}`,
    evidenceFields: action.evidence ?? [],
    createdAt: decision.decidedAt,
  });
}

/** Build a proof-ledger event from a gate decision (reuses the engine builder). */
export function clientZeroDecisionToProof(decision: ClientZeroGateDecision): ComplianceProofEvent {
  const type: ComplianceProofEvent['type'] =
    decision.outcome === 'blocked'
      ? 'do_not_contact_recorded'
      : decision.outcome === 'proceed'
        ? 'compliance_decision_logged'
        : 'human_review_required';
  return createComplianceProofEvent({
    type,
    prospectId: decision.prospectId,
    channel: decision.channel,
    decision: gateOutcomeToComplianceDecision(decision.outcome),
    summary: `Client Zero ${decision.surface}/${decision.actionKind}: ${decision.outcome} — ${decision.reasonCodes.join(', ') || 'no blocking reasons'}.`,
    createdAt: decision.decidedAt,
  });
}

/** Convenience: the full channel-aware engine result for a Client Zero action. */
export function explainClientZeroChannel(action: ClientZeroWorkflowAction): string[] {
  return checkChannelCompliance(action.prospect, action.channel, action.evidence ?? []).reasons;
}
