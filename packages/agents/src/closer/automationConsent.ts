/**
 * Consent & compliance READINESS controls for the Sales Closer automation lane.
 *
 * STATUS: MOCK / SANDBOX. This is a pure, deterministic readiness gate. It
 * decides whether a planned automated outreach action is *cleared, from a
 * consent/compliance-readiness standpoint, to proceed to dry-run planning*. It
 * does NOT send anything, does NOT touch the network, vendor SDKs, secrets, or
 * raw PII, and makes NO production-readiness claim.
 *
 * These are internal readiness controls, NOT legal advice. They model the
 * checks an operator/compliance reviewer would expect before any progression
 * toward live outreach (e.g. CASL commercial-electronic-message rules and
 * Quebec/Law 25 considerations). Whether outreach is actually lawful is a
 * determination for qualified counsel, made out-of-band. Nothing here makes a
 * blocked action permitted or asserts that a cleared action is lawful.
 *
 * Fail-closed: unknown, ambiguous, missing, or expired consent BLOCKS. The
 * default (empty) input blocks. Clearing requires explicit, current consent and
 * the absence of any blocking signal.
 */

/** The outreach channels these readiness controls cover. */
export type ConsentChannel =
  | 'email'
  | 'sms'
  | 'whatsapp'
  | 'call'
  | 'linkedin'
  | 'ad'
  | 'crm_writeback';

/**
 * The recorded consent state for a contact, as captured out-of-band. Only
 * `explicit` can ever clear on its own; everything else either blocks or, for
 * `implied`, escalates to review.
 */
export type ConsentStatus = 'explicit' | 'implied' | 'ambiguous' | 'none' | 'expired' | 'revoked';

export const CONSENT_STATUSES: readonly ConsentStatus[] = [
  'explicit',
  'implied',
  'ambiguous',
  'none',
  'expired',
  'revoked',
] as const;

/** The three readiness outcomes, from most to least permissive. */
export type ConsentReadinessOutcome = 'cleared' | 'requires_review' | 'blocked';

/**
 * Inputs to the readiness gate. Carries NO raw PII — state and identifiers
 * only. `evaluatedAt` is injectable so the gate stays pure and deterministic.
 */
export interface AutomationConsentInput {
  channel: ConsentChannel;
  /** Recorded consent state for this contact (captured out-of-band). */
  consentStatus: ConsentStatus;
  /** Workspace / tenant scope; required and non-empty. */
  workspaceId: string;
  /** Contact is on a do-not-contact / suppression list. Blocks when true. */
  doNotContact?: boolean;
  /**
   * ISO-8601 timestamp at which the recorded consent expires. If present and at
   * or before `evaluatedAt` (or unparseable), the action BLOCKS as expired.
   */
  consentExpiresAt?: string | null;
  /**
   * The action is a CASL "commercial electronic message" (or otherwise
   * CASL-sensitive). When true, only `explicit` consent can clear it.
   */
  caslSensitive?: boolean;
  /**
   * The contact/action is flagged as subject to Quebec / Law 25. Does not block
   * on its own, but always escalates to extra compliance review.
   */
  law25Flag?: boolean;
  /** Evaluation time (ISO-8601). Defaults to now. Injected for determinism. */
  evaluatedAt?: string;
}

/** A single readiness signal: blocking or review-only, with a stable code. */
export interface ConsentReadinessSignal {
  code: ConsentReadinessCode;
  severity: 'block' | 'review';
  message: string;
}

export type ConsentReadinessCode =
  | 'no_consent'
  | 'ambiguous_consent'
  | 'revoked_consent'
  | 'expired_consent'
  | 'do_not_contact'
  | 'casl_explicit_consent_required'
  | 'workspace_required'
  | 'law25_extra_review_required'
  | 'implied_consent_review_required';

export interface ConsentReadinessResult {
  outcome: ConsentReadinessOutcome;
  /** True only when outcome === 'cleared'. Convenience for callers. */
  cleared: boolean;
  /** All applicable signals, blocking first, in deterministic order. */
  signals: ConsentReadinessSignal[];
  /** Codes of the blocking signals only (empty unless blocked). */
  blockingCodes: ConsentReadinessCode[];
  /** Codes of the review-only signals only. */
  reviewCodes: ConsentReadinessCode[];
  reason: string;
}

function isConsentStatus(value: unknown): value is ConsentStatus {
  return typeof value === 'string' && (CONSENT_STATUSES as readonly string[]).includes(value);
}

/**
 * Returns true if `consentExpiresAt` is absent. Otherwise returns true only if
 * the timestamp is valid AND strictly after `evaluatedAt`. An unparseable or
 * non-future timestamp is treated as expired (fail-closed).
 */
function consentIsCurrent(consentExpiresAt: string | null | undefined, evaluatedAt: Date): boolean {
  if (consentExpiresAt === undefined || consentExpiresAt === null || consentExpiresAt === '') {
    return true;
  }
  const expiry = new Date(consentExpiresAt);
  if (Number.isNaN(expiry.getTime())) {
    // Unparseable expiry => cannot prove consent is current => fail closed.
    return false;
  }
  return expiry.getTime() > evaluatedAt.getTime();
}

