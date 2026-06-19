// components/system/SystemFlow.tsx
import { PIPELINE, DATA_LAYER } from '@/lib/constants';
import { Reveal } from '@/components/ui/Reveal';

export function SystemFlow() {
  return (
    <div>
      {/* Pipeline */}
      <div className="flex flex-wrap items-stretch gap-3">
        {PIPELINE.map((step, i) => (
          <div key={step.key} className="flex items-stretch gap-3">
            <Reveal delayMs={i * 60}>
              <div className="flex h-full min-w-[8.5rem] flex-col rounded-xl border border-white/10 bg-navy-850/60 p-4 transition hover:border-cyan-400/30">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-400/15 text-xs font-bold text-cyan-300">
                    {i + 1}
                  </span>
                  <span className="font-display text-sm font-semibold text-ink-100">
                    {step.label}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-snug text-ink-400">{step.blurb}</p>
              </div>
            </Reveal>
            {i < PIPELINE.length - 1 && (
              <span className="hidden items-center text-cyan-400/40 sm:flex">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Connector */}
      <div className="my-6 flex flex-col items-center">
        <div className="h-6 w-px bg-gradient-to-b from-cyan-400/50 to-transparent" />
        <span className="rounded-full border border-cyan-400/25 bg-cyan-400/5 px-3 py-1 text-xs font-medium text-cyan-200">
          Every step reads &amp; writes the shared data layer
        </span>
        <div className="h-6 w-px bg-gradient-to-t from-gold-400/50 to-transparent" />
      </div>

      {/* Shared data layer */}
      <Reveal>
        <div className="rounded-2xl border border-gold-400/25 bg-gradient-to-b from-gold-400/[0.06] to-navy-900/40 p-6">
          <p className="mb-4 font-display text-sm font-semibold uppercase tracking-[0.18em] text-gold-300">
            Shared customer data layer
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {DATA_LAYER.map((item) => (
              <div
                key={item}
                className="rounded-xl border border-white/8 bg-navy-900/60 px-4 py-3 text-center text-sm text-ink-200"
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
