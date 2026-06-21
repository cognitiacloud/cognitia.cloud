import { z } from 'zod';
import { uuid, isoTimestamp } from './common.js';

/**
 * Client Zero appointment request model (mock writeback leg).
 *
 * The Client Zero / Auto Growth OS CRM-lite spec defines an "Appointment"
 * pipeline stage (New → Engaged → Qualified → Appointment → Visit → …) plus
 * no-show recovery, but provisions nothing live. This schema is the typed,
 * PII-light contract an appointment booking takes when it is routed into the
 * governed `crm.note.create` writeback path.
 *
 * PII doctrine: invitee_name / invitee_email are accepted at the edge because a
 * booking provider supplies them, but they NEVER enter the CRM note body, the
 * action payload_ref, or a proof's public surface — only refs/ids cross those
 * boundaries (mirrors the agent-action `payload_ref` rule in schemas/agent.ts).
 */

/** Where the booking originated. */
export const appointmentProvider = z.enum(['calendly', 'google', 'manual']);
export type AppointmentProvider = z.infer<typeof appointmentProvider>;

/** Booking lifecycle, incl. the no-show state the CRM-lite spec recovers from. */
export const appointmentStatus = z.enum(['requested', 'confirmed', 'no_show', 'cancelled']);
export type AppointmentStatus = z.infer<typeof appointmentStatus>;

/**
 * A single appointment writeback request. `appointment_id` is the stable
 * identity (proof subject + idempotency anchor); `contact_id` is the CRM
 * contact the note is attached to (→ target_ref "contact:<uuid>").
 */
export const appointmentRequest = z
  .object({
    tenant_id: uuid,
    appointment_id: uuid,
    contact_id: uuid,
    provider: appointmentProvider,
    /** Human-readable booking type, e.g. "Test Drive". No PII. */
    event_type: z.string().min(1),
    scheduled_start: isoTimestamp,
    scheduled_end: isoTimestamp.optional(),
    status: appointmentStatus.default('requested'),
    // PII-bearing — accepted but never surfaced downstream (see doctrine above).
    invitee_name: z.string().optional(),
    invitee_email: z.string().email().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.scheduled_end && value.scheduled_end < value.scheduled_start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scheduled_end'],
        message: 'scheduled_end cannot be before scheduled_start',
      });
    }
  });
export type AppointmentRequest = z.infer<typeof appointmentRequest>;
