import type { Metadata } from 'next';
import Link from 'next/link';
import { Section } from '@/components/ui/Section';
import { Reveal } from '@/components/ui/Reveal';
import { Wordmark } from '@/components/brand/CognitiaMark';

export const metadata: Metadata = {
  title: 'Guided Demo',
  description:
    'A guided, executive-facing tour of the Demandara Dealership Growth OS, powered by Cognitia.',
};

const STOPS = [
  {
    href: '/',
    n: '01',
    title: 'Website Command Center',
    desc: 'Capture every inquiry from a fast, mobile-first storefront.',
  },
  {
    href: '/intake',
    n: '02',
    title: 'Client Intake',
    desc: 'Scope the build in 12 questions — instant recommendation.',
  },
  {
    href: '/portal/dashboard',
    n: '03',
    title: 'CRM Dashboard',
    desc: 'Leads, SLAs, source attribution, and next best actions.',
  },
  {
    href: '/system-map',
    n: '04',
    title: 'System Map',
    desc: 'One pipeline over one shared customer data layer.',
  },
  {
    href: '/portal/customers',
    n: '05',
    title: 'Customer Mapper',
    desc: 'Memory that earns the repurchase — privacy-conscious.',
  },
  {
    href: '/modules',
    n: '06',
    title: 'Pricing Menu',
    desc: 'Pilot · Growth · Empire, plus add-on modules.',
  },
];

export default function MeetingPage() {
  return (
    <div className="py-16 sm:py-24">
      <Section>
        <Reveal>
          <div className="flex flex-col items-center text-center">
            <Wordmark />
            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">
              Guided demo
            </p>
            <h1 className="mt-3 max-w-2xl font-display text-4xl font-bold tracking-tight text-ink-100 sm:text-5xl">
              The dealership growth operating system
            </h1>
            <p className="mt-4 max-w-xl text-base text-ink-300">
              Six stops, five minutes. Capture, route, respond, book, and remember — one system.
            </p>
          </div>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STOPS.map((stop, i) => (
            <Reveal key={stop.href} delayMs={i * 60}>
              <Link
                href={stop.href}
                className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(12,18,40,0.04)] transition duration-200 hover:-translate-y-1 hover:border-gold-400/40 hover:shadow-[0_24px_50px_-28px_rgba(12,18,40,0.3)]"
              >
                <span className="font-display text-sm font-bold text-gold-700">{stop.n}</span>
                <h2 className="mt-3 font-display text-lg font-semibold text-ink-100">
                  {stop.title}
                </h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-400">{stop.desc}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-cyan-700 transition group-hover:gap-2.5">
                  Open
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </Link>
            </Reveal>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-ink-500">
          Demo environment · Integrations simulated · No real customer data · Ad spend paid directly
          by client
        </p>
      </Section>
    </div>
  );
}
