import type { Metadata } from 'next';
import { DashboardView } from '@/components/dashboard/DashboardView';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Command center — KPIs, the live lead pipeline, source attribution, SLA alerts.',
};

export default function PortalDashboardPage() {
  return <DashboardView />;
}
