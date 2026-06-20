import { logCompliance } from '@cognitia/core';
import { requireAdmin } from '@/lib/auth';
import { ok, route } from '@/lib/api';
import { db } from '@/lib/db';
import { importScrapeRun } from '@/lib/services/scrape';

// Route 2 — import an Apify dataset for a finished run.
export const POST = route(async (req, { params }) => {
  const ctx = requireAdmin(req);
  const result = await importScrapeRun(params.id);
  await logCompliance(db(), {
    entityType: 'scrape_run',
    entityId: params.id,
    action: 'dataset_imported',
    actor: ctx.actor,
    details: result,
    ip: ctx.ip,
  });
  return ok(result);
});
