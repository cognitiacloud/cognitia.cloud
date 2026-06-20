'use client';

// components/portal/AppointmentsTable.tsx
import { useAppState } from '@/lib/store/useAppState';
import { DataTable, type Column } from '@/components/portal/DataTable';
import { Badge } from '@/components/ui/Badge';
import type { Appointment } from '@/types/portal';

const STATUS_TONE: Record<Appointment['status'], 'neutral' | 'gold' | 'cyan' | 'mint' | 'alert'> = {
  requested: 'gold',
  confirmed: 'cyan',
  completed: 'mint',
  no_show: 'alert',
};

const TYPE_LABEL: Record<Appointment['type'], string> = {
  test_drive: 'Test drive',
  finance_consult: 'Finance consult',
  service: 'Service',
};

export function AppointmentsTable() {
  const { appointments } = useAppState();
  const columns: Column<Appointment>[] = [
    {
      header: 'Customer',
      cell: (a) => <span className="font-medium text-ink-100">{a.customerName}</span>,
    },
    { header: 'Vehicle', cell: (a) => a.vehicleLabel },
    { header: 'Type', cell: (a) => TYPE_LABEL[a.type] },
    { header: 'Preferred', cell: (a) => a.preferredTime },
    {
      header: 'Status',
      cell: (a) => <Badge tone={STATUS_TONE[a.status]}>{a.status.replace('_', ' ')}</Badge>,
    },
    { header: 'Owner', cell: (a) => a.owner },
  ];
  return (
    <DataTable
      columns={columns}
      rows={appointments}
      getKey={(a) => a.id}
      empty="No appointments yet."
    />
  );
}
