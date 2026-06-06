import { z } from 'zod';
import { uuid, isoTimestamp } from './common.js';

/** Event name: `domain.entity.action.vN`. */
export const eventName = z
  .string()
  .regex(
    /^[a-z]+\.[a-z_]+\.[a-z_]+\.v\d+$/,
    'event_name must be domain.entity.action.vN (lowercase, e.g. agent.action.proposed.v1)',
  );

/**
 * The envelope every event shares. `payload` is validated separately against
 * the schema registered for the specific `event_name` (see events/registry).
 *
 * PII rule: payloads carry references and hashes, never raw PII. Enforced by
 * convention + the redaction helper; per-event payload schemas should not
 * declare raw-PII fields.
 */
export const eventEnvelope = z.object({
  id: uuid,
  tenant_id: uuid,
  event_name: eventName,
  entity_type: z.string().min(1),
  entity_id: uuid,
  source: z.string().min(1),
  occurred_at: isoTimestamp,
  ingested_at: isoTimestamp,
  payload: z.record(z.unknown()),
  trace_id: z.string().min(1),
});

export type EventEnvelope = z.infer<typeof eventEnvelope>;
export type EventName = z.infer<typeof eventName>;
