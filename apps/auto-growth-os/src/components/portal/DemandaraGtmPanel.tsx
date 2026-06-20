'use client';

// components/portal/DemandaraGtmPanel.tsx
// Demandara's own go-to-market pipeline: dealerships discovered through the
// Discovery Console. Distinct from the dealer's customer leads — these are
// prospects Demandara is qualifying to onboard onto the Growth OS.
import Link from 'next/link';
import type { ProspectStage } from '@/types';
import { useAppState } from '@/lib/store/useAppState';
import { Badge } from '@/components/ui/Badge';

const STAGE_LABEL: Record<
  ProspectStage,
  { tone: 'neutral' | 'cyan' | 'mint' | 'gold'; label: string }
> = {
  identified: { tone: 'neutral', label: 'Identified' },
  researching: { tone: 'cyan', label: 'Researching' },
  qualified: { tone: 'cyan', label: 'Qualified' },
  contacted: { tone: 'gold', label: 'Contacted' },
  meeting_booked: { tone: 'mint', label: 'Meeting booked' },
};

export function DemandaraGtmPanel() {
  const { gtmProspects, mounted } = useAppState();

  return (
    <section className="mt-8 rounded-2xl border border-line bg-surface p-6 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-700">
            Demandara GTM
          </p>
          <h2 className="mt-1 font-display text-xl font-bold tracking-tight text-ink-100">
            Dealership prospects
          </h2>
          <p className="mt-1 text-sm text-ink-400">
            Sourced from the{' '}
            <Link href="/discovery" className="text-cyan-700">
              Discovery Console
            </Link>
            . Generating a proposal adds the dealership here.
          </p>
        </div>
        <Badge tone="neutral">
          {gtmProspects.length} prospect{gtmProspects.length === 1 ? '' : 's'}
        </Badge>
      </div>

      {gtmProspects.length === 0 ? (
        <p className="mt-5 rounded-xl border border-line bg-surface-2 p-5 text-sm text-ink-400">
          {mounted
            ? 'No prospects yet. Complete a discovery session and generate a proposal to add one.'
            : 'Loading…'}
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {gtmProspects.map((p) => {
            const stage = STAGE_LABEL[p.stage];
            return (
              <li
                key={p.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line bg-surface-2 p-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-sm font-semibold text-ink-100">
                      {p.dealership}
                    </p>
                    <Badge tone={stage.tone}>{stage.label}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {p.city} · {p.contactName} · {p.recommendedPackage}
                  </p>
                  <p className="mt-1.5 text-sm text-ink-300">
                    <span className="text-ink-500">Next step:</span> {p.nextStep}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wider text-ink-500">Signal</p>
                  <p className="font-display text-2xl font-bold text-gradient-gold">
                    {p.signalScore}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
