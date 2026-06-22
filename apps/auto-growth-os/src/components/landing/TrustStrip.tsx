// components/landing/TrustStrip.tsx
import { Section } from '@/components/ui/Section';
import { Reveal } from '@/components/ui/Reveal';

const TRUST = [
  {
    metric: 'Mobile-first',
    title: 'Built for phone shoppers',
    body: 'The majority of car shopping starts on mobile. Every screen is designed thumb-first.',
  },
  {
    metric: 'SEO-safe',
    title: 'Found on Google',
    body: 'Server-rendered, semantic, and fast — clean pages that search engines love.',
  },
  {
    metric: '< 1s',
    title: 'Fast loading',
    body: 'Optimized assets and lightweight code keep interactions feeling instant.',
  },
];

export function TrustStrip() {
  return (
    <Section className="py-12">
      <div className="grid gap-4 sm:grid-cols-3">
        {TRUST.map((item, i) => (
          <Reveal key={item.metric} delayMs={i * 70}>
            <div className="h-full rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(12,18,40,0.04)]">
              <p className="font-display text-2xl font-bold text-ink-100">{item.metric}</p>
              <h3 className="mt-2 text-sm font-semibold text-ink-200">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-400">{item.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
