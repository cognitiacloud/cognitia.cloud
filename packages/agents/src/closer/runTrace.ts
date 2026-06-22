import type { GtmProofEvent, GtmProspect, IsoTimestamp, Uuid } from '@cognitia/core';
import type {
  SalesCloserState,
  TransitionVia,
  WorkflowRun,
  WorkflowStatus,
  WorkflowTransition,
} from './salesCloserWorkflow.js';

/**
 * Developer-facing run trace + structured result summary for the Sales Closer
 * workflow (mock spine).
 *
 * This is a PURE DERIVATION over a {@link WorkflowRun}: given the canonical run
 * record produced by `SalesCloserWorkflow.run`, it builds a flat, JSON-safe,
 * PII-redacted timeline for demos and reports. It adds NO behavior — it never
 * runs the workflow, calls a port, or mutates the run. Importing this module
 * cannot change how a run executes.
 *
 * Each trace line lines up, for one transition: the state entered, the event
 * (which boundary drove it), the timestamp, the policy decision, the approval
 * state, the mock writeback result, and the proof receipt id.
 *
 * Scope: in-memory/mock only. No DB, no external logging, no vendor monitoring.
 */

/* ----------------------------------------------------------------- proof lane */

/**
 * The Sales Closer proof lane EXISTS today as `ProofPort.record(GtmProofEvent)`
 * (see ports.ts). However, `ProofRecordResult` returns no separate, boundary-
 * minted receipt handle — so the only durable proof identifier available is the
 * proof event's own id, `GtmProofEvent.id`. The trace therefore maps each
 * relevant line to that event id.
 *
 * `PROOF_RECEIPT_HANDLE_STATUS` records that a *formal* receipt handle from the
 * proof boundary is not yet implemented. When the boundary begins minting one,
 * it is wired in at the single seam {@link proofReceiptIdForTransition} and this
 * flips to `'active'`; until then `RunTraceLine.proofReceiptId` is the
 * event-backed proof handle (a `GtmProofEvent.id`), not a separate receipt.
 */
export const PROOF_RECEIPT_HANDLE_STATUS = 'pending' as const;
export type ProofReceiptHandleStatus = typeof PROOF_RECEIPT_HANDLE_STATUS;

/** Whether the trace could map lines to proof events at all (the lane exists). */
export type ProofLaneStatus = 'active' | 'absent';

/**
 * Which proof event kind each workflow phase produces, per
 * `SalesCloserWorkflow.run`. Used to attach the right `GtmProofEvent.id` to the
 * line for that phase.
 */
const PROOF_KIND_BY_VIA: Partial<Record<TransitionVia, GtmProofEvent['kind']>> = {
  appointment: 'gtm.discovery.booked.v1',
  crm: 'gtm.proposal.generated.v1',
};

/**
 * Resolve the proof handle for a transition. Today this returns the
 * `GtmProofEvent.id` of the proof produced during that phase (an event-backed
 * proof handle), or `null` if no proof was produced. This is the single seam
 * where a future boundary-minted receipt handle would be substituted; see
 * {@link PROOF_RECEIPT_HANDLE_STATUS}.
 */
export function proofReceiptIdForTransition(
  via: TransitionVia,
  proofs: readonly GtmProofEvent[],
): string | null {
  const kind = PROOF_KIND_BY_VIA[via];
  if (!kind) return null;
  const event = proofs.find((p) => p.kind === kind);
  return event ? event.id : null;
}

/* --------------------------------------------------------------------- model */

/**
 * Policy outcome surfaced for a line (derived from the compliance boundary).
 * Named `TracePolicyDecision` to avoid colliding with the policy engine's
 * `PolicyDecision` interface (`policies/policyGate.ts`) at the package barrel.
 */
export type TracePolicyDecision = 'allow' | 'block' | 'not_applicable';

/** Human-approval state surfaced for a line (derived from the approval boundary). */
export type ApprovalState = 'approved' | 'rejected' | 'pending' | 'not_required' | 'not_applicable';

/** Mock CRM writeback outcome surfaced for a line. */
export type WritebackOutcome = 'ok' | 'failed' | 'skipped';

/** Terminal disposition of a run, derived from {@link WorkflowStatus}. */
export type RunOutcome = WorkflowStatus;