/**
 * Evaluate consent/compliance readiness for a single planned automation action.
 *
 * Blocks (any one is sufficient) when:
 *  - consent is `none`, `ambiguous`, `revoked`, or `expired`
 *  - the contact is on a do-not-contact list
 *  - the recorded `consentExpiresAt` is at/past `evaluatedAt` (or unparseable)
 *  - the action is CASL-sensitive and consent is not `explicit`
 *  - `workspaceId` is missing/blank
 *
 * Escalates to `requires_review` (when not otherwise blocked) when:
 *  - the action is flagged Quebec / Law 25
 *  - consent is `implied` (limits apply; needs a human compliance check)
 *
 * Clears only when consent is `explicit`, current, with no blocking or review
 * signal present. Fail-closed by default.
 */
export function evaluateAutomationConsent(input: AutomationConsentInput): ConsentReadinessResult {
  const signals: ConsentReadinessSignal[] = [];
  const evaluatedAt = input.evaluatedAt ? new Date(input.evaluatedAt) : new Date();
  const evalTime = Number.isNaN(evaluatedAt.getTime()) ? new Date() : evaluatedAt;

  const status: ConsentStatus = isConsentStatus(input.consentStatus)
    ? input.consentStatus
    : 'ambiguous'; // Unknown/garbled status is treated as ambiguous => blocks.

  // --- Blocking signals -----------------------------------------------------
  if (typeof input.workspaceId !== 'string' || input.workspaceId.trim() === '') {
    signals.push({
      code: 'workspace_required',
      severity: 'block',
      message: 'workspace_required: a non-empty workspaceId is required',
    });
  }

  if (input.doNotContact === true) {
    signals.push({
      code: 'do_not_contact',
      severity: 'block',
      message: 'do_not_contact: contact is suppressed and must not be contacted',
    });
  }

  switch (status) {
    case 'none':
      signals.push({
        code: 'no_consent',
        severity: 'block',
        message: 'no_consent: no consent on record for this contact',
      });
      break;
    case 'ambiguous':
      signals.push({
        code: 'ambiguous_consent',
        severity: 'block',
        message: 'ambiguous_consent: consent state is unclear and cannot be relied on',
      });
      break;
    case 'revoked':
      signals.push({
        code: 'revoked_consent',
        severity: 'block',
        message: 'revoked_consent: consent was withdrawn for this contact',
      });
      break;
    case 'expired':
      signals.push({
        code: 'expired_consent',
        severity: 'block',
        message: 'expired_consent: recorded consent is marked expired',
      });
      break;
    default:
      break;
  }

  // Date-driven expiry is independent of the status label: even `explicit`
  // consent blocks once its recorded expiry has passed.
  if (status !== 'expired' && !consentIsCurrent(input.consentExpiresAt, evalTime)) {
    signals.push({
      code: 'expired_consent',
      severity: 'block',
      message: 'expired_consent: recorded consent has lapsed as of evaluation time',
    });
  }

  // CASL-sensitive actions require EXPLICIT consent — implied is not enough.
  if (input.caslSensitive === true && status !== 'explicit') {
    signals.push({
      code: 'casl_explicit_consent_required',
      severity: 'block',
      message:
        'casl_explicit_consent_required: CASL-sensitive action needs explicit consent on record',
    });
  }

  // --- Review-only signals --------------------------------------------------
  if (input.law25Flag === true) {
    signals.push({
      code: 'law25_extra_review_required',
      severity: 'review',
      message:
        'law25_extra_review_required: Quebec / Law 25 flag set — extra compliance review required',
    });
  }

  if (status === 'implied') {
    signals.push({
      code: 'implied_consent_review_required',
      severity: 'review',
      message:
        'implied_consent_review_required: implied consent has limits — human compliance review required',
    });
  }

  // --- Outcome (blocking first, then review, else cleared) ------------------
  const blockingCodes = signals.filter((s) => s.severity === 'block').map((s) => s.code);
  const reviewCodes = signals.filter((s) => s.severity === 'review').map((s) => s.code);

  let outcome: ConsentReadinessOutcome;
  let reason: string;
  if (blockingCodes.length > 0) {
    outcome = 'blocked';
    reason = `consent readiness blocked: ${blockingCodes.join(', ')}`;
  } else if (reviewCodes.length > 0) {
    outcome = 'requires_review';
    reason = `consent readiness requires extra review: ${reviewCodes.join(', ')}`;
  } else {
    outcome = 'cleared';
    reason = 'consent readiness cleared: explicit, current consent with no blocking signals';
  }

  return {
    outcome,
    cleared: outcome === 'cleared',
    signals,
    blockingCodes,
    reviewCodes,
    reason,
  };
}

/**
 * Convenience predicate: true only when the action is fully cleared. A
 * `requires_review` outcome is intentionally NOT cleared — it must not proceed
 * without the out-of-band review landing first.
 */
export function isAutomationConsentCleared(input: AutomationConsentInput): boolean {
  return evaluateAutomationConsent(input).outcome === 'cleared';
}
