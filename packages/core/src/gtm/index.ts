/**
 * Demandara GTM (Sales Closer) guardrail helpers.
 *
 * Pure, side-effect-free policy logic for the GTM prospecting universe. There
 * are NO scrapers, NO Apify/Hunter/Apollo/Clay/PDL integrations, NO outreach
 * sending, and NO autonomous cold messaging here — those are explicitly out of
 * scope (see docs/sales-closer/). This module only:
 *   - normalizes prospect input into a PII-safe `GtmProspect` (hash/mask only);
 *   - answers compliance questions (may we use a source? may we contact? does
 *     this need human review?);
 *   - classifies a source's risk;
 *   - builds (but never persists) proof-of-sourcing/outreach events.
 *
 * The only runtime dependency is `node:crypto` (already used in
 * `packages/core/src/logging.ts`) — no new package dependency is added.
 *
 * GTM prospects are kept strictly separate from dealership customer leads
 * (`leads` / MoverOS `lead_intakes`); nothing here imports or aliases those.
 */

import { createHash, randomUUID } from 'node:crypto';
import type {
  ConsentStatus,
  DataSource,
  GtmProspect,
  IsoTimestamp,
  RawGtmProspectInput,
  SourceRisk,
  SourceType,
  Uuid,
} from '../types/index.js';

/* ------------------------------------------------------------------ proofs */

/** Evidence tags, mirroring the platform proof doctrine (trust schemas). */
export type GtmEvidenceTag = 'verified_fact' | 'likely_inference' | 'unknown';

/** Proof-event kinds in the taxonomy `gtm.<entity>.<action>.vN`. */
export type GtmProofKind =
  | 'gtm.prospect.sourced.v1'
  | 'gtm.source.reviewed.v1'
  | 'gtm.outreach.drafted.v1'
  | 'gtm.outreach.review_required.v1'
  | 'gtm.discovery.booked.v1'
  | 'gtm.proposal.generated.v1';

/** Input describing a GTM action to record proof for. PII must not appear in `summaryPublic`. */
export interface GtmProofAction {
  kind: GtmProofKind;
  subjectType: string;
  subjectId: Uuid;
  evidenceTag: GtmEvidenceTag;
  summaryPublic?: string | null;
  detailsPrivate?: Record<string, unknown>;
  actorRef: string;
}

/** An append-only proof event. Built in-memory; persistence is the caller's job. */
export interface GtmProofEvent {
  id: Uuid;
  kind: GtmProofKind;
  subjectType: string;
  subjectId: Uuid;
  evidenceTag: GtmEvidenceTag;
  summaryPublic: string | null;
  detailsPrivate: Record<string, unknown>;
  occurredAt: IsoTimestamp;
  actorRef: string;
}

export interface GtmProofOptions {
  id?: Uuid;
  occurredAt?: Date;
}

/**
 * Build an append-only GTM proof event. Pure: no IO, no persistence. `id` and
 * `occurredAt` are injectable for deterministic tests.
 */
export function createGtmProofEvent(
  action: GtmProofAction,
  opts: GtmProofOptions = {},
): GtmProofEvent {
  return {
    id: opts.id ?? randomUUID(),
    kind: action.kind,
    subjectType: action.subjectType,
    subjectId: action.subjectId,
    evidenceTag: action.evidenceTag,
    summaryPublic: action.summaryPublic ?? null,
    detailsPrivate: action.detailsPrivate ?? {},
    occurredAt: (opts.occurredAt ?? new Date()).toISOString(),
    actorRef: action.actorRef,
  };
}

/* ---------------------------------------------------------------- guardrails */

/**
 * Whether a data source may be used for prospecting at all. Blocked sources
 * (by risk OR production status) must never be used.
 */
export function canUseSourceForProspecting(source: DataSource): boolean {
  return source.riskLevel !== 'blocked' && source.productionStatus !== 'blocked';
}

