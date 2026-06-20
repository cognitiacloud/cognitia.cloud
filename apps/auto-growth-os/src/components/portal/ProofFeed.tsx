'use client';

// components/portal/ProofFeed.tsx
import { useState } from 'react';
import { useAppState } from '@/lib/store/useAppState';
import { timeAgo } from '@/lib/format';
import type { ProofKind } from '@/types/portal';

const KIND_LABEL: Record<ProofKind, string> = {
  lead_captured: 'Lead',
  response_time: 'Response',
  approval: 'Approval',
  compliance_check: 'Compliance',
  publish: 'Publish',
  outcome: 'Outcome',
  report: 'Report',
};

const KIND_DOT: Record<ProofKind, string> = {
  lead_captured: 'bg-cyan-400',
  response_time: 'bg-mint-400',
  approval: 'bg-gold-400',
  compliance_check: 'bg-rose-400',
  publish: 'bg-cyan-400',
  outcome: 'bg-mint-400',
  report: 'bg-ink-400',
};

const FILTERS: ('all' | ProofKind)[] = [
  'all',
  'lead_captured',
  'response_time',
  'approval',
  'compliance_check',
  'publish',
  'report',
];

export function ProofFeed() {
  const { proofEvents } = useAppState();
  const [filter, setFilter] = useState<'all' | ProofKind>('all');
  const rows = filter === 'all' ? proofEvents : proofEvents.filter((e) => e.kind === filter);

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              filter === f
                ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-700'
                : 'border-line bg-surface text-ink-400 hover:text-ink-100'
            }`}
          >
            {f === 'all' ? 'All' : KIND_LABEL[f]}
          </button>
        ))}
      </div>

      <ol className="space-y-2.5">
        {rows.map((e) => (
          <li
            key={e.id}
            className="flex items-start gap-3 rounded-xl border border-line bg-surface p-4 shadow-sm"
          >
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${KIND_DOT[e.kind]}`} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-ink-100">{e.title}</p>
                <span className="text-xs text-ink-500">{timeAgo(e.createdAt)}</span>
              </div>
              <p className="mt-0.5 text-sm text-ink-400">{e.detail}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-500">
                <span className="rounded bg-surface-2 px-1.5 py-0.5">{KIND_LABEL[e.kind]}</span>
                <span>· {e.evidenceLabel}</span>
                {e.metric && (
                  <span className="font-medium text-ink-300">
                    · {e.metric.label}: {e.metric.value}
                  </span>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
