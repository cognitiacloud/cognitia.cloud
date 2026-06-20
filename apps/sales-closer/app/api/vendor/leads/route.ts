import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { ok, route } from '@/lib/api';
import { createVendorLead } from '@/lib/services/vendor';

const Body = z.object({ draftId: z.string().uuid() });

// Route 7 — create a lead with the active voice vendor.
export const POST = route(async (req) => {
  const ctx = requireAdmin(req);
  const { draftId } = Body.parse(await req.json());
  const event = await createVendorLead(draftId, ctx.actor);
  return ok(event, 201);
});
