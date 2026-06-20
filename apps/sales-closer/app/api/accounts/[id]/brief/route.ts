import { generateBrief } from '@cognitia/core';
import { requireAdmin } from '@/lib/auth';
import { ok, route } from '@/lib/api';
import { db } from '@/lib/db';

// Route 5 — generate a closer brief from the account's latest score.
export const POST = route(async (req, { params }) => {
  requireAdmin(req);
  const brief = await generateBrief(db(), params.id);
  return ok(brief, 201);
});
