// components/modules/PricingCard.tsx
import type { Package } from '@/types';
import { formatRange } from '@/lib/format';
import { ButtonLink } from '@/components/ui/Button';

export function PricingCard({ pkg, featured = false }: { pkg: Package; featured?: boolean }) {
  return (
    <article
      className={`relative flex h-full flex-col rounded-2xl p-6 sm:p-7 ${
        featured
          ? 'border border-gold-400/40 bg-gradient-to-b from-gold-400/[0.08] to-navy-900/40 ring-glow-cyan'
          : 'border border-white/8 bg-navy-850/50'
      }`}
    >
      {featured && (
        <span className="absolute -top-3 left-6 rounded-full bg-gradient-to-r from-gold-400 to-gold-500 px-3 py-1 text-xs font-semibold text-navy-950">
          Most popular
        </span>
      )}
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-xl font-bold text-ink-100">{pkg.name}</h3>
      </div>
      <p className="mt-1.5 text-sm text-ink-400">{pkg.tagline}</p>

      <div className="mt-5 space-y-1">
        <p className="text-xs uppercase tracking-wider text-ink-500">Setup</p>
        <p className="font-display text-2xl font-bold text-gradient-gold">
          {formatRange(pkg.setupCad)}
          <span className="ml-1 text-sm font-normal text-ink-500">CAD</span>
        </p>
        <p className="pt-1 text-sm text-ink-300">
          {formatRange(pkg.monthlyCad)} <span className="text-ink-500">/ month</span>
        </p>
      </div>

      <p className="mt-5 text-xs font-medium uppercase tracking-wider text-ink-500">Includes</p>
      <ul className="mt-2 flex-1 space-y-2">
        {pkg.highlights.map((h) => (
          <li key={h} className="flex items-start gap-2 text-sm text-ink-200">
            <svg
              className="mt-0.5 shrink-0 text-mint-300"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
            >
              <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {h}
          </li>
        ))}
      </ul>

      <div className="mt-6 rounded-xl border border-white/8 bg-navy-900/50 p-3 text-xs text-ink-400">
        <p>
          <span className="text-ink-300">Launch:</span> {pkg.launchTimeline}
        </p>
        <p className="mt-1">
          <span className="text-ink-300">Best for:</span> {pkg.bestFor}
        </p>
      </div>

      <ButtonLink
        href="/intake"
        variant={featured ? 'gold' : 'outline'}
        size="md"
        className="mt-6 w-full"
      >
        Start with {pkg.name}
      </ButtonLink>
    </article>
  );
}
