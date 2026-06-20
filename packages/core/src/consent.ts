/**
 * Consent enforcement shared by every outbound vendor action.
 *
 * The do-not-call / opt-out check used to live inline in `createVendorLead`
 * only, which meant a call could still be *scheduled* for a suppressed contact
 * through a different entry point. Centralising the rule here lets both lead
 * creation and call scheduling enforce the same gate.
 */

/** Consent states a contact can hold (mirrors the db `consent_status` enum). */
export type ConsentStatus = 'unknown' | 'opted_in' | 'opted_out' | 'dnc';

/** Consent states that forbid any outbound contact. */
const SUPPRESSED: ReadonlySet<ConsentStatus> = new Set<ConsentStatus>(['opted_out', 'dnc']);

/** True when a contact may be handed to a vendor for outreach. */
export function isContactCallable(status: ConsentStatus): boolean {
  return !SUPPRESSED.has(status);
}

/**
 * Throw if a contact must not be contacted. Enforced before BOTH creating a
 * vendor lead and scheduling a call, so a suppressed contact can never reach a
 * vendor regardless of entry point.
 */
export function assertContactCallable(status: ConsentStatus): void {
  if (!isContactCallable(status)) {
    throw new Error('Contact has opted out / is on the do-not-call list');
  }
}
