import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { baseColumns } from './_shared';
import { callOutcome, syncDirection, vendorEventType, vendorName } from './enums';
import { prospectAccounts } from './prospect-accounts';
import { prospectContacts } from './prospect-contacts';
import { outreachDrafts } from './outreach-drafts';

/**
 * Every push to / webhook from a voice vendor. Powers the call-outcome
 * dashboard and prevents duplicate webhook processing via idempotencyKey.
 */
export const vendorSyncEvents = pgTable(
  'vendor_sync_events',
  {
    ...baseColumns,
    vendor: vendorName('vendor').notNull(),
    eventType: vendorEventType('event_type').notNull(),
    accountId: uuid('account_id').references(() => prospectAccounts.id, { onDelete: 'set null' }),
    contactId: uuid('contact_id').references(() => prospectContacts.id, { onDelete: 'set null' }),
    draftId: uuid('draft_id').references(() => outreachDrafts.id, { onDelete: 'set null' }),
    externalId: text('external_id'),
    direction: syncDirection('direction').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    signatureVerified: boolean('signature_verified').notNull().default(false),
    callOutcome: callOutcome('call_outcome'),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('vendor_sync_events_vendor_idx').on(t.vendor),
    index('vendor_sync_events_outcome_idx').on(t.callOutcome),
    index('vendor_sync_events_account_idx').on(t.accountId),
  ],
);

export type VendorSyncEvent = typeof vendorSyncEvents.$inferSelect;
export type NewVendorSyncEvent = typeof vendorSyncEvents.$inferInsert;