/**
 * The PII-safe projection of the prospect that the trace is allowed to surface.
 *
 * Whitelist only. The normalized {@link GtmProspect} already drops raw
 * email/phone, but it still carries `contactName`, masked email/phone,
 * `contactDomain`, and free-text `notes` — none of which appear here. Building
 * by allow-list (not deny-list) means a new sensitive field on `GtmProspect`
 * can never silently leak into a trace.
 */
export interface RedactedSubject {
  id: Uuid;
  companyName: string;
  region: string | null;
  businessType: string | null;
  source: string;
  sourceRisk: GtmProspect['sourceRisk'];
  consentStatus: GtmProspect['consentStatus'];
}

/** One line of the run timeline — one {@link WorkflowTransition}, enriched. */
export interface RunTraceLine {
  /** 0-based position in the timeline. */
  seq: number;
  /** The state entered by this transition (`WorkflowTransition.to`). */
  state: SalesCloserState;
  /** Which boundary drove the transition (`WorkflowTransition.via`). */
  event: TransitionVia;
  /** When the transition occurred (`WorkflowTransition.at`). */
  timestamp: IsoTimestamp;
  policyDecision: TracePolicyDecision;
  approvalState: ApprovalState;
  /** Mock writeback result; only meaningful on the CRM line, else `null`. */
  writeback: WritebackOutcome | null;
  /**
   * Event-backed proof handle (a `GtmProofEvent.id`) for the proof produced at
   * this phase, or `null`. NOT a separate boundary-minted receipt — see
   * {@link PROOF_RECEIPT_HANDLE_STATUS}.
   */
  proofReceiptId: string | null;
  /** Redacted free-text note carried by the transition. */
  detail?: string;
}

/** The full structured summary of a run, JSON-safe for demo/report export. */
export interface RunTraceSummary {
  runId: Uuid;
  subject: RedactedSubject;
  status: WorkflowStatus;
  finalState: SalesCloserState;
  outcome: RunOutcome;
  /** Redacted reason a blocked run halted, when present. */
  blockedReason?: string;
  startedAt: IsoTimestamp | null;
  finishedAt: IsoTimestamp | null;
  lineCount: number;
  /** Every event-backed proof handle referenced by the timeline, in order. */
  proofReceiptIds: string[];
  /** Whether the proof lane was available to map (it is, today). */
  proofLaneStatus: ProofLaneStatus;
  /**
   * Whether a formal boundary-minted receipt handle is wired in. `'pending'`
   * today: `proofReceiptId`s are event-backed (`GtmProofEvent.id`).
   */
  proofReceiptHandleStatus: ProofReceiptHandleStatus;
  /** Count of redactions applied (suppressed sensitive fields + masked text). */
  redactionCount: number;
  lines: RunTraceLine[];
}

/* ----------------------------------------------------------------- redaction */

const EMAIL_RE = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
// 7+ digits, optionally separated by spaces, dashes, dots, parens, or +.
const PHONE_RE = /\+?[\d][\d\s().-]{6,}\d/g;
const REDACTION_PLACEHOLDER = '[redacted]';

interface RedactionCounter {
  count: number;
}

/**
 * Mask any email or phone-like substring in free text. Pure; reports how many
 * substitutions it made via the shared counter so the summary can prove that
 * redaction ran.
 */
function redactText(value: string, counter: RedactionCounter): string {
  let masked = value.replace(EMAIL_RE, () => {
    counter.count += 1;
    return REDACTION_PLACEHOLDER;
  });
  masked = masked.replace(PHONE_RE, (match) => {
    // Require at least 7 actual digits to count as a phone number.
    const digits = match.replace(/\D/g, '');
    if (digits.length < 7) return match;
    counter.count += 1;
    return REDACTION_PLACEHOLDER;
  });
  return masked;
}

function redactOptional(value: string | undefined, counter: RedactionCounter): string | undefined {
  return value == null ? value : redactText(value, counter);
}

/** Join the business-location fields into a single safe region string. */
function buildRegion(prospect: GtmProspect): string | null {
  const parts = [prospect.city, prospect.provinceOrState, prospect.country].filter(
    (p): p is string => typeof p === 'string' && p.length > 0,
  );
  return parts.length ? parts.join(', ') : null;
}

