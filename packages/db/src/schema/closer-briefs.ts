import { index, integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { baseColumns } from './_shared';
import { outreachChannel } from './enums';
import { prospectAccounts } from './prospect-accounts';
import { closerScores } from './closer-scores';

/** Generated sales playbook per account. */
export const closerBriefs = pgTable(
  'closer_briefs',
  {
    ...baseColumns,
    accountId: uuid('account_id')
      .notNull()
      .references(() => prospectAccounts.id, { onDelete: 'cascade' }),
    scoreId: uuid('score_id').references(() => closerScores.id, { onDelete: 'set null' }),
    version: integer('version').notNull().default(1),
    summary: text('summary').notNull(),
    painPoints: jsonb('pain_points').$type<string[]>().notNull().default([]),
    valueProps: jsonb('value_props').$type<string[]>().notNull().default([]),
    talkTrack: jsonb('talk_track').$type<string[]>().notNull().default([]),
    objections: jsonb('objections').$type<{ objection: string; response: string }[]>()
      .notNull()
      .default([]),
    recommendedChannel: outreachChannel('recommended_channel').notNull().default('voice'),
    model: text('model').notNull(),
    promptVersion: text('prompt_version').notNull(),
    status: text('status').notNull().default('active'),
  },
  (t) => [index('closer_briefs_account_idx').on(t.accountId)],
);

export type CloserBrief = typeof closerBriefs.$inferSelect;
export type NewCloserBrief = typeof closerBriefs.$inferInsert;
