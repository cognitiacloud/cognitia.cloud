import { index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { baseColumns } from './_shared';
import { scrapeRunStatus } from './enums';

/** One Apify execution. Audit of what was pulled. */
export const scrapeRuns = pgTable(
  'scrape_runs',
  {
    ...baseColumns,
    source: text('source').notNull(),
    actorRunId: text('actor_run_id'),
    apifyDatasetId: text('apify_dataset_id'),
    input: jsonb('input').$type<Record<string, unknown>>().notNull().default({}),
    status: scrapeRunStatus('status').notNull().default('queued'),
    requestedBy: text('requested_by'),
    stats: jsonb('stats').$type<Record<string, number>>().notNull().default({}),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    error: text('error'),
  },
  (t) => [index('scrape_runs_status_idx').on(t.status)],
);

export type ScrapeRun = typeof scrapeRuns.$inferSelect;
export type NewScrapeRun = typeof scrapeRuns.$inferInsert;
