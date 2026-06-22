'use client';

// components/portal/ActionLedgerTable.tsx
import { useAppState } from '@/lib/store/useAppState';
import { DataTable, type Column } from '@/components/portal/DataTable';
import { timeAgo } from '@/lib/format';
import type { ActionLedgerEntry } from '@/types';

const ACTOR_TONE: Record<ActionLedgerEntry['actorType'], string> = {
  human: 'text-mint-600',
  agent: 'text-cyan-700',
  system: 'text-ink-400',
};

export function ActionLedgerTable() {
  const { ledger } = useAppState();
  const columns: Column<ActionLedgerEntry>[] = [
    {
      header: 'Action',
      cell: (r) => <span className="font-medium text-ink-100">{r.actionType}</span>,
    },
    {
      header: 'Actor',
      cell: (r) => (
        <span className={ACTOR_TONE[r.actorType]}>
          {r.actorType}: {r.actorId}
        </span>
      ),
    },
    {
      header: 'Summary',
      cell: (r) => <span className="text-ink-300">{r.summary}</span>,
      className: 'max-w-[22rem]',
    },
    {
      header: 'Risk',
      cell: (r) =>
        r.riskLevel ? (
          <span
            className={
              r.riskLevel === 'high'
                ? 'text-rose-600'
                : r.riskLevel === 'medium'
                  ? 'text-gold-700'
                  : 'text-ink-400'
            }
          >
            {r.riskLevel}
          </span>
        ) : (
          <span className="text-ink-500">—</span>
        ),
    },
    { header: 'When', cell: (r) => <span className="text-ink-500">{timeAgo(r.createdAt)}</span> },
  ];
  return (
    <DataTable
      columns={columns}
      rows={ledger}
      getKey={(r) => r.id}
      empty="No actions logged yet."
    />
  );
}
