import { z } from 'zod';
import { logCompliance } from '@cognitia/core';
import { requireAdmin } from '@/lib/auth';
import { ok, route } from '@/lib/api';
import { db } from '@/lib/db';
import { startScrapeRun } from '@/lib/services/scrape';

const Body = z.object({
  source: z.string().min(1).default('apify/google-maps-scraper'),
  input: z.record(z.unknown()).default({}),
});

// Route 1 — start a scrape run (kick an Apify actor).
export const POST = route(async (req) => {
  const ctx = requireAdmin(req);
  const { source, input } = Body.parse(await req.json().catch(() => ({})));
  const run = await startScrapeRun({ source, actorInput: input, requestedBy: ctx.actor });
  await logCompliance(db(), {
    entityType: 'scrape_run',
    entityId: run.id,
    action: 'scrape_started',
    actor: ctx.actor,
    details: { source },
    ip: ctx.ip,
  });
  return ok(run, 201);
});
