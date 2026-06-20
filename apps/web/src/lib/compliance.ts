import type { GtmProspect } from '@cognitia/core';
import type {
  Channel,
  ChannelEligibility,
  ChannelStatus,
  ComplianceCheckResult,
  ComplianceDecision,
  ComplianceLog,
  CompliancePolicy,
  EvidenceField,
} from './complianceTypes';

/**
 * Compliance / channel policy engine for human-approved B2B outreach.
 *
 * Pure, deterministic, side-effect-free helpers — no network, no persistence,
 * no sending. They consume the shared PII-safe `GtmProspect` from `@cognitia/core`
 * (#97) and add the per-CHANNEL gating that core's GTM helpers do not cover. The
 * per-channel view models (`Channel`, `CompliancePolicy`, `EvidenceField`, …)
 * are web-local (`./complianceTypes`) — demo presentation types, deliberately not
 * a parallel surface in shared core. The canonical closer data layer is #93.
 *
 * Naming: core already exports `canContactProspect` / `requiresHumanReviewForOutreach`
 * (prospect-level, channel-agnostic). To avoid collision and confusion, the
 * channel-aware helpers here are named `checkChannelCompliance` /
 * `requiresHumanReviewForChannel`. They are kept self-contained (type-only core
 * import) so the web bundle never pulls core's runtime (zod / node:crypto) — no
 * new dependency or lockfile change.
 *
 * Cardinal rule: nothing is ever sent autonomously; every outreach channel
 * resolves to `human_review_required` at best, or `blocked`.
 */

/** Evidence fields that must be present before a prospect can be contacted. */
export const REQUIRED_EVIDENCE_FIELDS = ['sourceUrl', 'capturedAt', 'fieldName'] as const;

/** Channels that are gated off by default until explicitly approved. */
export const GATED_CHANNELS: readonly Channel[] = ['sms', 'whatsapp', 'ai_voice'];

/**
 * Default channel policy. Email + phone are enabled but always behind human
 * review; SMS / WhatsApp / AI voice are gated off; LinkedIn is manual /
 * human-review only (no automation); manual_task is enabled (it IS the human).
 */
export function getDefaultChannelPolicy(): CompliancePolicy {
  return {
    channels: {
      email: 'enabled',
      phone: 'enabled',
      sms: 'gated_off',
      whatsapp: 'gated_off',
      ai_voice: 'gated_off',
      linkedin: 'human_review_required',
      manual_task: 'enabled',
    },
    requireUnsubscribeForEmail: true,
    requireDncChecksForPhone: true,
    requiredEvidenceFields: [...REQUIRED_EVIDENCE_FIELDS],
    aiDraftsRequireHumanApproval: true,
  };
}

/**
 * Hard suppression check. Returns a `blocked` decision (with reasons) if the
 * prospect is do-not-contact, unsubscribed, or has a suppressed consent state;
 * otherwise `null`. Mirrors core `canContactProspect` (boolean) but yields
 * reasons for the UI/log. Suppression overrides every other signal.
 */
export function blockIfUnsubscribedOrDnc(
  prospect: Pick<GtmProspect, 'doNotContact' | 'unsubscribeStatus' | 'consentStatus'>,
): { decision: 'blocked'; reasons: string[] } | null {
  const reasons: string[] = [];
  if (prospect.doNotContact) reasons.push('Prospect is flagged do-not-contact.');
  if (prospect.unsubscribeStatus === 'unsubscribed') reasons.push('Contact has unsubscribed.');
  if (prospect.consentStatus === 'unsubscribed') reasons.push('Consent status is unsubscribed.');
  if (prospect.consentStatus === 'do_not_contact')
    reasons.push('Consent status is do-not-contact.');
  return reasons.length > 0 ? { decision: 'blocked', reasons } : null;
}

/** Whether every required evidence field is present at least once. */
export function hasRequiredEvidence(evidence: EvidenceField[]): boolean {
  if (evidence.length === 0) return false;
  return REQUIRED_EVIDENCE_FIELDS.every((field) => {
    if (field === 'sourceUrl') return evidence.some((e) => e.sourceUrl.trim() !== '');
    if (field === 'capturedAt') return evidence.some((e) => e.capturedAt.trim() !== '');
    if (field === 'fieldName') return evidence.some((e) => e.fieldName.trim() !== '');
    return false;
  });
}

