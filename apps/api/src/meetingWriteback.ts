import { createHash } from 'node:crypto';
import type { ProposeInput } from '@cognitia/agents';
import type { AgentActionRow } from '@cognitia/db';

/**
 * Meeting-notes writeback routing — platform-side consumer of the meeting skill.
 *
 * The meeting skill (`hermes/skills/meeting-skill`) produces a human-reviewed CRM
 * writeback preview and emits a `writeback.approved` SyncEvent; by contract it
 * `no_autonomous_crm_write` — it never writes to HubSpot itself. This module is
 * the platform-side CONSUMER of that event: it translates an approved meeting
 * writeback into the EXISTING governed `crm.note.create` action, so a meeting
 * note flows through the same HubSpot adapter, approval gate, audit trail, and
 * idempotency as every other CRM write. No second write path, no new action
 * type, no new adapter, no migration — and therefore no duplicate engagements.
 *
 * Trust posture preserved (does not weaken any control):
 *   - PII discipline: the raw meeting summary is NOT inlined into the CRM write.
 *     The note body is the deterministic governance template (see
 *     `packages/integrations/src/hubspot/writePlan.ts` `engagementContent`); the
 *     summary stays out-of-band (`payload_ref`) and the meeting is cited only as
 *     grounding evidence — the same rule the platform already enforces for drafts.
 *   - Approval gate: this only PROPOSES. The operator still approves before the
 *     ledger executes the HubSpot write — no side effect without human approval.
 *   - Idempotency / no duplicates: the content fingerprint is keyed on the
 *     meeting id, so one meeting maps to exactly one CRM note. Re-delivery of the
 *     same approved writeback returns the prior proposed action (ledger replay)
 *     and never creates a second engagement.
 */

/** The SyncEvent kind the meeting skill emits once its own human review passes. */
export const MEETING_WRITEBACK_APPROVED_KIND = 'writeback.approved';

/**
 * Platform-side contract for an approved meeting writeback — a typed slice of the
 * meeting skill's SyncEvent payload (its `CrmWritebackPreview`). Refs + the
 * out-of-band summary only; never raw transcript content.
 */
export interface MeetingWritebackEnvelope {
  /** Must be `writeback.approved`; any other kind is refused (fail-closed). */
  kind: string;
  meeting_id: string;
  contact_id: string;
  /** Human-readable meeting summary. Held out-of-band; never written raw to CRM. */
  summary: string;
  /** When the meeting occurred (ISO-8601), carried for traceability. */
  occurred_at: string;
  /** The meeting skill's own review verdict; when present must be `approved`. */
  review_status?: string;
}

export interface MeetingWritebackContext {
  tenantId: string;
  traceId: string;
  /** Proposing agent identity; defaults to `meeting`. */
  agent?: string;
}

export class MeetingWritebackError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MeetingWritebackError';
  }
}

/** Opaque skill ids (mtg_*, contact ids): non-empty, bounded, safe charset. */
const SAFE_ID_RE = /^[A-Za-z0-9:_-]{1,128}$/;

/**
 * Stable fingerprint for one meeting's note — keyed on the meeting id alone, so
 * one meeting maps to exactly one CRM note no matter how often the approved
 * writeback is re-delivered.
 */
export function meetingNoteFingerprint(meetingId: string): string {
  return 'meeting-note:v1:' + createHash('sha256').update(meetingId).digest('hex').slice(0, 32);
}

/**
 * Pure mapping: an approved meeting writeback → the EXISTING `crm.note.create`
 * `ProposeInput`. Throws `MeetingWritebackError` on a non-approved or malformed
 * envelope so a CRM write is never proposed for an unreviewed/rejected meeting.
 */
export function meetingWritebackToNoteProposal(
  env: MeetingWritebackEnvelope,
  ctx: MeetingWritebackContext,
): ProposeInput {
  if (env.kind !== MEETING_WRITEBACK_APPROVED_KIND) {
    throw new MeetingWritebackError(
      `refusing a meeting writeback that is not '${MEETING_WRITEBACK_APPROVED_KIND}' (kind=${env.kind})`,
    );
  }
  if (env.review_status !== undefined && env.review_status !== 'approved') {
    throw new MeetingWritebackError(
      `refusing a meeting writeback whose review_status is not 'approved' (got '${env.review_status}')`,
    );
  }
  if (!SAFE_ID_RE.test(env.meeting_id)) {
    throw new MeetingWritebackError('invalid meeting_id');
  }
  if (!SAFE_ID_RE.test(env.contact_id)) {
    throw new MeetingWritebackError('invalid contact_id');
  }

  return {
    tenantId: ctx.tenantId,
    agentRunId: `meeting:${env.meeting_id}`,
    agent: ctx.agent ?? 'meeting',
    traceId: ctx.traceId,
    actionType: 'crm.note.create',
    riskLevel: 'low',
    targetRef: `contact:${env.contact_id}`,
    // Grounds the note in the meeting; no raw transcript/summary text travels here.
    evidenceRefs: [`meeting:${env.meeting_id}`],
    // Keyed on the meeting → ledger replay yields ONE note per meeting (no dup).
    contentFingerprint: meetingNoteFingerprint(env.meeting_id),
    // Out-of-band ref to the summary; the raw text is never inlined into the action.
    payloadRef: `meeting-summary:${env.meeting_id}`,
    guardrailResults: [],
  };
}

/** The single capability this router needs from the ledger. */
export interface ProposeCapableLedger {
  propose(input: ProposeInput): Promise<AgentActionRow>;
}

/**
 * Route an approved meeting writeback into the governed CRM-note lifecycle by
 * PROPOSING a `crm.note.create` action. Idempotent: re-delivery of the same
 * meeting returns the prior proposed action (the ledger dedups on the
 * meeting-keyed idempotency key) — no duplicate engagement is ever created. The
 * operator still approves before the HubSpot write executes.
 */
export async function ingestMeetingWriteback(
  ledger: ProposeCapableLedger,
  env: MeetingWritebackEnvelope,
  ctx: MeetingWritebackContext,
): Promise<AgentActionRow> {
  return ledger.propose(meetingWritebackToNoteProposal(env, ctx));
}
