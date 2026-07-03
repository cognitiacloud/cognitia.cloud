import type { BlockedReason, DemandaraLead, GateResult } from './types.js';
import { blockedReason } from './types.js';

/**
 * Consent / source-rights gate (deny by default).
 *
 * Doctrine (04_SALES_CLOSER_WORKFLOW_CONTEXT.md):
 *   - unknown source rights: block external action;
 *   - missing consent: block external action.
 *
 * The gate is pure — it never mutates the lead and performs no IO.
 */

export function checkSourceRights(lead: DemandaraLead): GateResult {
  switch (lead.sourceRightsStatus) {
    case 'verified_fixture':
    case 'granted':
      return { allowed: true };
    case 'denied':
      return { allowed: false, reason: blockedReason('SOURCE_RIGHTS_DENIED') };
    case 'unknown':
      return { allowed: false, reason: blockedReason('SOURCE_RIGHTS_UNKNOWN') };
  }
}

export function checkConsent(lead: DemandaraLead): GateResult {
  switch (lead.consentStatus) {
    case 'granted':
      break;
    case 'revoked':
    case 'do_not_contact':
      return { allowed: false, reason: blockedReason('CONSENT_REVOKED') };
    case 'not_established':
      return { allowed: false, reason: blockedReason('CONSENT_MISSING') };
  }
  if (!lead.contactAllowed) {
    return { allowed: false, reason: blockedReason('CONTACT_NOT_ALLOWED') };
  }
  return { allowed: true };
}

export interface ConsentGateEvaluation {
  allowed: boolean;
  sourceRights: GateResult;
  consent: GateResult;
  /** First blocking reason encountered (source rights checked first), else null. */
  blocked: BlockedReason | null;
}

/**
 * Evaluate the combined gate. Source rights are checked before consent so the
 * receipt reports the earliest failure, but both individual results are
 * returned for the Command Center.
 */
export function evaluateConsentGate(lead: DemandaraLead): ConsentGateEvaluation {
  const sourceRights = checkSourceRights(lead);
  const consent = checkConsent(lead);
  const blocked = !sourceRights.allowed
    ? sourceRights.reason
    : !consent.allowed
      ? consent.reason
      : null;
  return { allowed: blocked === null, sourceRights, consent, blocked };
}
