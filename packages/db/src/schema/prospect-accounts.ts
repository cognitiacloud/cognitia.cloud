import { index, jsonb, pgTable, text } from 'drizzle-orm/pg-core';
import { baseColumns } from './_shared';

/** The company. Root entity; deduped on normalized domain. */
export const prospectAccounts = pgTable(
  'prospect_accounts',
  {
    ...baseColumns,
    domain: text('domain').notNull().unique(),
    legalName: text('legal_name'),
    displayName: text('display_name').notNull(),
    industry: text('industry'),
    employeeRange: text('employee_range'),
    country: text('country'),
    region: text('region'),
    hqCity: text('hq_city'),
    linkedinUrl: text('linkedin_url'),
    enrichment: jsonb('enrichment').$type<Record<string, unknown>>().notNull().default({}),
    status: text('status').notNull().default('active'),
    dedupeKey: text('dedupe_key').notNull().unique(),
  },
  (t) => [index('prospect_accounts_status_idx').on(t.status)],
);

export type ProspectAccount = typeof prospectAccounts.$inferSelect;
export type NewProspectAccount = typeof prospectAccounts.$inferInsert;