/**
 * Evaluate one channel for one prospect. Precedence (top wins):
 *   suppression → blocked
 *   gated channel (sms/whatsapp/ai_voice) → gated_off/blocked
 *   linkedin → human_review_required (manual only)
 *   source risk blocked → blocked; high → human review
 *   missing evidence → human review
 *   consent not established → human review
 *   email without unsubscribe support → human review
 *   phone without DNC representation → human review
 * Anything that survives is `human_review_required` (never auto-`allowed`).
 */
export function evaluateChannelEligibility(
  prospect: GtmProspect,
  channel: Channel,
  evidence: EvidenceField[] = [],
  policy: CompliancePolicy = getDefaultChannelPolicy(),
): ChannelEligibility {
  const reasons: string[] = [];

  const suppressed = blockIfUnsubscribedOrDnc(prospect);
  if (suppressed) {
    return {
      channel,
      status: 'blocked',
      decision: 'blocked',
      requiresHumanApproval: false,
      reasons: suppressed.reasons,
    };
  }

  const channelStatus = policy.channels[channel];

  if (GATED_CHANNELS.includes(channel)) {
    return {
      channel,
      status: 'gated_off',
      decision: 'blocked',
      requiresHumanApproval: false,
      reasons: [`${channel} is gated off by default until explicitly approved.`],
    };
  }

  if (channel === 'linkedin') {
    return {
      channel,
      status: 'human_review_required',
      decision: 'human_review_required',
      requiresHumanApproval: true,
      reasons: ['LinkedIn is manual / human-review only — no automation.'],
    };
  }

  if (prospect.sourceRisk === 'blocked') {
    return {
      channel,
      status: 'blocked',
      decision: 'blocked',
      requiresHumanApproval: false,
      reasons: ['Data source is blocked for prospecting.'],
    };
  }
  if (prospect.sourceRisk === 'high')
    reasons.push('High-risk data source — human review required.');

  if (!hasRequiredEvidence(evidence)) {
    reasons.push('Missing required evidence field(s) — human review required.');
  }

  if (prospect.consentStatus === 'not_established') {
    reasons.push('Consent/contact basis is not established — human review required.');
  }

  if (channel === 'email' && policy.requireUnsubscribeForEmail) {
    reasons.push('Email requires a working unsubscribe mechanism before sending.');
  }
  if (channel === 'phone' && policy.requireDncChecksForPhone) {
    reasons.push('Phone requires National DNCL + internal DNC checks and caller identification.');
  }

  // Email/phone are "enabled" but never auto-send: they always require a human
  // approval gate, so the effective decision is human_review_required.
  const status: ChannelStatus =
    channelStatus === 'enabled' ? 'human_review_required' : channelStatus;
  return {
    channel,
    status,
    decision: 'human_review_required',
    requiresHumanApproval: true,
    reasons:
      reasons.length > 0
        ? reasons
        : [`${channel} is enabled but requires human approval before sending.`],
  };
}

/**
 * Full channel-aware compliance check for a prospect. Returns the decision plus
 * reasons and whether human approval is required. Outreach channels never return
 * `allowed` here — the strongest non-blocked outcome is human review.
 */
export function checkChannelCompliance(
  prospect: GtmProspect,
  channel: Channel,
  evidence: EvidenceField[] = [],
  policy: CompliancePolicy = getDefaultChannelPolicy(),
): ComplianceCheckResult {
  const eligibility = evaluateChannelEligibility(prospect, channel, evidence, policy);
  return {
    decision: eligibility.decision,
    channel,
    requiresHumanApproval: eligibility.requiresHumanApproval,
    reasons: eligibility.reasons,
    evidenceComplete: hasRequiredEvidence(evidence),
  };
}

/** True if outreach on this channel requires human review before sending. */
export function requiresHumanReviewForChannel(
  prospect: GtmProspect,
  channel: Channel,
  evidence: EvidenceField[] = [],
  policy: CompliancePolicy = getDefaultChannelPolicy(),
): boolean {
  // Never auto-`allowed` for an outreach channel: human review is required
  // unless the decision is explicitly `allowed` (which does not occur here).
  return checkChannelCompliance(prospect, channel, evidence, policy).decision !== 'allowed';
}

