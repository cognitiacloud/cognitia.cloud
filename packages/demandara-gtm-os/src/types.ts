import { z } from 'zod';

/**
 * Demandara GTM OS chassis — shared domain types.
 *
 * Everything in this package is LOCAL/MOCK-ONLY. There is no live provider,
 * CRM, outreach, deployment, or egress path anywhere in this module map, and
 * none may be added without a separately authorized builder lane (see
 * docs/claude-context/demandara-gtm-os/01_CANON_AND_BOUNDARIES.md).
 *
 * Deny-by-default doctrine (04_SALES_CLOSER_WORKFLOW_CONTEXT.md):
 *   - unknown source rights block external action;
 *   - missing consent blocks external action;
 *   - no human approval blocks mock writeback (and any future live writeback);
 *   - non-fixture data modes fail the audit.
 */

/** Injectable clock so every module is deterministic under test. */
export type Clock = () => Date;

/** Injectable id factory (defaults to crypto.randomUUID at call sites). */
export type IdFactory = () => string;

/** Evidence labels from 01_CANON_AND_BOUNDARIES.md — every output carries one. */
export const EVIDENCE_LABELS = [
  'IMPLEMENTED_LOCAL_MOCK',
  'DOC_ONLY',
  'DESIGN_ONLY',
  'TESTED_LOCAL',
  'BLOCKED_ENVIRONMENT',
  'NEEDS_REVIEW',
  'NOT_VISIBLE_IN_THIS_REPO',
] as const;
export const evidenceLabel = z.enum(EVIDENCE_LABELS);
export type EvidenceLabel = z.infer<typeof evidenceLabel>;

/**
 * Data modes a lead can carry. Only fixture/reserved modes are allowed in this
 * build; 'live_customer' exists in the vocabulary so the gate can prove that it
 * fails closed rather than being merely unrepresentable.
 */
export const dataMode = z.enum(['fake_fixture', 'internal_reserved', 'live_customer']);
export type DataMode = z.infer<typeof dataMode>;

export const ALLOWED_DATA_MODES: readonly DataMode[] = ['fake_fixture', 'internal_reserved'];

/** Verticals known to the chassis (06_VERTICAL_ADAPTERS_CONTEXT.md). */
export const verticalId = z.enum([
  'budget_wheels_dealeros',
  'moveros_reference',
  'skillocate',
  'alpha_investo',
]);
export type VerticalId = z.infer<typeof verticalId>;

export const sourceType = z.enum([
  'marketplace_listing',
  'website_form',
  'referral',
  'manual_entry',
  'demo_scenario',
]);
export type SourceType = z.infer<typeof sourceType>;

/** Source-rights state. Anything except the two granted states blocks. */
export const sourceRightsStatus = z.enum(['verified_fixture', 'granted', 'unknown', 'denied']);
export type SourceRightsStatus = z.infer<typeof sourceRightsStatus>;

export const consentStatus = z.enum(['granted', 'not_established', 'revoked', 'do_not_contact']);
export type ConsentStatus = z.infer<typeof consentStatus>;

export const desiredTimeline = z.enum(['immediate', 'this_week', 'this_month', 'exploring']);
export type DesiredTimeline = z.infer<typeof desiredTimeline>;

/**
 * Normalized Demandara lead (04_SALES_CLOSER_WORKFLOW_CONTEXT.md required
 * fields). Contact fields are fixture aliases only — raw PII must never appear
 * here; fixture authenticity is enforced by tests.
 *
 * Defaults are the most-restrictive-by-omission values (deny by default):
 * missing consent -> not_established, missing source rights -> unknown,
 * missing contact permission -> false. `dataMode` has NO default on purpose —
 * a lead that does not declare its data mode fails intake.
 *
 * Unknown keys are stripped, so caller-supplied fields like `humanApproved`
 * can never ride into the workflow (see approvalGate.ts invariant).
 */
