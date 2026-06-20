import { index, jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { baseColumns } from './_shared';
import { prospectAccounts } from './prospect-accounts';

/** LLM/heuristic fit score. History kept; latest by scoredAt. */
export const closerScores = pgTable(
  'closer_scores',
  {
    ...baseColumns,
    accountId: uuid('account_id')
      .notNull()
      .references(() => prospectAccounts.id, { onDelete: 'cascade' }),
    model: text('model').notNull(),
    promptVersion: text('prompt_version').notNull(),
    score: numeric('score', { precision: 5, scale: 2 }).notNull(),
    tier: text('tier').notNull(),
    rationale: text('rationale'),
    breakdown: jsonb('breakdown').$type<Record<string, number>>().notNull().default({}),
    signalsHash: text('signals_hash').notNull(),
    scoredAt: timestamp('scored_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('closer_scores_account_idx').on(t.accountId),
    index('closer_scores_signals_hash_idx').on(t.accountId, t.signalsHash),
  ],
);

export type CloserScore = typeof closerScores.$inferSelect;
export type NewCloserScore = typeof closerScores.$inferInsert;
