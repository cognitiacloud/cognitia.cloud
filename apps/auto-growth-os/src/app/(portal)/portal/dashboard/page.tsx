import type { Metadata } from 'next';
import { DashboardView } from '@/components/dashboard/DashboardView';
import { DemandaraGtmPanel } from '@/components/portal/DemandaraGtmPanel';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Command center — KPIs, the live lead pipeline, source attribution, SLA alerts.',
};

export default function PortalDashboardPage() {
  return (
    <>
      <DashboardView />
      <DemandaraGtmPanel />
    </>
  );
}
