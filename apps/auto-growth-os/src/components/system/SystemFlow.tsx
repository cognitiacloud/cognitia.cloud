// components/system/SystemFlow.tsx
import { PIPELINE, DATA_LAYER } from '@/lib/constants';
import { Reveal } from '@/components/ui/Reveal';

export function SystemFlow() {
  return (
    <div>
      {/* Pipeline — single row of 7 on desktop */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {PIPELINE.map((step, i) => (
          <Reveal key={step.key} delayMs={i * 50}>
            <div className="flex h-full flex-col rounded-xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(12,18,40,0.04),0_14px_30px_-24px_rgba(12,18,40,0.25)]">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold-400/15 font-display text-xs font-bold text-gold-700">
                {i + 1}
              </span>
              <span className="mt-3 font-display text-sm font-semibold text-ink-100">
                {step.label}
              </span>
              <p className="mt-1 text-xs leading-snug text-ink-400">{step.blurb}</p>
            </div>
          </Reveal>
        ))}
      </div>

      {/* Connector */}
      <div className="my-7 flex flex-col items-center">
        <div className="h-7 w-px bg-gradient-to-b from-line-strong to-transparent" />
        <span className="rounded-full border border-line bg-surface px-4 py-1.5 text-xs font-medium text-ink-300 shadow-sm">
          Every step reads &amp; writes one shared customer record
        </span>
        <div className="h-7 w-px bg-gradient-to-t from-gold-400/60 to-transparent" />
      </div>

      {/* Shared data layer — dark accent band */}
      <Reveal>
        <div className="panel-dark rounded-2xl p-7 sm:p-8">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-400" />
            <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">
              Shared customer data layer
            </p>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {DATA_LAYER.map((item) => (
              <div
                key={item}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/85"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </div>
  );
}
