/**
 * Client Zero Sales Closer workflow — domain types (mock-only, Phase-1 core).
 *
 * Models the executable flow:
 *   lead in → consent/compliance gate → human approval → appointment booking /
 *   mock CRM writeback → proof report
 *
 * Doctrine: this is the platform-native state-machine core. It performs NO live
 * vendor/network calls (see packages/core/src/closer.guard.test.ts containment
 * guard for this directory) and persists NO raw contact PII — the lead intake's
 * raw email/phone transit only `RawGtmProspectInput` and are dropped by
 * `normalizeGtmProspect` before anything is recorded.
 */

import type {
  GtmProofEvent,
  GtmProspect,
  IsoTimestamp,
  RawGtmProspectInput,
  Uuid,
} from '@cognitia/core';

/* ------------------------------------------------------------------- states */

/**
 * Workflow states. The seven canonical states the pipeline must expose, plus
 * `rejected` — the terminal outcome when a human reviewer declines a lead (kept
 * distinct from `compliance_blocked`, which is a policy/consent failure).
 */
export type CloserWorkflowState =
  | 'received'
  | 'compliance_blocked'
  | 'awaiting_human_approval'
  | 'approved'
  | 'appointment_ready'
  | 'crm_written'
  | 'proof_ready'
  | 'rejected';

/** All workflow states, in canonical happy-path-then-branches order. */
export const CLOSER_WORKFLOW_STATES: readonly CloserWorkflowState[] = [
  'received',
  'compliance_blocked',
  'awaiting_human_approval',
  'approved',
  'appointment_ready',
  'crm_written',
  'proof_ready',
  'rejected',
] as const;

/** Terminal states: no further transitions are accepted from these. */
export const CLOSER_TERMINAL_STATES: readonly CloserWorkflowState[] = [
  'compliance_blocked',
  'rejected',
  'proof_ready',
] as const;

/** A human reviewer's decision at the approval gate. */
export type CloserHumanDecision = 'approve' | 'reject';

/* ------------------------------------------------------------------- events */

/** Events that drive the state machine. */
export type CloserWorkflowEvent =
  | { type: 'RUN_COMPLIANCE_GATE'; passed: boolean }
  | { type: 'HUMAN_DECISION'; decision: CloserHumanDecision }
  | { type: 'BOOK_APPOINTMENT' }
  | { type: 'WRITE_CRM' }
  | { type: 'EMIT_PROOF' };

export type CloserWorkflowEventType = CloserWorkflowEvent['type'];

/**
 * Result of applying one event to the machine. A pure reducer never throws:
 * invalid transitions return `{ ok: false, reason }`.
 */
export type CloserStateTransition =
  | { ok: true; from: CloserWorkflowState; to: CloserWorkflowState; event: CloserWorkflowEventType }
  | { ok: false; from: CloserWorkflowState; reason: string; event: CloserWorkflowEventType };

/* -------------------------------------------------------------------- intake */

/**
 * Lead intake DTO. `prospect` is a transient `RawGtmProspectInput` — it MAY
 * carry raw `contactEmail`/`contactPhone`, which are hashed/masked and dropped
 * during normalization. Do not persist this shape; persist the normalized
 * `GtmProspect` on the compliance decision instead.
 */
export interface CloserLeadIntake {
  tenantId: Uuid;
  /** Stable reference to the lead, e.g. "lead:<uuid>". */
  leadRef: string;
  prospect: RawGtmProspectInput;
}

/* --------------------------------------------------------------- compliance */

/** Outcome of the consent/compliance gate. `prospect` is PII-safe (normalized). */
export interface CloserComplianceDecision {
  passed: boolean;
  reason: string;
  /** Whether outreach prep needs an extra human-review gate (always on top of approval). */
  requiresHumanReview: boolean;
  /** Normalized, PII-safe prospect (hashes/masks/domain only). */
  prospect: GtmProspect;
}

/* -------------------------------------------------------------- appointment */

/** A mock-booked appointment. No calendar provider is contacted. */
export interface CloserAppointment {
  appointmentRef: string;
  tenantId: Uuid;
  leadRef: string;
  slotStart: IsoTimestamp;
  slotEnd: IsoTimestamp;
  mode: 'mock';
}

/* ---------------------------------------------------------------------- crm */

/** Input to a CRM writeback. Carries no raw PII — only company + email domain. */
export interface CloserCrmWriteInput {
  tenantId: Uuid;
  leadRef: string;
  companyName: string;
  contactDomain: string | null;
  appointmentRef: string;
  slotStart: IsoTimestamp;
}

/** A record written to the mock CRM. */
export interface CloserCrmRecord {
  externalId: string;
  idempotencyKey: string;
  tenantId: Uuid;
  leadRef: string;
  companyName: string;
  contactDomain: string | null;
  appointmentRef: string;
  slotStart: IsoTimestamp;
  createdAt: IsoTimestamp;
}

/** Result of a writeback. `created` is false when an idempotent replay matched. */
export interface CloserCrmWriteResult {
  record: CloserCrmRecord;
  created: boolean;
}

/** Mock CRM port. Implementations must be idempotent and network-free. */
export interface MockCloserCrm {
  writeBack(input: CloserCrmWriteInput): CloserCrmWriteResult;
  records(): CloserCrmRecord[];
  get(idempotencyKey: string): CloserCrmRecord | undefined;
}

/* ------------------------------------------------------------------- proof */

/** The proof report produced at the end of a run (success or blocked). */
export interface CloserProofReport {
  tenantId: Uuid;
  leadRef: string;
  finalState: CloserWorkflowState;
  compliancePassed: boolean;
  humanApproved: boolean;
  appointmentRef: string | null;
  crmExternalRef: string | null;
  /** Ordered states the run visited. */
  states: CloserWorkflowState[];
  /** Append-only proof events (built in-memory; persistence is the caller's job). */
  proofEvents: GtmProofEvent[];
  generatedAt: IsoTimestamp;
  summary: string;
}

/* --------------------------------------------------------------------- run */

/** Dependencies for a workflow run. Clock/id are injectable for determinism. */
export interface CloserWorkflowDeps {
  crm: MockCloserCrm;
  /** Human decision at the approval gate. Defaults to 'approve' for happy-path runs. */
  decision?: CloserHumanDecision;
  now?: () => Date;
  newId?: () => string;
}

/** The full result of running a lead through the workflow. */
export interface CloserWorkflowRun {
  finalState: CloserWorkflowState;
  /** Ordered states, starting at 'received'. */
  history: CloserWorkflowState[];
  /** Every transition attempt (all succeed on the runner's happy/blocked paths). */
  transitions: CloserStateTransition[];
  compliance: CloserComplianceDecision;
  appointment: CloserAppointment | null;
  crmRecord: CloserCrmRecord | null;
  /** False when the CRM writeback was an idempotent replay. */
  crmCreated: boolean;
  proofReport: CloserProofReport;
}
