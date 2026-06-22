'use client';

// components/portal/LeadsTable.tsx
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppState } from '@/lib/store/useAppState';
import { LeadTable } from '@/components/dashboard/LeadTable';
import { STAGE_ORDER } from '@/lib/constants';
import type { Stage } from '@/types';

const FILTERS: (Stage | 'All')[] = ['All', ...STAGE_ORDER];

export function LeadsTable() {
  const { leads } = useAppState();
  const router = useRouter();
  const [filter, setFilter] = useState<Stage | 'All'>('All');
  const filtered = useMemo(
    () => (filter === 'All' ? leads : leads.filter((l) => l.stage === filter)),
    [leads, filter],
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
              filter === f
                ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-700'
                : 'border-line bg-surface text-ink-400 hover:text-ink-100'
            }`}
          >
            {f}
            {f !== 'All' && (
              <span className="ml-1.5 text-ink-500">
                {leads.filter((l) => l.stage === f).length}
              </span>
            )}
          </button>
        ))}
      </div>
      <LeadTable
        leads={filtered}
        selectedId={null}
        onSelect={(id) => router.push(`/portal/leads/${id}`)}
      />
    </div>
  );
}