/** Build an append-only compliance log entry. */
export function createComplianceLogEntry(input: {
  prospect?: GtmProspect;
  leadId?: string;
  actorType: ComplianceLog['actorType'];
  actorId: string;
  actionType: string;
  channel?: Channel;
  decision: ComplianceDecision;
  reason: string;
  tenantId?: string;
  evidenceFields?: EvidenceField[];
  createdAt?: string;
}): ComplianceLog {
  return {
    id: `log:${input.actionType}:${input.actorId}:${input.createdAt ?? 'now'}`,
    tenantId: input.tenantId,
    prospectId: input.prospect?.id,
    leadId: input.leadId,
    actorType: input.actorType,
    actorId: input.actorId,
    actionType: input.actionType,
    channel: input.channel,
    decision: input.decision,
    consentStatus: input.prospect?.consentStatus,
    contactBasis: input.prospect?.contactBasis,
    sourceRisk: input.prospect?.sourceRisk,
    humanApprovalRequired: input.decision !== 'allowed',
    evidenceFields: input.evidenceFields ?? [],
    reason: input.reason,
    createdAt: input.createdAt ?? '1970-01-01T00:00:00.000Z',
  };
}

/** A compliance proof event for the proof / action ledger. */
export interface ComplianceProofEvent {
  id: string;
  type:
    | 'source_reviewed'
    | 'prospect_normalized'
    | 'channel_eligibility_checked'
    | 'outreach_draft_generated'
    | 'human_review_required'
    | 'unsubscribe_recorded'
    | 'do_not_contact_recorded'
    | 'compliance_decision_logged';
  prospectId?: string;
  channel?: Channel;
  decision?: ComplianceDecision;
  summary: string;
  createdAt: string;
}

/** Build a proof event from a compliance decision (for the proof ledger). */
export function createComplianceProofEvent(input: {
  type: ComplianceProofEvent['type'];
  prospectId?: string;
  channel?: Channel;
  decision?: ComplianceDecision;
  summary: string;
  createdAt?: string;
}): ComplianceProofEvent {
  return {
    id: `proof:${input.type}:${input.prospectId ?? 'na'}:${input.createdAt ?? 'now'}`,
    type: input.type,
    prospectId: input.prospectId,
    channel: input.channel,
    decision: input.decision,
    summary: input.summary,
    createdAt: input.createdAt ?? '1970-01-01T00:00:00.000Z',
  };
}

/** Human-readable explanation of a compliance decision. */
export function explainComplianceDecision(result: ComplianceCheckResult): string {
  const head =
    result.decision === 'blocked'
      ? `Blocked on ${result.channel}`
      : result.decision === 'human_review_required'
        ? `Requires human review on ${result.channel}`
        : `Allowed on ${result.channel}`;
  const reasons = result.reasons.length > 0 ? `: ${result.reasons.join(' ')}` : '.';
  return `${head}${reasons}`;
}

/**
 * Guardrail: an agent may never approve its own risky action. Returns false
 * (cannot approve) whenever the approver is the same agent that proposed a
 * non-low-risk action. Humans are not subject to this self-approval guard.
 */
export function agentCanApproveAction(input: {
  proposerActorId: string;
  approverActorId: string;
  approverType: 'agent' | 'human';
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'blocked';
}): boolean {
  if (input.approverType === 'human') return true;
  const risky =
    input.riskLevel === 'high' || input.riskLevel === 'medium' || input.riskLevel === 'blocked';
  if (risky && input.approverActorId === input.proposerActorId) return false;
  // Even for a non-self agent, risky actions require a human gate.
  return !risky;
}

/**
 * Guardrail: a GTM agent can prepare a draft but can never send autonomously.
 * Sending always requires an approved human gate.
 */
export function agentCanSendOutreach(input: {
  requiresHumanApproval: boolean;
  approvalStatus: 'proposed' | 'approved' | 'rejected';
}): boolean {
  if (input.requiresHumanApproval && input.approvalStatus !== 'approved') return false;
  return input.approvalStatus === 'approved';
}
