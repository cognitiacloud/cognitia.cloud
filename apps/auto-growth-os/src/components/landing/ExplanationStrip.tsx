// components/landing/ExplanationStrip.tsx
import { Section, SectionHeading } from '@/components/ui/Section';
import { Reveal } from '@/components/ui/Reveal';

const PILLARS = [
  {
    label: 'Website',
    icon: 'globe',
    body: 'Capture every inquiry from a fast, mobile-first storefront.',
  },
  {
    label: 'Intake',
    icon: 'form',
    body: 'Route every lead with structured, automatic qualification.',
  },
  {
    label: 'CRM',
    icon: 'grid',
    body: 'Respond before competitors — nothing slips, every handoff has context.',
  },
  {
    label: 'AI Agents',
    icon: 'spark',
    body: 'Human-approved drafts and next best actions. Never autonomous.',
  },
];

function PillarIcon({ name }: { name: string }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
  } as const;
  switch (name) {
    case 'globe':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
        </svg>
      );
    case 'form':
      return (
        <svg {...common}>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 8h8M8 12h8M8 16h5" strokeLinecap="round" />
        </svg>
      );
    case 'grid':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path
            d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
}

export function ExplanationStrip() {
  return (
    <Section className="py-16">
      <SectionHeading
        align="center"
        eyebrow="One connected system"
        title={
          <>
            Website + Intake + CRM + <span className="text-gradient-tech">AI Agents</span>
          </>
        }
        description="Not four tools stitched together — one operating system where data flows end to end."
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PILLARS.map((pillar, i) => (
          <Reveal key={pillar.label} delayMs={i * 70}>
            <div className="relative h-full rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(12,18,40,0.04)]">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-700">
                <PillarIcon name={pillar.icon} />
              </div>
              <h3 className="mt-4 font-display text-base font-semibold text-ink-100">
                {pillar.label}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-400">{pillar.body}</p>
              {i < PILLARS.length - 1 && (
                <span className="absolute right-0 top-1/2 hidden -translate-y-1/2 translate-x-1/2 text-cyan-400/40 lg:block">
                  <svg
                    width="20"
                    height="20"
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
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
