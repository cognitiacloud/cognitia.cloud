import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { ok, route } from '@/lib/api';
import { reviewDraft } from '@/lib/services/drafts';

const Body = z.object({ notes: z.string().optional() });

// Route 6 (companion) — reject an outreach draft.
export const POST = route(async (req, { params }) => {
  const ctx = requireAdmin(req);
  const { notes } = Body.parse(await req.json().catch(() => ({})));
  const draft = await reviewDraft(params.id, 'rejected', ctx.actor, notes);
  return ok(draft);
});
