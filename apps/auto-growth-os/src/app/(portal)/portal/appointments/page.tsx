import type { Metadata } from 'next';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { AppointmentsTable } from '@/components/portal/AppointmentsTable';

export const metadata: Metadata = { title: 'Appointments' };

export default function PortalAppointmentsPage() {
  return (
    <>
      <PortalPageHeader
        eyebrow="Operate"
        title="Appointments"
        description="Test drives, finance consults, and service — requested, confirmed, and completed."
      />
      <AppointmentsTable />
    </>
  );
}
