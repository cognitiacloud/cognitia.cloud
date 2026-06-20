import { index, jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { baseColumns } from './_shared';
import { signalType } from './enums';
import { prospectAccounts } from './prospect-accounts';
import { prospectContacts } from './prospect-contacts';
import { scrapeRuns } from './scrape-runs';

/** Atomic enrichment facts feeding the score. */
export const prospectSignals = pgTable(
  'prospect_signals',
  {
    ...baseColumns,
    accountId: uuid('account_id')
      .notNull()
      .references(() => prospectAccounts.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id').references(() => prospectContacts.id, { onDelete: 'cascade' }),
    scrapeRunId: uuid('scrape_run_id').references(() => scrapeRuns.id, { onDelete: 'set null' }),
    type: signalType('type').notNull(),
    value: jsonb('value').$type<Record<string, unknown>>().notNull().default({}),
    weight: numeric('weight', { precision: 6, scale: 2 }).notNull().default('1'),
    source: text('source'),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('prospect_signals_account_idx').on(t.accountId),
    index('prospect_signals_type_idx').on(t.type),
  ],
);

export type ProspectSignal = typeof prospectSignals.$inferSelect;
export type NewProspectSignal = typeof prospectSignals.$inferInsert;
