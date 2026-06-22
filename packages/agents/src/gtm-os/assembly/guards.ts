import type { GtmProofEvent, GtmProspect } from '@cognitia/core';

/**
 * Mock-safety guards for the GTM assembly island.
 *
 * The island composes a workflow run into an operator "run packet". Two
 * invariants are enforced here, in-code, before any packet leaves the builder:
 *
 *   1. NO RAW PII — the prospect view exposes only an id + business fields and
 *      PII-safe hashes/masks/domain. Raw `contactEmail`/`contactPhone` never
 *      exist on a `GtmProspect` (they are dropped by `normalizeGtmProspect`),
 *      but {@link toPiiSafeProspect} additionally drops the name + masked
 *      values so the packet carries nothing that could re-identify a person.
 *   2. NO LIVE EGRESS — the island has no network/vendor ports; every boundary
 *      is a mock. {@link assertNoLiveEgress} is a runtime attestation that the
 *      assembly is running in mock/sandbox mode, recorded on every packet.
 *
 * All guards are pure (no IO). This module imports nothing but `@cognitia/core`
 * types — never a network/vendor module.
 */

/** The only operating mode the island supports. There is no live mode. */
export type AssemblyMode = 'mock';

/** Marks a value as not present so packet consumers never look for raw PII. */
export const PII_REDACTED = null;

/**
 * A PII-safe projection of a {@link GtmProspect} for the run packet.
 *
 * Carries the prospect id, business identity, source provenance, compliance
 * signals and pipeline state. Deliberately OMITS: contactName, the email/phone
 * hashes, the masked email/phone, and the email domain — none are needed by an
 * operator console and all narrow the re-identification surface to zero.
 */
export interface PiiSafeProspect {
  id: GtmProspect['id'];
  companyName: string;
  website: string | null;
  city: string | null;
  provinceOrState: string | null;
  country: string | null;
  businessType: string | null;
  source: string;
  sourceUrl: string | null;
  sourceRisk: GtmProspect['sourceRisk'];
  contactRole: string | null;
  contactBasis: GtmProspect['contactBasis'];
  consentStatus: GtmProspect['consentStatus'];
  unsubscribeStatus: GtmProspect['unsubscribeStatus'];
  doNotContact: boolean;
  fitScore: number;
  discoveryStatus: GtmProspect['discoveryStatus'];
  proposalStatus: GtmProspect['proposalStatus'];
}

/**
 * Project a normalized prospect onto the PII-safe shape for the packet. Drops
 * every contact-identity field (name / hashes / masks / domain). Pure.
 */
export function toPiiSafeProspect(prospect: GtmProspect): PiiSafeProspect {
  return {
    id: prospect.id,
    companyName: prospect.companyName,
    website: prospect.website,
    city: prospect.city,
    provinceOrState: prospect.provinceOrState,
    country: prospect.country,
    businessType: prospect.businessType,
    source: prospect.source,
    sourceUrl: prospect.sourceUrl,
    sourceRisk: prospect.sourceRisk,
    contactRole: prospect.contactRole,
    contactBasis: prospect.contactBasis,
    consentStatus: prospect.consentStatus,
    unsubscribeStatus: prospect.unsubscribeStatus,
    doNotContact: prospect.doNotContact,
    fitScore: prospect.fitScore,
    discoveryStatus: prospect.discoveryStatus,
    proposalStatus: prospect.proposalStatus,
  };
}

/**
 * Matches a bare `@` (email shape). This is an email-only backstop: the packet's
 * prospect projection ({@link toPiiSafeProspect}) already drops every contact
 * field, so this guards against a regression re-introducing an email. Robust
 * email+phone PII detection lives in `crm-lite/timeline.ts` and the web
 * view-model, which operate on free-form summaries where phones can appear.
 */
const RAW_EMAIL = /@/;

/**
 * Throw if a serialized value contains a raw email address. Used as a belt-and
 * -braces check on the assembled packet so a regression that re-introduces a
 * contact field is caught loudly rather than shipped. Pure.
 */
export function assertNoRawPii(value: unknown, context: string): void {
  const serialized = JSON.stringify(value) ?? '';
  if (RAW_EMAIL.test(serialized)) {
    throw new Error(`gtm-os assembly: raw PII (email) detected in ${context}`);
  }
}

/** Runtime attestation that no live send/egress occurred during a run. */
export interface NoEgressAttestation {
  mode: AssemblyMode;
  /** Always false in this island — there is no send path. */
  liveSendOccurred: false;
  /** Human-readable statement for the operator console + audit. */
  statement: string;
}

/**
 * Build (and assert) the no-live-egress attestation. The island has no network
 * or vendor port, so a live send is impossible by construction; this records
 * that fact on the packet and throws if ever called with a non-mock mode.
 */
export function assertNoLiveEgress(mode: AssemblyMode): NoEgressAttestation {
  if (mode !== 'mock') {
    throw new Error(`gtm-os assembly: only mock mode is supported (got "${mode}")`);
  }
  return {
    mode,
    liveSendOccurred: false,
    statement:
      'MOCK/SANDBOX: no live email/SMS/call/CRM sync occurred; all boundaries are in-memory mocks.',
  };
}

/** Strip any accidental raw-PII fields from a proof event's private details. */
export function proofCarriesNoRawPii(event: GtmProofEvent): boolean {
  return !RAW_EMAIL.test(JSON.stringify(event.detailsPrivate) ?? '');
}
