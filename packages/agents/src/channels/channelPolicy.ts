/**
 * Channel policy gate for the DRY-RUN-ONLY channel orchestration layer.
 *
 * This module decides whether a channel action is *permitted to be planned*.
 * It NEVER sends anything. The whole layer is fail-closed: even a fully
 * "allowed" policy result only authorizes a dry-run plan, never a live send.
 *
 * The live path is gated behind a `ReleaseGate` that is intentionally
 * impossible to satisfy inside this layer (see `IMPOSSIBLE_RELEASE_GATE` and
 * `isReleaseGateOpen`). There is no code path in this layer that can construct
 * an open gate — any future live send must be implemented in a different,
 * legally-reviewed lane that supplies its own (non-impossible) gate.
 *
 * SANDBOX/MOCK only. No network, no vendor SDKs, no real PII.
 */

/** The channels modelled by this layer. */
export type ChannelKind =
  | 'email'
  | 'sms'
  | 'whatsapp'
  | 'call'
  | 'linkedin'
  | 'ad'
  | 'crm_writeback';

export const CHANNEL_KINDS: readonly ChannelKind[] = [
  'email',
  'sms',
  'whatsapp',
  'call',
  'linkedin',
  'ad',
  'crm_writeback',
] as const;

/**
 * The release gate that any *live* send would have to pass.
 *
 * Every field must be true for the gate to be open. The `impossibleToken`
 * field can only be satisfied by a value that this layer never produces and
 * cannot produce (see `isReleaseGateOpen`), so the gate is closed by
 * construction. This encodes "live is blocked until legal/consent sign-off in
 * a separate lane" as a type-level + runtime invariant.
 */
export interface ReleaseGate {
  /** Legal review of the channel/template completed and recorded externally. */
  legalReviewComplete: boolean;
  /** Explicit, per-contact consent captured and verifiable externally. */
  consentVerified: boolean;
  /** A signed release approval from a separate, out-of-layer authority. */
  signedReleaseApproval: boolean;
  /**
   * A token that, in this layer, can never equal the required sentinel. There
   * is no exported constructor for the required value; this layer only ever
   * emits {@link IMPOSSIBLE_RELEASE_GATE} whose token is the wrong value.
   */
  impossibleToken: string;
}

/**
 * A sentinel token value that {@link isReleaseGateOpen} requires. It is NOT
 * exported and is never assigned to any gate this layer constructs, so no gate
 * produced here can ever satisfy it. A future live lane would have to supply
 * this exact string deliberately and from outside this layer.
 */
const REQUIRED_RELEASE_TOKEN = 'release-token-not-available-in-dry-run-layer';

/**
 * The only release gate this layer ever produces. It is impossible to satisfy:
 * every field is false and the token can never match {@link REQUIRED_RELEASE_TOKEN}.
 */
export const IMPOSSIBLE_RELEASE_GATE: ReleaseGate = Object.freeze({
  legalReviewComplete: false,
  consentVerified: false,
  signedReleaseApproval: false,
  impossibleToken: 'BLOCKED:dry-run-layer-cannot-open-release-gate',
});

/**
 * Returns true only if a release gate is fully open. By design, no gate
 * constructed inside this layer can make this return true.
 */
export function isReleaseGateOpen(gate: ReleaseGate): boolean {
  return (
    gate.legalReviewComplete === true &&
    gate.consentVerified === true &&
    gate.signedReleaseApproval === true &&
    gate.impossibleToken === REQUIRED_RELEASE_TOKEN
  );
}

/**
 * Inputs to the policy gate. Carries no raw PII — identifiers only.
 * `live` is the caller's request to go live; the gate always denies it.
 */
export interface ChannelPolicyInput {
  channel: ChannelKind;
  /** Per-contact consent captured (must be true to allow planning). */
  consent: boolean;
  /** Human approval state for this action. */
  approval: 'approved' | 'rejected' | 'pending';
  /** Workspace / tenant scope; required and non-empty. */
  workspaceId: string;
  /**
   * Caller's live-send request flag. MUST be off (false/undefined) for an
   * allow. If true, the gate denies regardless of everything else.
   */
  live?: boolean;
}

export interface ChannelPolicyDecision {
  /** Allowed to *plan a dry-run action* (never to send). */
  allow: boolean;
  /** Ordered reasons; populated on deny, empty on allow. */
  reasons: string[];
}

/**
 * Evaluate whether a dry-run channel action may be planned.
 *
 * Requires ALL of:
 *  - consent === true
 *  - approval === 'approved'
 *  - a present, non-empty workspaceId
 *  - the live flag OFF (live is never permitted in this layer)
 *
 * Returns allow/deny with reasons. An allow authorizes ONLY a dry-run plan.
 */
export function evaluateChannelPolicy(input: ChannelPolicyInput): ChannelPolicyDecision {
  const reasons: string[] = [];

  if (input.consent !== true) {
    reasons.push('consent_required: consent must be explicitly true');
  }
  if (input.approval !== 'approved') {
    reasons.push(`human_approval_required: approval is "${input.approval}", expected "approved"`);
  }
  if (typeof input.workspaceId !== 'string' || input.workspaceId.trim() === '') {
    reasons.push('workspace_required: a non-empty workspaceId is required');
  }
  if (input.live === true) {
    reasons.push('live_disabled: live sends are disabled in the dry-run layer (fail closed)');
  }

  return { allow: reasons.length === 0, reasons };
}
