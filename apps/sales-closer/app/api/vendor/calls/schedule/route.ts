import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { ok, route } from '@/lib/api';
import { scheduleVendorCall } from '@/lib/services/vendor';

const Body = z.object({
  leadExternalId: z.string().min(1),
  scheduledFor: z.string().datetime(),
  accountId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  draftId: z.string().uuid().optional(),
});

// Route 8 — schedule a vendor call.
export const POST = route(async (req) => {
  requireAdmin(req);
  const body = Body.parse(await req.json());
  const event = await scheduleVendorCall({
    leadExternalId: body.leadExternalId,
    scheduledFor: new Date(body.scheduledFor),
    accountId: body.accountId,
    contactId: body.contactId,
    draftId: body.draftId,
  });
  return ok(event, 201);
});
