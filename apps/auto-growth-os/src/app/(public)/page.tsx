import type { Metadata } from 'next';
import { Section, SectionHeading } from '@/components/ui/Section';
import { Reveal } from '@/components/ui/Reveal';
import { ButtonLink } from '@/components/ui/Button';
import { VehicleCard } from '@/components/landing/VehicleCard';
import { TrustStrip } from '@/components/landing/TrustStrip';
import { PublicInquiryForm } from '@/components/public/PublicInquiryForm';
import { publishedVehicles } from '@/lib/inventory';
import { PRODUCT } from '@/lib/copy';

export const metadata: Metadata = {
  title: 'Used Cars in Toronto',
  description:
    'Browse quality used vehicles in Toronto and the GTA. Check availability, ask about financing, submit a trade-in for review, or book a test drive.',
};

const OUTCOMES = [
  'Certified, inspected inventory',
  'Fast answers to every inquiry',
  'Book a test drive online',
];

export default function PublicHome() {
  const featured = publishedVehicles().slice(0, 6);
  return (
    <>
      <section className="relative overflow-hidden">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-300 shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-mint-400" />
              {PRODUCT.dealer} · Toronto &amp; the GTA
            </span>
            <h1 className="mt-5 max-w-3xl font-display text-4xl font-bold leading-[1.05] tracking-tight text-ink-100 sm:text-5xl lg:text-6xl">
              Find your next vehicle, <span className="text-gradient-gold">the easy way.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-300 sm:text-lg">
              Browse certified used cars, check availability, and get fast answers — every inquiry
              is captured, routed, and followed up.
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
              <ButtonLink href="/inventory" variant="gold" size="lg">
                Browse Inventory
              </ButtonLink>
              <ButtonLink href="/finance" variant="navy" size="lg">
                Request Finance Callback
              </ButtonLink>
              <ButtonLink href="/book-test-drive" variant="outline" size="lg">
                Book Test Drive
              </ButtonLink>
            </div>
            <p className="mt-4 text-xs text-ink-500">
              Demo experience · Availability, pricing, and financing are confirmed with the
              dealership.
            </p>
          </Reveal>
        </div>
      </section>

      <Section className="pb-4">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <SectionHeading
            eyebrow="Featured inventory"
            title="Fresh arrivals on the lot"
            description="A fast, mobile-first storefront — every card opens a full vehicle page."
          />
          <ButtonLink href="/inventory" variant="outline" size="sm">
            View all inventory
          </ButtonLink>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((v, i) => (
            <Reveal key={v.id} delayMs={i * 60}>
              <VehicleCard vehicle={v} />
            </Reveal>
          ))}
        </div>
      </Section>

      <TrustStrip />

      <Section id="lead-form" className="scroll-mt-24 py-16">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <SectionHeading
              eyebrow="Quick inquiry"
              title="Ask about any vehicle"
              description="Tell us what you're looking for. We'll confirm availability and reach out fast."
            />
            <div className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-sm">
              <p className="text-sm font-medium text-ink-100">Prefer to talk?</p>
              <p className="mt-1 text-sm text-ink-400">
                Call or message us — we answer quickly during business hours.
              </p>
              <p className="mt-3 font-display text-lg font-semibold text-ink-100">
                +1 (416) 555-0100
              </p>
            </div>
          </div>
          <PublicInquiryForm variant="general" />
        </div>
      </Section>
    </>
  );
}
