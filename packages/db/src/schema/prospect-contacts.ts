import { boolean, index, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core';
import { baseColumns } from './_shared';
import { consentStatus } from './enums';
import { prospectAccounts } from './prospect-accounts';

/** People at an account. Deduped per account. */
export const prospectContacts = pgTable(
  'prospect_contacts',
  {
    ...baseColumns,
    accountId: uuid('account_id')
      .notNull()
      .references(() => prospectAccounts.id, { onDelete: 'cascade' }),
    fullName: text('full_name').notNull(),
    title: text('title'),
    seniority: text('seniority'),
    email: text('email'),
    emailStatus: text('email_status').notNull().default('unverified'),
    phone: text('phone'),
    linkedinUrl: text('linkedin_url'),
    isPrimary: boolean('is_primary').notNull().default(false),
    consentStatus: consentStatus('consent_status').notNull().default('unknown'),
    dedupeKey: text('dedupe_key').notNull(),
  },
  (t) => [
    index('prospect_contacts_account_idx').on(t.accountId),
    unique('prospect_contacts_account_dedupe_uq').on(t.accountId, t.dedupeKey),
  ],
);

export type ProspectContact = typeof prospectContacts.$inferSelect;
export type NewProspectContact = typeof prospectContacts.$inferInsert;
