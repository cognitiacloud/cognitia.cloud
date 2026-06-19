// components/intake/RecommendationResult.tsx
import type { PackageRecommendation } from '@/types';
import { formatRange } from '@/lib/format';
import { ButtonLink, Button } from '@/components/ui/Button';
import { ComplianceNotice } from '@/components/brand/ComplianceNotice';

const TIER_TAG: Record<string, string> = {
  Pilot: 'Foundation to launch from',
  Growth: 'Demand generation engine',
  Empire: 'Full growth operating system',
};

export function RecommendationResult({
  recommendation,
  onEdit,
}: {
  recommendation: PackageRecommendation;
  onEdit: () => void;
}) {
  const { tier, package: pkg, rationale } = recommendation;

  return (
    <div className="space-y-5">
      {/* Proposal header — dark navy */}
      <div className="panel-dark relative overflow-hidden rounded-2xl p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">
              Recommended package
            </p>
            <h2 className="mt-2 font-display text-4xl font-bold text-white">{tier}</h2>
            <p className="mt-1 text-sm text-white/60">{TIER_TAG[tier]}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-right">
            <span className="block text-[11px] uppercase tracking-wider text-white/45">
              Fit score
            </span>
            <span className="font-display text-2xl font-bold text-mint-300">
              {recommendation.fitScore}/10
            </span>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/70">{pkg.bestFor}</p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Stat label="Setup (CAD)" value={formatRange(pkg.setupCad)} />
          <Stat label="Monthly (CAD)" value={`${formatRange(pkg.monthlyCad)}/mo`} />
          <Stat label="Launch timeline" value={pkg.launchTimeline} />
        </div>
      </div>

      {/* Modules + pass-through */}
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-line glass p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-cyan-700">
            Included modules
          </h3>
          <ul className="mt-3 space-y-2">
            {pkg.includedModules.map((m) => (
              <li key={m} className="flex items-center gap-2 text-sm text-ink-100">
                <svg
                  className="shrink-0 text-mint-600"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                >
                  <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {m}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-line glass p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gold-700">
            Pass-through costs
          </h3>
          <ul className="mt-3 space-y-2">
            {pkg.passThroughCosts.map((c) => (
              <li key={c} className="flex items-start gap-2 text-sm text-ink-300">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400/70" />
                {c}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-ink-500">
            Ad spend is paid directly by you in your own Google / Meta accounts.
          </p>
        </div>
      </div>

      {/* Rationale */}
      <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.04] p-6">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-cyan-700">
          Why this recommendation
        </h3>
        <ul className="mt-3 space-y-2">
          {rationale.map((r, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-ink-200">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-400/15 text-[11px] font-bold text-cyan-700">
                {i + 1}
              </span>
              {r}
            </li>
          ))}
        </ul>
      </div>

      <ComplianceNotice variant="compact" />

      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/modules" variant="gold" size="lg">
          Explore modules &amp; pricing
        </ButtonLink>
        <ButtonLink href="/dashboard" variant="outline" size="lg">
          See the command center
        </ButtonLink>
        <Button variant="ghost" size="lg" onClick={onEdit}>
          Edit answers
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs uppercase tracking-wider text-white/45">{label}</p>
      <p className="mt-1 font-display text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
