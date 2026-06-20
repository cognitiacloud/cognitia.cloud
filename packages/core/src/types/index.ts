/**
 * Shared primitive types. PascalCase per naming conventions; IDs are UUIDs.
 * These are intentionally light — runtime validation lives in `../schemas`.
 */

export type Uuid = string;
export type IsoTimestamp = string;

/** A reference to an entity, e.g. "account:uuid" or "contact:uuid". */
export type EntityRef = `${string}:${string}`;

/** Risk levels drive the PolicyGate approval decision. */
export type RiskLevel = 'none' | 'low' | 'medium' | 'high';

/** Lifecycle of an agent run. */
export type AgentRunStatus = 'pending' | 'running' | 'completed' | 'failed';

/** Human approval lifecycle of a proposed side-effect action. */
export type ApprovalStatus = 'proposed' | 'approved' | 'rejected';

/** Execution lifecycle of an approved side-effect action. */
export type ExecutionStatus = 'pending' | 'executing' | 'executed' | 'failed';

/** Event domains in the taxonomy `domain.entity.action.vN`. */
export type EventDomain =
  | 'crm'
  | 'outbound'
  | 'agent'
  | 'signal'
  | 'eval'
  | 'integration'
  | 'inbound'
  | 'calendar'
  | 'system';

/** Reply classification labels (Mira v1). */
export type ReplyClass =
  | 'interested'
  | 'not_interested'
  | 'unsubscribe'
  | 'wrong_person'
  | 'out_of_office'
  | 'referral'
  | 'other';

/* ---------------------------------------------------------------------------
 * Demandara GTM (Sales Closer) prospecting types.
 *
 * These describe the GTM *prospect* universe — dealership owners/operators who
 * may buy the product — sourced via the governed public/business data strategy
 * in docs/sales-closer/. This is DELIBERATELY SEPARATE from the dealership
 * *customer* lead universe (car shoppers → `leads` / MoverOS `lead_intakes`);
 * the two must not be mixed. `GtmProspect` is a prospecting DTO / domain type,
 * NOT a customer-lead model and NOT a new database table.
 *
 * PII doctrine (ARCHITECTURE_LOCK_V1_1): no raw persistent contact PII. A
 * normalized `GtmProspect` carries only hashes, masks, and the email domain —
 * never raw email/phone. Raw values may transit `RawGtmProspectInput` only.
 * ------------------------------------------------------------------------- */

/** Risk class of a data source (drives prospecting/outreach gating). */
export type SourceRisk = 'low' | 'medium' | 'high' | 'blocked';

/** Lawful basis under which a business contact was obtained (CASL-aware). */
export type ContactBasis =
  | 'inbound'
  | 'existing_business_relationship'
  | 'conspicuously_published_business_contact'
  | 'referral'
  | 'manual_research'
  | 'enrichment_provider'
  | 'unknown';

/** Consent state for outreach to a prospect. */
export type ConsentStatus =
  | 'express'
  | 'implied_possible'
  | 'not_established'
  | 'unsubscribed'
  | 'do_not_contact';

/** Whether a prospect has unsubscribed from outreach. */
export type UnsubscribeStatus = 'subscribed' | 'unsubscribed';

/** Whether a data source is safe for production use, or prototype-only. */
export type ProductionStatus = 'prototype' | 'legal_review' | 'production' | 'blocked';

/** Kind of data source, used to classify its risk deterministically. */
export type SourceType =
  | 'public_registry'
  | 'industry_directory'
  | 'oem_locator'
  | 'own_website'
  | 'open_data'
  | 'search_engine'
  | 'maps_platform'
  | 'social_platform'
  | 'enrichment_api'
  | 'other';

/** Discovery (qualification) lifecycle of a GTM prospect. */
export type DiscoveryStatus =
  | 'not_started'
  | 'researching'
  | 'qualified'
  | 'booked'
  | 'disqualified';

/** Proposal lifecycle of a GTM prospect. */
export type ProposalStatus = 'none' | 'drafting' | 'sent' | 'won' | 'lost';

/**
 * A normalized GTM prospect (dealership account + decision-maker reference).
 * Carries NO raw contact PII — only hashes/masks/domain. Produced by
 * `normalizeGtmProspect`. Not a customer-lead record and not a DB table.
 */
export interface GtmProspect {
  id: Uuid;
  companyName: string;
  website: string | null;
  city: string | null;
  provinceOrState: string | null;
  country: string | null;
  businessType: string | null;
  inventoryModelGuess: string | null;
  source: string;
  sourceUrl: string | null;
  sourceRisk: SourceRisk;
  contactName: string | null;
  contactRole: string | null;
  /** sha256 of the normalized (lowercased/trimmed) email. Never the raw value. */
  contactEmailHash: string | null;
  /** sha256 of the digits-only phone. Never the raw value. */
  contactPhoneHash: string | null;
  /** Masked email safe for UI/debug, e.g. "j***@dealer.com". */
  contactEmailMasked: string | null;
  /** Masked phone safe for UI/debug, e.g. "***-***-1234". */
  contactPhoneMasked: string | null;
  /** Email domain (business signal), e.g. "dealer.com". */
  contactDomain: string | null;
  contactBasis: ContactBasis;
  consentStatus: ConsentStatus;
  unsubscribeStatus: UnsubscribeStatus;
  doNotContact: boolean;
  fitScore: number;
  packageFit: string | null;
  discoveryStatus: DiscoveryStatus;
  proposalStatus: ProposalStatus;
  assignedOwner: string | null;
  lastContactedAt: IsoTimestamp | null;
  nextStep: string | null;
  notes: string | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

/**
 * Transient input to `normalizeGtmProspect`. Raw `contactEmail`/`contactPhone`
 * may enter here, but are hashed/masked and DROPPED — they never appear on the
 * returned `GtmProspect`. Do not persist this shape.
 */
export interface RawGtmProspectInput {
  id?: Uuid;
  companyName: string;
  website?: string | null;
  city?: string | null;
  provinceOrState?: string | null;
  country?: string | null;
  businessType?: string | null;
  inventoryModelGuess?: string | null;
  source: string;
  sourceUrl?: string | null;
  sourceRisk?: SourceRisk;
  contactName?: string | null;
  contactRole?: string | null;
  /** Transient raw email — hashed/masked then dropped. Never persisted. */
  contactEmail?: string | null;
  /** Transient raw phone — hashed/masked then dropped. Never persisted. */
  contactPhone?: string | null;
  contactBasis?: ContactBasis;
  consentStatus?: ConsentStatus;
  unsubscribeStatus?: UnsubscribeStatus;
  doNotContact?: boolean;
  fitScore?: number;
  packageFit?: string | null;
  discoveryStatus?: DiscoveryStatus;
  proposalStatus?: ProposalStatus;
  assignedOwner?: string | null;
  lastContactedAt?: IsoTimestamp | null;
  nextStep?: string | null;
  notes?: string | null;
  createdAt?: IsoTimestamp;
  updatedAt?: IsoTimestamp;
}

/** A governed data source in the Sales Closer Data Source Registry. */
export interface DataSource {
  id: Uuid;
  name: string;
  category: string;
  sourceType: SourceType;
  allowedUse: string;
  disallowedUse: string;
  riskLevel: SourceRisk;
  fieldsAvailable: string[];
  productionStatus: ProductionStatus;
  notes: string;
}
