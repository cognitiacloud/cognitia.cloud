/**
 * Consent / compliance gate for the Sales Closer workflow.
 *
 * Reuses the pure GTM guardrails from @cognitia/core rather than re-deriving
 * consent logic here:
 *   - `normalizeGtmProspect` turns the raw intake into a PII-safe prospect
 *     (raw email/phone are hashed/masked and DROPPED);
 *   - `canContactProspect` is the hard block (do-not-contact / unsubscribed);
 *   - `requiresHumanReviewForOutreach` flags the extra review gate.
 */

import {
  canContactProspect,
  normalizeGtmProspect,
  requiresHumanReviewForOutreach,
  type GtmProspect,
} from '@cognitia/core';
import type { CloserComplianceDecision, CloserLeadIntake } from './types.js';

/** Human-readable reason a prospect cannot be contacted. */
function blockReason(prospect: GtmProspect): string {
  if (prospect.doNotContact) return 'prospect is flagged do-not-contact';
  if (prospect.unsubscribeStatus === 'unsubscribed') return 'prospect has unsubscribed';
  if (prospect.consentStatus === 'do_not_contact') return 'consent status is do_not_contact';
  if (prospect.consentStatus === 'unsubscribed') return 'consent status is unsubscribed';
  return 'prospect may not be contacted under current consent state';
}

/**
 * Run the compliance gate on a lead intake. Normalizes the prospect (dropping
 * raw PII), then decides whether outreach may proceed to the human-approval
 * gate. Deterministic given an injected clock.
 */
export function evaluateCompliance(
  intake: CloserLeadIntake,
  opts: { now?: () => Date } = {},
): CloserComplianceDecision {
  const prospect = normalizeGtmProspect(intake.prospect, { now: opts.now?.() });

  if (!canContactProspect(prospect)) {
    return {
      passed: false,
      reason: blockReason(prospect),
      requiresHumanReview: true,
      prospect,
    };
  }

  return {
    passed: true,
    reason: 'consent permits contact; human approval still required before any send',
    requiresHumanReview: requiresHumanReviewForOutreach(prospect),
    prospect,
  };
}
