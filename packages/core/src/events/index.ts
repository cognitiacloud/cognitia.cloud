import { z } from 'zod';
import { eventEnvelope, type EventEnvelope } from '../schemas/event.js';

/**
 * Event registry. Maps a known `event_name` to a Zod schema for its `payload`.
 * Unknown event names are rejected at the boundary (see validateEvent).
 *
 * Payloads carry refs/hashes, never raw PII. Keep these schemas minimal and
 * additive; bump to vN+1 rather than mutating an existing version's shape.
 */
const ref = z.string().min(1);

export const EVENT_PAYLOADS = {
  // --- internal: agent ---
  'agent.run.created.v1': z.object({ agent: z.string(), objective: z.string() }),
  'agent.run.completed.v1': z.object({ action_count: z.number().int().nonnegative() }),
  'agent.run.failed.v1': z.object({ reason: z.string() }),
  'agent.action.proposed.v1': z.object({
    action_type: z.string(),
    risk_level: z.string(),
    evidence_refs: z.array(z.string()),
  }),
  'agent.action.approved.v1': z.object({ approver_ref: ref }),
  'agent.action.rejected.v1': z.object({ approver_ref: ref, reason: z.string().optional() }),
  'agent.action.executed.v1': z.object({ idempotency_key: z.string() }),
  'agent.action.failed.v1': z.object({ reason: z.string() }),
  // GOV-1: a refused execution (e.g. not approved) is itself an auditable fact.
  'agent.action.execution_denied.v1': z.object({ reason: z.string() }),
  // UNDO-1: an executed CRM write explicitly undone, with the structured why.
  'agent.action.rolled_back.v1': z.object({ external_ref: ref, reason_code: z.string() }),
  'agent.recommendation.created.v1': z.object({ kind: z.string() }),
  'agent.feedback.recorded.v1': z.object({ kind: z.string() }),
  // --- internal: outbound / signal / eval ---
  'outbound.sequence.drafted.v1': z.object({ step_count: z.number().int().nonnegative() }),
  'outbound.touchpoint.scheduled.v1': z.object({ touchpoint_ref: ref }),
  'signal.detected.v1': z.object({ signal_type: z.string() }),
  'eval.run.completed.v1': z.object({ items: z.number().int().nonnegative() }),
  // OBS-1: worker liveness — emitted after each job cycle so the ops overview
  // can prove the background worker is alive (staleness = outage signal).
  'worker.heartbeat.recorded.v1': z.object({ worker: z.string(), job: z.string() }),
  // --- external (normalized after validation) ---
  'crm.account.created.v1': z.object({ external_id: z.string() }),
  'crm.account.updated.v1': z.object({ external_id: z.string() }),
  'crm.contact.created.v1': z.object({ external_id: z.string() }),
  'crm.contact.updated.v1': z.object({ external_id: z.string() }),
  'crm.opportunity.created.v1': z.object({ external_id: z.string() }),
  'crm.opportunity.updated.v1': z.object({ external_id: z.string() }),
  'inbound.lead.received.v1': z.object({ source: z.string() }),
  'outbound.email.delivered.v1': z.object({ touchpoint_ref: ref }),
  'outbound.email.opened.v1': z.object({ touchpoint_ref: ref }),
  'outbound.email.replied.v1': z.object({
    touchpoint_ref: ref,
    reply_class: z.string().optional(),
  }),
  'outbound.email.bounced.v1': z.object({ touchpoint_ref: ref }),
  'calendar.meeting.booked.v1': z.object({ meeting_ref: ref }),
} as const;

export type KnownEventName = keyof typeof EVENT_PAYLOADS;

export const KNOWN_EVENT_NAMES = Object.keys(EVENT_PAYLOADS) as KnownEventName[];

export function isKnownEventName(name: string): name is KnownEventName {
  return name in EVENT_PAYLOADS;
}

/**
 * Validate a full event: envelope shape + registered payload schema. Throws a
 * ZodError on envelope failure; returns a discriminated result for clarity.
 */
export function validateEvent(
  input: unknown,
): { ok: true; event: EventEnvelope } | { ok: false; error: string } {
  const envelope = eventEnvelope.safeParse(input);
  if (!envelope.success) {
    return { ok: false, error: envelope.error.message };
  }
  const { event_name, payload } = envelope.data;
  if (!isKnownEventName(event_name)) {
    return { ok: false, error: `unknown event_name: ${event_name}` };
  }
  const payloadResult = EVENT_PAYLOADS[event_name].safeParse(payload);
  if (!payloadResult.success) {
    return {
      ok: false,
      error: `payload invalid for ${event_name}: ${payloadResult.error.message}`,
    };
  }
  return { ok: true, event: envelope.data };
}

/** Inputs needed to mint an event; id/ingested_at are filled if omitted. */
export interface MakeEventInput {
  id?: string;
  tenant_id: string;
  event_name: KnownEventName;
  entity_type: string;
  entity_id: string;
  source: string;
  occurred_at?: string;
  ingested_at?: string;
  payload: Record<string, unknown>;
  trace_id: string;
}

/**
 * Construct a validated event. Deterministic id/time can be injected for tests;
 * otherwise generated. Throws if the resulting event is invalid.
 */
export function makeEvent(
  input: MakeEventInput,
  now: () => Date = () => new Date(),
  newId: () => string = () => crypto.randomUUID(),
): EventEnvelope {
  const nowIso = now().toISOString();
  const candidate = {
    id: input.id ?? newId(),
    tenant_id: input.tenant_id,
    event_name: input.event_name,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    source: input.source,
    occurred_at: input.occurred_at ?? nowIso,
    ingested_at: input.ingested_at ?? nowIso,
    payload: input.payload,
    trace_id: input.trace_id,
  };
  const result = validateEvent(candidate);
  if (!result.ok) {
    throw new Error(`makeEvent: invalid event — ${result.error}`);
  }
  return result.event;
}