/**
 * Whether a prospect may be contacted. Hard blocks: do-not-contact flag, an
 * unsubscribe, or a consent state of unsubscribed/do_not_contact.
 */
export function canContactProspect(prospect: GtmProspect): boolean {
  if (prospect.doNotContact) return false;
  if (prospect.unsubscribeStatus === 'unsubscribed') return false;
  if (prospect.consentStatus === 'do_not_contact' || prospect.consentStatus === 'unsubscribed') {
    return false;
  }
  return true;
}

/**
 * Global invariant: every AI-generated outreach draft requires human approval
 * before send. There is no fully autonomous outreach path.
 */
export const GTM_OUTREACH_REQUIRES_HUMAN_APPROVAL = true as const;

/**
 * Whether outreach prep additionally requires a human review gate. True when
 * consent is not established, or the prospect was sourced at high risk. (This
 * is on top of {@link GTM_OUTREACH_REQUIRES_HUMAN_APPROVAL}, which always holds.)
 */
export function requiresHumanReviewForOutreach(prospect: GtmProspect): boolean {
  return prospect.consentStatus === 'not_established' || prospect.sourceRisk === 'high';
}

const SOURCE_RISK_BY_TYPE: Record<SourceType, SourceRisk> = {
  public_registry: 'low',
  industry_directory: 'low',
  oem_locator: 'low',
  own_website: 'low',
  open_data: 'low',
  enrichment_api: 'medium',
  search_engine: 'medium',
  maps_platform: 'high',
  social_platform: 'high',
  other: 'medium',
};

/**
 * Deterministically classify a source's risk from its type/production status.
 * A blocked production status overrides to 'blocked'; unknown types are treated
 * conservatively as 'medium'.
 */
export function classifySourceRisk(source: DataSource): SourceRisk {
  if (source.productionStatus === 'blocked') return 'blocked';
  return SOURCE_RISK_BY_TYPE[source.sourceType] ?? 'medium';
}

/* ----------------------------------------------------------- normalization */

function trimOrNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function sha256Hex(value: string, salt: string): string {
  return createHash('sha256')
    .update(salt + value)
    .digest('hex');
}

/** Lowercase + trim, applied BEFORE hashing so casing never changes the hash. */
function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Reduce a phone to digits only before hashing. */
function normalizePhone(raw: string): string {
  return raw.replace(/\D+/g, '');
}

function maskEmail(normalizedEmail: string): string {
  const at = normalizedEmail.indexOf('@');
  if (at <= 0) return '***';
  const first = normalizedEmail.slice(0, 1);
  const domain = normalizedEmail.slice(at + 1);
  return `${first}***@${domain}`;
}

function maskPhone(digits: string): string {
  if (digits.length < 4) return '***';
  return `***-***-${digits.slice(-4)}`;
}

function emailDomain(normalizedEmail: string): string | null {
  const at = normalizedEmail.lastIndexOf('@');
  if (at < 0) return null;
  const domain = normalizedEmail.slice(at + 1);
  return domain.length ? domain : null;
}

export interface NormalizeOptions {
  id?: Uuid;
  now?: Date;
  /** Optional salt/pepper for the contact hashes. */
  hashSalt?: string;
}

/**
 * Normalize raw prospect input into a PII-safe `GtmProspect`.
 *
 * Raw email/phone (if present) are lowercased/digit-normalized, hashed, masked,
 * and reduced to a domain — then DROPPED. The returned object never contains
 * `contactEmail` or `contactPhone`. Consent/contact fields default to the safe
 * (most-restrictive-by-omission) values.
 */
