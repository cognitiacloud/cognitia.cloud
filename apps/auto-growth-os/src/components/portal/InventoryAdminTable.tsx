'use client';

// components/portal/InventoryAdminTable.tsx
import Link from 'next/link';
import { useAppState } from '@/lib/store/useAppState';
import { DataTable, type Column } from '@/components/portal/DataTable';
import { Badge } from '@/components/ui/Badge';
import { formatCad } from '@/lib/format';
import type { Vehicle } from '@/types';

const APPROVAL_TONE: Record<string, 'neutral' | 'gold' | 'mint' | 'alert'> = {
  draft: 'neutral',
  pending_review: 'gold',
  approved: 'mint',
  rejected: 'alert',
};

export function InventoryAdminTable() {
  const { vehicles } = useAppState();
  const columns: Column<Vehicle>[] = [
    {
      header: 'Vehicle',
      cell: (v) => (
        <Link
          href={`/portal/inventory/${v.id}`}
          className="font-medium text-ink-100 hover:text-cyan-700"
        >
          {v.year} {v.make} {v.model} {v.trim}
        </Link>
      ),
    },
    { header: 'Stock', cell: (v) => v.stockNumber ?? '—' },
    { header: 'Price', cell: (v) => formatCad(v.priceCad) },
    {
      header: 'Approval',
      cell: (v) => (
        <Badge tone={APPROVAL_TONE[v.approvalStatus ?? 'draft']}>
          {(v.approvalStatus ?? 'draft').replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      header: 'Public',
      cell: (v) => (
        <span className={v.publishedStatus === 'published' ? 'text-mint-600' : 'text-ink-500'}>
          {v.publishedStatus === 'published' ? 'Published' : 'Unpublished'}
        </span>
      ),
    },
  ];
  return (
    <DataTable columns={columns} rows={vehicles} getKey={(v) => v.id} empty="No vehicles yet." />
  );
}
