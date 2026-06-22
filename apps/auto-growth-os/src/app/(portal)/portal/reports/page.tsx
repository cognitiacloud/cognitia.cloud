import type { Metadata } from 'next';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { ReportsView } from '@/components/portal/ReportsView';

export const metadata: Metadata = { title: 'Reports' };

export default function PortalReportsPage() {
  return (
    <>
      <PortalPageHeader
        eyebrow="Trust &amp; governance"
        title="Proof-backed reporting"
        description="Operational measurement — captured activity and workflow status, without unsafe claims."
      />
      <ReportsView />
    </>
  );
}
