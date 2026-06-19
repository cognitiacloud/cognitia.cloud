// components/landing/Hero.tsx
import { ButtonLink } from '@/components/ui/Button';
import { Reveal } from '@/components/ui/Reveal';
import { ProductPreview } from '@/components/landing/ProductPreview';

const OUTCOMES = [
  'Capture every inquiry',
  'Route every lead',
  'Respond before competitors',
  'Remember every customer',
];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-300 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-mint-400" />
            Cognitia Auto Growth OS
          </span>
          <h1 className="mt-5 font-display text-4xl font-bold leading-[1.05] tracking-tight text-ink-100 sm:text-5xl lg:text-[3.4rem]">
            Website, intake, CRM, and AI agents for{' '}
            <span className="text-gradient-gold">dealership growth.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-300 sm:text-lg">
            One system to capture every inquiry, route every lead, and respond before competitors —
            with human-approved AI and consent-aware automation.
          </p>

          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
            {OUTCOMES.map((o) => (
              <li key={o} className="flex items-center gap-2 text-sm font-medium text-ink-200">
                <svg
                  className="text-mint-600"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                >
                  <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {o}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/dashboard" variant="gold" size="lg">
              Explore the dashboard
            </ButtonLink>
            <ButtonLink href="/intake" variant="navy" size="lg">
              Start client intake
            </ButtonLink>
          </div>
          <p className="mt-4 text-xs text-ink-500">
            Live demo · Integrations simulated · Ad spend paid directly by client
          </p>
        </Reveal>

        <Reveal delayMs={120}>
          <ProductPreview />
        </Reveal>
      </div>
    </section>
  );
}