/** Sensitive fields that exist on the prospect but must never reach the trace. */
const SUPPRESSED_FIELDS: ReadonlyArray<keyof GtmProspect> = [
  'contactName',
  'contactEmailHash',
  'contactPhoneHash',
  'contactEmailMasked',
  'contactPhoneMasked',
  'contactDomain',
  'notes',
];

/**
 * Project a normalized prospect down to its PII-safe whitelist, counting each
 * present (non-null) sensitive field that was suppressed.
 */
function toRedactedSubject(prospect: GtmProspect, counter: RedactionCounter): RedactedSubject {
  for (const field of SUPPRESSED_FIELDS) {
    if (prospect[field] != null) counter.count += 1;
  }
  return {
    id: prospect.id,
    companyName: prospect.companyName,
    region: buildRegion(prospect),
    businessType: prospect.businessType,
    source: prospect.source,
    sourceRisk: prospect.sourceRisk,
    consentStatus: prospect.consentStatus,
  };
}

/* -------------------------------------------------------------- line builders */

function policyDecisionFor(transition: WorkflowTransition): TracePolicyDecision {
  if (transition.via !== 'compliance') return 'not_applicable';
  return transition.to === 'blocked_compliance' ? 'block' : 'allow';
}

function approvalStateFor(transition: WorkflowTransition): ApprovalState {
  if (transition.via !== 'approval') return 'not_applicable';
  switch (transition.to) {
    case 'appointment_requested':
      return 'approved';
    case 'blocked_approval':
      return 'rejected';
    case 'human_approval_required':
      return 'pending';
    default:
      return 'not_applicable';
  }
}

function writebackFor(transition: WorkflowTransition): WritebackOutcome | null {
  if (transition.via !== 'crm') return null;
  if (transition.to === 'proof_report_requested') return 'ok';
  if (transition.to === 'blocked_crm') return 'failed';
  return 'skipped';
}

/* ----------------------------------------------------------------- assembly */

/**
 * Build the developer-facing run trace from a {@link WorkflowRun}. Pure: no IO,
 * no mutation of `run`. The result is JSON-safe (only strings, numbers, null,
 * plain objects, and arrays) and carries no raw PII.
 */
export function buildRunTrace(run: WorkflowRun): RunTraceSummary {
  const counter: RedactionCounter = { count: 0 };
  const subject = toRedactedSubject(run.prospect, counter);

  const lines: RunTraceLine[] = run.transitions.map((transition, seq) => {
    const proofReceiptId = proofReceiptIdForTransition(transition.via, run.proofs);
    const detail = redactOptional(transition.detail, counter);
    const line: RunTraceLine = {
      seq,
      state: transition.to,
      event: transition.via,
      timestamp: transition.at,
      policyDecision: policyDecisionFor(transition),
      approvalState: approvalStateFor(transition),
      writeback: writebackFor(transition),
      proofReceiptId,
    };
    if (detail !== undefined) line.detail = detail;
    return line;
  });

  const proofReceiptIds = lines
    .map((line) => line.proofReceiptId)
    .filter((id): id is string => id !== null);

  const summary: RunTraceSummary = {
    runId: run.prospect.id,
    subject,
    status: run.status,
    finalState: run.state,
    outcome: run.status,
    startedAt: lines.length ? lines[0]!.timestamp : null,
    finishedAt: lines.length ? lines[lines.length - 1]!.timestamp : null,
    lineCount: lines.length,
    proofReceiptIds,
    proofLaneStatus: 'active',
    proofReceiptHandleStatus: PROOF_RECEIPT_HANDLE_STATUS,
    redactionCount: counter.count,
    lines,
  };

  const blockedReason = redactOptional(run.blockedReason, counter);
  if (blockedReason !== undefined) summary.blockedReason = blockedReason;
  // redactionCount is read after all redaction passes (subject, details, reason).
  summary.redactionCount = counter.count;

  return summary;
}

/** Alias making the JSON-safe export intent explicit at call sites. */
export const traceToJson = buildRunTrace;

/**
 * Serialize a run trace to a JSON string for demo/report output. `space`
 * defaults to 2-space pretty-printing.
 */
export function traceToJsonString(run: WorkflowRun, space: number = 2): string {
  return JSON.stringify(buildRunTrace(run), null, space);
}
