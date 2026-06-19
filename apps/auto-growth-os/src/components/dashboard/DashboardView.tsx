'use client';

// components/dashboard/DashboardView.tsx
import { useMemo, useState } from 'react';
import type { Stage } from '@/types';
import { useAppState } from '@/lib/store/useAppState';
import { computeKpis } from '@/lib/metrics';
import { formatMinutes } from '@/lib/format';
import { STAGE_ORDER } from '@/lib/constants';
import { DashboardKpiCard } from '@/components/dashboard/DashboardKpiCard';
import { LeadTable } from '@/components/dashboard/LeadTable';
import { LeadDetailPanel } from '@/components/dashboard/LeadDetailPanel';
import { Button } from '@/components/ui/Button';

const FILTERS: (Stage | 'All')[] = ['All', ...STAGE_ORDER];

function Icon({ d }: { d: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

export function DashboardView() {
  const { leads, resetDemo } = useAppState();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Stage | 'All'>('All');

  const kpis = useMemo(() => computeKpis(leads), [leads]);
  const filtered = useMemo(
    () => (filter === 'All' ? leads : leads.filter((l) => l.stage === filter)),
    [leads, filter],
  );

  const selected = leads.find((l) => l.id === selectedId) ?? filtered[0] ?? leads[0] ?? null;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
            Command center
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-100">
            Leads &amp; appointments
          </h1>
          <p className="mt-1 text-sm text-ink-400">
            Live pipeline, source attribution, and recommended next actions.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={resetDemo} className="border border-white/10">
          <Icon d="M4 12a8 8 0 0 1 14-5M20 12a8 8 0 0 1-14 5M18 3v4h-4M6 21v-4h4" />
          Reset demo data
        </Button>
      </div>

      {/* KPIs */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <DashboardKpiCard
          label="New leads today"
          value={kpis.newLeadsToday}
          sublabel="captured in the last day"
          accent="gold"
          icon={<Icon d="M12 5v14M5 12h14" />}
        />
        <DashboardKpiCard
          label="Avg response time"
          value={formatMinutes(kpis.avgResponseMinutes)}
          sublabel={`Target ${kpis.slaTargetMinutes} min`}
          accent="cyan"
          icon={<Icon d="M12 7v5l3 2M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z" />}
        />
        <DashboardKpiCard
          label="Appointments booked"
          value={kpis.appointmentsBooked}
          sublabel="test drives + consults"
          accent="mint"
          icon={
            <Icon d="M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
          }
        />
        <DashboardKpiCard
          label="Qualified leads"
          value={kpis.qualifiedLeads}
          sublabel="score ≥ 31"
          accent="cyan"
          icon={<Icon d="M20 6L9 17l-5-5" />}
        />
        <DashboardKpiCard
          label="Missed SLA alerts"
          value={kpis.missedSla}
          sublabel="need attention now"
          accent="alert"
          icon={
            <Icon d="M12 9v4M12 17h.01M10.3 3.9l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3l-8-14a2 2 0 0 0-3.4 0z" />
          }
        />
      </div>

      {/* Filters */}
      <div className="mt-7 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
              filter === f
                ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200'
                : 'border-white/10 bg-navy-850/50 text-ink-400 hover:text-ink-100'
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

      {/* Table + detail */}
      <div className="mt-4 grid gap-5 lg:grid-cols-[1.45fr_1fr] lg:items-start">
        <LeadTable leads={filtered} selectedId={selected?.id ?? null} onSelect={setSelectedId} />
        {selected ? (
          <LeadDetailPanel lead={selected} />
        ) : (
          <div className="rounded-2xl border border-white/8 glass p-6 text-sm text-ink-400">
            No leads in this view.
          </div>
        )}
      </div>
    </div>
  );
}
