// components/landing/ProductPreview.tsx
// A premium dark-navy "command center" preview for the hero — a framed mini
// dashboard (KPIs + pipeline + lead rows) built from the real seed metrics.

import { computeKpis } from '@/lib/metrics';
import { formatMinutes } from '@/lib/format';
import { STAGE_ORDER } from '@/lib/constants';
import type { Lead, Stage } from '@/types';
import leadsRaw from '@/data/leads.json';

const LEADS = leadsRaw as Lead[];

const STAGE_DOT: Record<Stage, string> = {
  Nurture: 'bg-white/35',
  Qualified: 'bg-cyan-400',
  'Hot Lead': 'bg-mint-400',
  'Immediate Sales Handoff': 'bg-gold-400',
};

export function ProductPreview() {
  const kpis = computeKpis(LEADS);
  const stageCounts = STAGE_ORDER.map((stage) => ({
    stage,
    count: LEADS.filter((l) => l.stage === stage).length,
  }));
  const topLeads = [...LEADS].sort((a, b) => b.score - a.score).slice(0, 3);

  return (
    <div className="panel-dark rounded-2xl p-3 shadow-[0_40px_80px_-40px_rgba(8,12,28,0.55)]">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-2 pb-3 pt-1">
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="ml-3 flex-1 rounded-md bg-white/5 px-3 py-1 text-[11px] text-white/45">
          app.cognitia.cloud/dashboard
        </span>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-center justify-between">
          <p className="font-display text-sm font-semibold text-white">Command Center</p>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-mint-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint-400" />
            Live
          </span>
        </div>

        {/* KPI row */}
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <PreviewStat
            label="New today"
            value={String(kpis.newLeadsToday)}
            accent="text-gold-300"
          />
          <PreviewStat
            label="Avg response"
            value={formatMinutes(kpis.avgResponseMinutes)}
            accent="text-cyan-300"
          />
          <PreviewStat
            label="Booked"
            value={String(kpis.appointmentsBooked)}
            accent="text-mint-300"
          />
        </div>

        {/* Pipeline */}
        <div className="mt-4">
          <p className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-white/40">Pipeline</p>
          <div className="flex gap-1">
            {stageCounts.map(({ stage, count }) => (
              <div key={stage} className="flex-1">
                <div className={`h-1.5 rounded-full ${STAGE_DOT[stage]}`} />
                <p className="mt-1 text-center text-[11px] font-medium text-white/80">{count}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Lead rows */}
        <div className="mt-4 space-y-1.5">
          {topLeads.map((lead) => (
            <div
              key={lead.id}
              className="flex items-center gap-2.5 rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-2"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10 text-[10px] font-semibold text-white/80">
                {lead.name.charAt(0)}
              </span>
              <span className="flex-1 truncate text-xs text-white/85">{lead.name}</span>
              <span className="flex items-center gap-1.5 text-[10px] text-white/55">
                <span className={`h-1.5 w-1.5 rounded-full ${STAGE_DOT[lead.stage]}`} />
                {lead.stage}
              </span>
              <span className="font-display text-xs font-bold text-gold-300">{lead.score}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PreviewStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.03] p-2.5">
      <p className={`font-display text-lg font-bold ${accent}`}>{value}</p>
      <p className="mt-0.5 text-[10px] text-white/45">{label}</p>
    </div>
  );
}