export const demandaraLeadSchema = z.object({
  leadId: z.string().min(1),
  scenarioId: z.string().min(1),
  dataMode,
  vertical: verticalId,
  sourceType,
  sourceRightsStatus: sourceRightsStatus.default('unknown'),
  consentStatus: consentStatus.default('not_established'),
  contactAllowed: z.boolean().default(false),
  contactAlias: z.string().min(1),
  contactEmailFixture: z.string().email().optional(),
  contactPhoneFixture: z.string().optional(),
  avatarSegment: z.string().min(1),
  painCategory: z.string().min(1),
  desiredOutcome: z.string().min(1),
  desiredTimeline: desiredTimeline.default('exploring'),
  intentSignals: z.array(z.string()).default([]),
  vehicleInterest: z.string().optional(),
  budgetBand: z.string().optional(),
  notes: z.string().optional(),
});
export type DemandaraLead = z.infer<typeof demandaraLeadSchema>;

/** Raw fixture input before intake validation. */
export type RawLeadInput = unknown;

/** Sales Closer state machine (04_SALES_CLOSER_WORKFLOW_CONTEXT.md). */
export type WorkflowState =
  | 'lead_received'
  | 'source_rights_checked'
  | 'qualified_or_disqualified'
  | 'trust_gap_identified'
  | 'recommended_next_step_generated'
  | 'human_approval_required'
  | 'human_approved'
  | 'human_denied'
  | 'human_hold'
  | 'mock_writeback_recorded'
  | 'proof_receipt_generated'
  | 'monthly_report_updated';

/**
 * Canonical blocked-reason codes. Codes are stable identifiers; values are the
 * human-readable explanations that end up on proof receipts.
 */
export const BLOCKED_REASONS = {
  LEAD_SCHEMA_INVALID: 'Lead payload failed intake validation.',
  LIVE_DATA_MODE_REJECTED:
    'Lead declares a live/customer data mode; this build only accepts fake/reserved fixtures.',
  VERTICAL_ADAPTER_NOT_AVAILABLE:
    'No implemented vertical adapter for this vertical; reference/design-only verticals cannot run.',
  DATA_MODE_NOT_ALLOWED_FOR_VERTICAL: 'The vertical adapter does not allow this data mode.',
  SOURCE_RIGHTS_UNKNOWN: 'Source rights are unknown; external action is blocked.',
  SOURCE_RIGHTS_DENIED: 'Source rights were denied; external action is blocked.',
  CONSENT_MISSING: 'Consent is not established; external action is blocked.',
  CONSENT_REVOKED: 'Consent was revoked or the contact opted out; external action is blocked.',
  CONTACT_NOT_ALLOWED: 'Contact is not allowed for this lead; external action is blocked.',
  LEAD_DISQUALIFIED: 'Lead did not qualify for this vertical avatar; no next action taken.',
  HUMAN_APPROVAL_MISSING:
    'No trusted human approval event exists for this lead; writeback is blocked.',
  HUMAN_APPROVAL_DENIED: 'A human reviewer denied this action.',
  HUMAN_APPROVAL_HOLD: 'A human reviewer placed this action on hold.',
  FORGED_APPROVAL_REJECTED:
    'A caller-supplied approval did not match any trusted approval event issued by the local registry.',
  CONNECTOR_NOT_REGISTERED: 'Connector is not registered; action is blocked by default.',
  CONNECTOR_LIVE_BLOCKED:
    'Connector state is not mock_only; live/disabled connectors are blocked in this build.',
  CONNECTOR_EGRESS_DENIED: 'Connector egress is not permitted in this build.',
  CONNECTOR_APPROVAL_REQUIRED: 'Connector writeback requires a verified human approval event.',
  LIVE_PROVIDER_NOT_AUTHORIZED:
    'Live provider routes are not authorized in this build; the route fails closed.',
  PROVIDER_DISABLED: 'Provider route is disabled; the route fails closed.',
  REPLAY_FIXTURE_MISSING: 'Replay fixture was not found; the route fails closed.',
  SECRET_LIKE_INPUT_REJECTED:
    'Route input looked like it contained a secret/credential and was rejected.',
} as const;
export type BlockedReasonCode = keyof typeof BLOCKED_REASONS;

/** A blocked reason as it appears on receipts, summaries, and ledger events. */
export interface BlockedReason {
  code: BlockedReasonCode;
  detail: string;
}

export function blockedReason(code: BlockedReasonCode, extraDetail?: string): BlockedReason {
  const base = BLOCKED_REASONS[code];
  return { code, detail: extraDetail ? `${base} ${extraDetail}` : base };
}

/** Result of a single gate check. Deny by default: callers treat anything but `allowed: true` as a block. */
export type GateResult = { allowed: true } | { allowed: false; reason: BlockedReason };
