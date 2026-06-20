import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { baseColumns } from './_shared';
import { draftStatus, outreachChannel } from './enums';
import { prospectAccounts } from './prospect-accounts';
import { prospectContacts } from './prospect-contacts';
import { closerBriefs } from './closer-briefs';

/** The message awaiting human approval before a vendor lead is created. */
export const outreachDrafts = pgTable(
  'outreach_drafts',
  {
    ...baseColumns,
    accountId: uuid('account_id')
      .notNull()
      .references(() => prospectAccounts.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id')
      .notNull()
      .references(() => prospectContacts.id, { onDelete: 'cascade' }),
    briefId: uuid('brief_id').references(() => closerBriefs.id, { onDelete: 'set null' }),
    channel: outreachChannel('channel').notNull().default('voice'),
    subject: text('subject'),
    body: text('body').notNull(),
    status: draftStatus('status').notNull().default('pending_approval'),
    reviewerId: text('reviewer_id'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewNotes: text('review_notes'),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
  },
  (t) => [
    index('outreach_drafts_status_idx').on(t.status),
    index('outreach_drafts_account_idx').on(t.accountId),
  ],
);

export type OutreachDraft = typeof outreachDrafts.$inferSelect;
export type NewOutreachDraft = typeof outreachDrafts.$inferInsert;
