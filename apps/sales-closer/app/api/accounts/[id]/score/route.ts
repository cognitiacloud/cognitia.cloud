import { scoreAccount } from '@cognitia/core';
import { requireAdmin } from '@/lib/auth';
import { ok, route } from '@/lib/api';
import { db } from '@/lib/db';

// Route 4 — score an account (idempotent on its signals hash).
export const POST = route(async (req, { params }) => {
  requireAdmin(req);
  const score = await scoreAccount(db(), params.id);
  return ok(score);
});
