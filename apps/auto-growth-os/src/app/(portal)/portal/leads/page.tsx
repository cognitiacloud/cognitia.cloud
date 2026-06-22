import type { Metadata } from 'next';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { LeadsTable } from '@/components/portal/LeadsTable';

export const metadata: Metadata = { title: 'Leads' };

export default function PortalLeadsPage() {
  return (
    <>
      <PortalPageHeader
        eyebrow="Operate"
        title="Leads"
        description="Every captured lead — filter, open, and act. Source attribution and SLA alerts included."
      />
      <LeadsTable />
    </>
  );
}
