import type { ConsentStatus, ContactBasis, IsoTimestamp, SourceRisk, Uuid } from '@cognitia/core';

/**
 * Web-local compliance / channel VIEW MODELS for the Sales Closer demo surfaces.
 *
 * These are intentionally NOT in `@cognitia/core`. The canonical shared
 * foundations are:
 *   - #97 PII-safe GTM primitives (`GtmProspect`, `SourceRisk`, `ContactBasis`,
 *     `ConsentStatus`, `DataSource`) — imported type-only below; and
 *   - #93 Sales Closer data layer (sources / runs / profiles / briefs / scoring),
 *     which lives at the DB/domain altitude (`@cognitia/core` zod schemas +
 *     `@cognitia/db`) and is the canonical closer foundation.
 *
 * The per-CHANNEL outreach gating, evidence view model, and compliance-log shape
 * here are demo-only presentation types for the web governance pages. Keeping
 * them local avoids a second, parallel compliance surface in shared core while
 * still reusing the canonical #97 unions (`SourceRisk`, `ContactBasis`,
 * `ConsentStatus`) rather than redefining them. Type-only core import keeps the
 * web bundle free of core's runtime (zod / node:crypto).
 *
 * PII doctrine (matches #97): evidence carries business facts + provenance only —
 * never raw `contactEmail` / `contactPhone`.
 */

/** Outreach channels. Gated channels are off by default (see CompliancePolicy). */
export type Channel =
  | 'email'
  | 'phone'
  | 'sms'
  | 'whatsapp'
  | 'ai_voice'
  | 'linkedin'
  | 'manual_task';

/** Per-channel posture. `gated_off` = disabled until explicitly approved. */
export type ChannelStatus = 'enabled' | 'human_review_required' | 'gated_off' | 'blocked';

/** Outcome of a compliance evaluation. Outreach channels never auto-`allowed`. */
export type ComplianceDecision = 'allowed' | 'human_review_required' | 'blocked';

/** A single piece of provenance evidence (no raw contact PII in fieldValue). */
export interface EvidenceField {
  sourceUrl: string;
  sourceName: string;
  capturedAt: IsoTimestamp;
  capturedBy: string;
  fieldName: string;
  fieldValue: string;
  confidence: 'low' | 'medium' | 'high';
  notes?: string;
}

/** Result of evaluating one channel for one prospect. */
export interface ChannelEligibility {
  channel: Channel;
  status: ChannelStatus;
  decision: ComplianceDecision;
  requiresHumanApproval: boolean;
  reasons: string[];
}

/** Append-only compliance audit log entry (demo view model). */
export interface ComplianceLog {
  id: Uuid;
  tenantId?: string;
  prospectId?: Uuid;
  leadId?: Uuid;
  actorType: 'system' | 'agent' | 'human';
  actorId: string;
  actionType: string;
  channel?: Channel;
  decision: ComplianceDecision;
  consentStatus?: ConsentStatus;
  contactBasis?: ContactBasis;
  sourceRisk?: SourceRisk;
  humanApprovalRequired: boolean;
  evidenceFields: EvidenceField[];
  reason: string;
  createdAt: IsoTimestamp;
}

/** Default channel policy + required evidence/suppression posture. */
export interface CompliancePolicy {
  channels: Record<Channel, ChannelStatus>;
  requireUnsubscribeForEmail: boolean;
  requireDncChecksForPhone: boolean;
  requiredEvidenceFields: string[];
  aiDraftsRequireHumanApproval: boolean;
}

/** Result of a full compliance check for a prospect + channel. */
export interface ComplianceCheckResult {
  decision: ComplianceDecision;
  channel: Channel;
  requiresHumanApproval: boolean;
  reasons: string[];
  evidenceComplete: boolean;
}
