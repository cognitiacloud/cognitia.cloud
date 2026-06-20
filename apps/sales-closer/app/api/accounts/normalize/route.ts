import { z } from 'zod';
import { logCompliance, normalizeDataset } from '@cognitia/core';
import { requireAdmin } from '@/lib/auth';
import { ok, route } from '@/lib/api';
import { db } from '@/lib/db';

const Body = z.object({
  scrapeRunId: z.string().uuid().nullish(),
  items: z.array(z.record(z.unknown())).default([]),
});

// Route 3 — normalize staged rows into accounts/contacts/signals.
export const POST = route(async (req) => {
  const ctx = requireAdmin(req);
  const { scrapeRunId, items } = Body.parse(await req.json());
  const result = await normalizeDataset(db(), scrapeRunId ?? null, items);
  await logCompliance(db(), {
    entityType: 'scrape_run',
    entityId: scrapeRunId ?? null,
    action: 'accounts_normalized',
    actor: ctx.actor,
    details: result,
    ip: ctx.ip,
  });
  return ok(result);
});
