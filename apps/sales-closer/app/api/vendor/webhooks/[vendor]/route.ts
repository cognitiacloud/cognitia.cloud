import { ok, route } from '@/lib/api';
import { handleVendorWebhook } from '@/lib/services/vendor';
import type { VendorName } from '@cognitia/adapters';

const VENDORS: VendorName[] = ['salescloser', 'vapi', 'retell', 'twilio', 'mock'];

// Route 9 — receive a vendor webhook (call outcomes, DNC, etc.).
// No admin guard: authenticity is established by the adapter's signature check.
export const POST = route(async (req, { params }) => {
  const vendor = params.vendor as VendorName;
  if (!VENDORS.includes(vendor)) return ok({ processed: false, error: 'unknown vendor' }, 404);

  const rawBody = await req.text();
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => (headers[k] = v));

  const result = await handleVendorWebhook(vendor, { headers, rawBody });
  // Always 200 so the vendor does not retry a duplicate we already have.
  return ok(result);
});
