import { fail, ok, route } from '@/lib/api';
import { getAccountDetail } from '@/lib/queries';

// Read route — account detail for the UI.
export const GET = route(async (_req, { params }) => {
  const detail = await getAccountDetail(params.id);
  if (!detail) return fail('Account not found', 404);
  return ok(detail);
});
