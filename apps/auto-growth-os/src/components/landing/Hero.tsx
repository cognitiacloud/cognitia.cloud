// components/landing/Hero.tsx
import { ButtonLink } from '@/components/ui/Button';
import { Reveal } from '@/components/ui/Reveal';
import { computeKpis } from '@/lib/metrics';
import { STAGE_ORDER } from '@/lib/constants';
import { formatMinutes } from '@/lib/format';
import { STAGE_TONE } from '@/components/ui/Badge';
import type { Lead, Stage } from '@/types';
import leadsRaw from '@/data/leads.json';

const LEADS = leadsRaw as Lead[];

const DOT: Record<string, string> = {
  neutral: 'bg-ink-400',
  cyan: 'bg-cyan-400',
  mint: 'bg-mint-400',
  gold: 'bg-gold-400',
  alert: 'bg-rose-400',
};

export function Hero() {
  const kpis = computeKpis(LEADS);
  const stageCounts = STAGE_ORDER.map((stage) => ({
    stage,
    count: LEADS.filter((l) => l.stage === stage).length,
  }));

  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/5 px-3 py-1 text-xs font-medium text-cyan-200">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            Powered by Cognitia Auto Growth OS
          </span>
          <h1 className="mt-5 font-display text-4xl font-bold leading-[1.05] tracking-tight text-ink-100 sm:text-5xl lg:text-6xl">
            Find your next vehicle with <span className="text-gradient-gold">instant help.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-300 sm:text-lg">
            Browse the lot, book a test drive, or check financing in seconds. Every inquiry is
            answered fast, routed to the right specialist, and remembered — so you&apos;re never
            just another lead.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="#lead-form" variant="gold" size="lg">
              Book Test Drive
            </ButtonLink>
            <ButtonLink href="#lead-form" variant="outline" size="lg">
              Check Financing
            </ButtonLink>
            <ButtonLink href="#lead-form" variant="tech" size="lg">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2zm0 2a8 8 0 1 1-4.2 14.8l-.3-.2-2.8.8.8-2.7-.2-.3A8 8 0 0 1 12 4zm-2.7 4c-.2 0-.5 0-.7.4-.2.4-.9.9-.9 2.1s.9 2.4 1 2.6c.2.2 1.8 2.8 4.4 3.8 2.2.8 2.6.7 3.1.6.5 0 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.1-.2-.2-.5-.3l-1.8-.9c-.2-.1-.4-.1-.6.1l-.8 1c-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.8-.7-1.4-1.6-1.5-1.9-.2-.3 0-.4.1-.5l.4-.5c.1-.2.2-.3.3-.5 0-.2 0-.3 0-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4z" />
              </svg>
              Message on WhatsApp
            </ButtonLink>
          </div>
          <p className="mt-4 text-xs text-ink-500">
            Demo experience · WhatsApp and financing flows are simulated
          </p>
        </Reveal>

        {/* Command-center preview */}
        <Reveal delayMs={120}>
          <div className="glass-strong rounded-2xl p-5 ring-glow-cyan sm:p-6">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-ink-200">Live dealership pulse</p>
              <span className="inline-flex items-center gap-1.5 text-xs text-mint-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint-400" />
                Realtime
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <PulseStat label="New today" value={String(kpis.newLeadsToday)} accent="gold" />
              <PulseStat
                label="Avg response"
                value={formatMinutes(kpis.avgResponseMinutes)}
                accent="cyan"
              />
              <PulseStat label="Booked" value={String(kpis.appointmentsBooked)} accent="mint" />
            </div>

            <div className="mt-5">
              <p className="mb-2 text-xs uppercase tracking-wider text-ink-500">Pipeline</p>
              <ul className="space-y-2">
                {stageCounts.map(({ stage, count }) => (
                  <li key={stage} className="flex items-center gap-3">
                    <span className={`h-2 w-2 rounded-full ${DOT[STAGE_TONE[stage as Stage]]}`} />
                    <span className="flex-1 text-sm text-ink-300">{stage}</span>
                    <span className="text-sm font-medium text-ink-100">{count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function PulseStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: 'gold' | 'cyan' | 'mint';
}) {
  const color =
    accent === 'gold' ? 'text-gold-300' : accent === 'cyan' ? 'text-cyan-300' : 'text-mint-300';
  return (
    <div className="rounded-xl border border-white/8 bg-navy-900/50 p-3">
      <p className={`font-display text-xl font-bold ${color}`}>{value}</p>
      <p className="mt-0.5 text-[11px] text-ink-500">{label}</p>
    </div>
  );
}
