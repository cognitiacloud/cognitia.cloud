import { eq } from 'drizzle-orm';
import { getApifyClient } from '@cognitia/apify';
import { normalizeDataset } from '@cognitia/core';
import { scrapeRuns, type ScrapeRun } from '@cognitia/db';
import { db } from '../db';

/** Kick an Apify actor and record the run. */
export async function startScrapeRun(input: {
  source: string;
  actorInput: Record<string, unknown>;
  requestedBy: string;
}): Promise<ScrapeRun> {
  const apify = getApifyClient();
  const started = await apify.startActor(input.source, input.actorInput);

  const [run] = await db()
    .insert(scrapeRuns)
    .values({
      source: input.source,
      actorRunId: started.runId,
      apifyDatasetId: started.datasetId,
      input: input.actorInput,
      status: started.status === 'succeeded' ? 'succeeded' : 'running',
      requestedBy: input.requestedBy,
      startedAt: new Date(),
    })
    .returning();
  if (!run) throw new Error('Failed to record scrape run');
  return run;
}

/** Import a finished run's dataset and normalize it into accounts/contacts. */
export async function importScrapeRun(runId: string) {
  const [run] = await db().select().from(scrapeRuns).where(eq(scrapeRuns.id, runId)).limit(1);
  if (!run) throw new Error(`Scrape run ${runId} not found`);
  if (!run.apifyDatasetId) throw new Error('Scrape run has no dataset to import');

  const apify = getApifyClient();
  const items = await apify.fetchDataset(run.apifyDatasetId);
  const result = await normalizeDataset(db(), run.id, items);

  await db()
    .update(scrapeRuns)
    .set({
      status: 'succeeded',
      finishedAt: new Date(),
      stats: {
        items: items.length,
        accountsCreated: result.accountsCreated,
        accountsMatched: result.accountsMatched,
        contactsUpserted: result.contactsUpserted,
      },
      updatedAt: new Date(),
    })
    .where(eq(scrapeRuns.id, run.id));

  return { runId: run.id, items: items.length, ...result };
}
