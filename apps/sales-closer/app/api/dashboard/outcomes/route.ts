import { ok, route } from '@/lib/api';
import { dashboardOutcomes } from '@/lib/queries';

// Read route — call outcome aggregates for the dashboard.
export const GET = route(async () => ok(await dashboardOutcomes()));
