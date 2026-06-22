// components/dashboard/LeadTable.tsx
'use client';

import type { Lead } from '@/types';
import { StageBadge } from '@/components/ui/Badge';
import { SLA_TARGET_MINUTES } from '@/lib/constants';

const breachedSla = (lead: Lead) =>
  lead.firstResponseMinutes === null || lead.firstResponseMinutes > SLA_TARGET_MINUTES;

function ScorePill({ score }: { score: number }) {
  const tone =
    score >= 86
      ? 'text-gold-700'
      : score >= 61
        ? 'text-mint-600'
        : score >= 31
          ? 'text-cyan-700'
          : 'text-ink-400';
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`font-display text-sm font-bold ${tone}`}>{score}</span>
      <span className="hidden h-1.5 w-12 overflow-hidden rounded-full bg-line sm:block">
        <span
          className={`block h-full rounded-full bg-gradient-to-r ${
            score >= 86
              ? 'from-gold-400 to-gold-500'
              : score >= 61
                ? 'from-mint-400 to-mint-300'
                : score >= 31
                  ? 'from-cyan-400 to-cyan-300'
                  : 'from-ink-500 to-ink-400'
          }`}
          style={{ width: `${score}%` }}
        />
      </span>
    </span>
  );
}

export function LeadTable({
  leads,
  selectedId,
  onSelect,
}: {
  leads: Lead[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[42rem] text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2/60 text-xs uppercase tracking-wider text-ink-500">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">Source</th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">Vehicle interest</th>
              <th className="px-4 py-3 font-medium">Score</th>
              <th className="px-4 py-3 font-medium">Stage</th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">Owner</th>
              <th className="hidden px-4 py-3 font-medium xl:table-cell">Next action</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const selected = lead.id === selectedId;
              return (
                <tr
                  key={lead.id}
                  onClick={() => onSelect(lead.id)}
                  className={`cursor-pointer border-b border-line transition last:border-0 ${
                    selected ? 'bg-cyan-400/[0.07]' : 'hover:bg-surface-2'
                  }`}
                >
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      {lead.isDemo && (
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-mint-400"
                          title="Added in this demo session"
                        />
                      )}
                      <span className="font-medium text-ink-100">{lead.name}</span>
                      {breachedSla(lead) && (
                        <span className="rounded-full border border-rose-300 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">
                          SLA
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-ink-500 sm:hidden">{lead.source}</span>
                  </td>
                  <td className="hidden px-4 py-3.5 text-ink-300 sm:table-cell">{lead.source}</td>
                  <td className="hidden max-w-[14rem] truncate px-4 py-3.5 text-ink-300 lg:table-cell">
                    {lead.vehicleInterest}
                  </td>
                  <td className="px-4 py-3.5">
                    <ScorePill score={lead.score} />
                  </td>
                  <td className="px-4 py-3.5">
                    <StageBadge stage={lead.stage} />
                  </td>
                  <td className="hidden px-4 py-3.5 text-ink-300 lg:table-cell">{lead.owner}</td>
                  <td className="hidden max-w-[16rem] truncate px-4 py-3.5 text-ink-400 xl:table-cell">
                    {lead.nextAction}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
