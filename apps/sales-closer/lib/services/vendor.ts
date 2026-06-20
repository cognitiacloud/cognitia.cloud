import { eq } from 'drizzle-orm';
import { getVendorAdapter, type VendorName, type WebhookRequest } from '@cognitia/adapters';
import { logCompliance } from '@cognitia/core';
import {
  outreachDrafts,
  prospectContacts,
  vendorSyncEvents,
  type VendorSyncEvent,
} from '@cognitia/db';
import { db } from '../db';

/** Create a vendor lead from an approved draft. */
export async function createVendorLead(draftId: string, actor: string): Promise<VendorSyncEvent> {
  const [draft] = await db()
    .select()
    .from(outreachDrafts)
    .where(eq(outreachDrafts.id, draftId))
    .limit(1);
  if (!draft) throw new Error(`Draft ${draftId} not found`);
  if (draft.status !== 'approved') throw new Error('Draft must be approved before creating a lead');

  const [contact] = await db()
    .select()
    .from(prospectContacts)
    .where(eq(prospectContacts.id, draft.contactId))
    .limit(1);
  if (!contact) throw new Error('Contact not found');
  if (contact.consentStatus === 'opted_out' || contact.consentStatus === 'dnc') {
    throw new Error('Contact has opted out / is on the do-not-call list');
  }

  const adapter = getVendorAdapter();
  const lead = await adapter.createLead({
    accountId: draft.accountId,
    contactId: draft.contactId,
    fullName: contact.fullName,
    phone: contact.phone ?? undefined,
    email: contact.email ?? undefined,
    briefSummary: draft.body,
  });

  const [event] = await db()
    .insert(vendorSyncEvents)
    .values({
      vendor: adapter.name,
      eventType: 'lead_created',
      accountId: draft.accountId,
      contactId: draft.contactId,
      draftId: draft.id,
      externalId: lead.externalId,
      direction: 'outbound',
      payload: { status: lead.status },
      idempotencyKey: `lead-${adapter.name}-${lead.externalId}`,
    })
    .onConflictDoNothing({ target: vendorSyncEvents.idempotencyKey })
    .returning();

  await logCompliance(db(), {
    entityType: 'outreach_draft',
    entityId: draft.id,
    action: 'vendor_lead_created',
    actor,
    details: { vendor: adapter.name, externalId: lead.externalId },
  });

  if (!event) throw new Error('Lead event already recorded');
  return event;
}

/** Schedule a call for an existing vendor lead. */
export async function scheduleVendorCall(input: {
  leadExternalId: string;
  scheduledFor: Date;
  accountId?: string;
  contactId?: string;
  draftId?: string;
}): Promise<VendorSyncEvent> {
  const adapter = getVendorAdapter();
  const call = await adapter.scheduleCall({
    leadExternalId: input.leadExternalId,
    scheduledFor: input.scheduledFor,
  });

  const [event] = await db()
    .insert(vendorSyncEvents)
    .values({
      vendor: adapter.name,
      eventType: 'call_scheduled',
      accountId: input.accountId,
      contactId: input.contactId,
      draftId: input.draftId,
      externalId: call.externalId,
      direction: 'outbound',
      payload: { scheduledFor: input.scheduledFor.toISOString(), status: call.status },
      idempotencyKey: `call-${adapter.name}-${call.externalId}`,
    })
    .onConflictDoNothing({ target: vendorSyncEvents.idempotencyKey })
    .returning();

  if (!event) throw new Error('Call event already recorded');
  return event;
}

/**
 * Process an inbound vendor webhook. Idempotent on the event's idempotency key:
 * a duplicate delivery is a no-op. A DNC event flips the contact's consent.
 */
export async function handleVendorWebhook(
  vendor: VendorName,
  req: WebhookRequest,
): Promise<{ processed: boolean; duplicate: boolean }> {
  const adapter = getVendorAdapter(vendor);
  const verified = adapter.verifySignature(req);
  const event = await adapter.parseWebhook(req);

  const inserted = await db()
    .insert(vendorSyncEvents)
    .values({
      vendor: event.vendor,
      eventType: event.eventType,
      externalId: event.externalId,
      direction: 'inbound',
      payload: event.payload as Record<string, unknown>,
      signatureVerified: verified,
      callOutcome: event.outcome,
      idempotencyKey: event.idempotencyKey,
      occurredAt: event.occurredAt,
    })
    .onConflictDoNothing({ target: vendorSyncEvents.idempotencyKey })
    .returning({ id: vendorSyncEvents.id });

  if (inserted.length === 0) return { processed: false, duplicate: true };

  // A DNC request must immediately suppress the contact and be audited.
  if (event.eventType === 'dnc_requested' || event.outcome === 'dnc') {
    const externalContact = (event.payload as { contactId?: string }).contactId;
    if (externalContact) {
      await db()
        .update(prospectContacts)
        .set({ consentStatus: 'dnc', updatedAt: new Date() })
        .where(eq(prospectContacts.id, externalContact));
      await logCompliance(db(), {
        entityType: 'prospect_contact',
        entityId: externalContact,
        action: 'dnc_applied',
        actor: `vendor:${event.vendor}`,
        details: { externalId: event.externalId },
      });
    }
  }

  return { processed: true, duplicate: false };
}
