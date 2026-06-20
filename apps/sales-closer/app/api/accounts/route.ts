import { ok, route } from '@/lib/api';
import { listAccounts } from '@/lib/queries';

// Read route — prospect list for the UI.
export const GET = route(async () => ok(await listAccounts()));