export function normalizeGtmProspect(
  raw: RawGtmProspectInput,
  opts: NormalizeOptions = {},
): GtmProspect {
  const nowIso = (opts.now ?? new Date()).toISOString();
  const id = opts.id ?? raw.id ?? randomUUID();
  const salt = opts.hashSalt ?? '';

  const rawEmail = raw.contactEmail ? normalizeEmail(raw.contactEmail) : null;
  const rawPhone = raw.contactPhone ? normalizePhone(raw.contactPhone) : null;
  const hasEmail = rawEmail != null && rawEmail.length > 0;
  const hasPhone = rawPhone != null && rawPhone.length > 0;

  return {
    id,
    companyName: trimOrNull(raw.companyName) ?? '',
    website: trimOrNull(raw.website),
    city: trimOrNull(raw.city),
    provinceOrState: trimOrNull(raw.provinceOrState),
    country: trimOrNull(raw.country),
    businessType: trimOrNull(raw.businessType),
    inventoryModelGuess: trimOrNull(raw.inventoryModelGuess),
    source: trimOrNull(raw.source) ?? 'unknown',
    sourceUrl: trimOrNull(raw.sourceUrl),
    sourceRisk: raw.sourceRisk ?? 'medium',
    contactName: trimOrNull(raw.contactName),
    contactRole: trimOrNull(raw.contactRole),
    contactEmailHash: hasEmail ? sha256Hex(rawEmail as string, salt) : null,
    contactPhoneHash: hasPhone ? sha256Hex(rawPhone as string, salt) : null,
    contactEmailMasked: hasEmail ? maskEmail(rawEmail as string) : null,
    contactPhoneMasked: hasPhone ? maskPhone(rawPhone as string) : null,
    contactDomain: hasEmail ? emailDomain(rawEmail as string) : null,
    contactBasis: raw.contactBasis ?? 'unknown',
    consentStatus: raw.consentStatus ?? 'not_established',
    unsubscribeStatus: raw.unsubscribeStatus ?? 'subscribed',
    doNotContact: raw.doNotContact ?? false,
    fitScore: raw.fitScore ?? 0,
    packageFit: trimOrNull(raw.packageFit),
    discoveryStatus: raw.discoveryStatus ?? 'not_started',
    proposalStatus: raw.proposalStatus ?? 'none',
    assignedOwner: trimOrNull(raw.assignedOwner),
    lastContactedAt: raw.lastContactedAt ?? null,
    nextStep: trimOrNull(raw.nextStep),
    notes: trimOrNull(raw.notes),
    createdAt: raw.createdAt ?? nowIso,
    updatedAt: raw.updatedAt ?? nowIso,
  };
}

/* --------------------------------------------------------------- policy data */

/**
 * Behavioral policy for the Demandara GTM agent. Pure data describing the
 * allowed/forbidden actions; the agent layer and the (future) UI enforce it.
 */
export const DEMANDARA_GTM_AGENT_POLICY = {
  allowed: [
    'summarize_prospect',
    'score_fit',
    'draft_human_reviewed_outreach',
    'create_discovery_prep_note',
    'log_proof_event',
  ],
  forbidden: [
    'scrape_blocked_sources',
    'send_autonomous_cold_outreach',
    'bypass_unsubscribe_or_do_not_contact',
    'invent_contacts',
    'enrich_sensitive_personal_data_without_review',
    'claim_guaranteed_results',
  ],
} as const;

/** Illustrative proof-event scenarios for the GTM pipeline (docs/UI reference). */
export const GTM_PROOF_EVENT_EXAMPLES: ReadonlyArray<{ kind: GtmProofKind; description: string }> =
  [
    {
      kind: 'gtm.prospect.sourced.v1',
      description: 'Prospect sourced from an approved public source.',
    },
    { kind: 'gtm.source.reviewed.v1', description: 'Data source reviewed and risk-classified.' },
    { kind: 'gtm.outreach.drafted.v1', description: 'Outreach draft generated for human review.' },
    {
      kind: 'gtm.outreach.review_required.v1',
      description: 'Human review required before any send.',
    },
    {
      kind: 'gtm.discovery.booked.v1',
      description: 'Discovery call booked manually after qualification.',
    },
    {
      kind: 'gtm.proposal.generated.v1',
      description: 'Proposal generated for a qualified prospect.',
    },
  ];
