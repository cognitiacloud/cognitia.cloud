import type { Metadata } from 'next';
import { Hero } from '@/components/landing/Hero';
import { ExplanationStrip } from '@/components/landing/ExplanationStrip';
import { TrustStrip } from '@/components/landing/TrustStrip';
import { Section, SectionHeading } from '@/components/ui/Section';
import { ButtonLink } from '@/components/ui/Button';
import { Reveal } from '@/components/ui/Reveal';
import { PricingCard } from '@/components/modules/PricingCard';
import { ComplianceNotice } from '@/components/brand/ComplianceNotice';
import type { Package } from '@/types';
import packagesRaw from '@/data/packages.json';
import { DISCLAIMERS, PRODUCT } from '@/lib/copy';

const PACKAGES = packagesRaw as Package[];

export const metadata: Metadata = {
  title: 'Dealership Growth OS',
  description:
    'Demandara Dealership Growth OS, powered by Cognitia — a public website, client intake, CRM-lite, and human-approved AI follow-up for dealerships.',
};

export default function DealershipGrowthOsPage() {
  return (
    <>
      <Hero />
      <ExplanationStrip />

      <Section className="py-16">
        <SectionHeading
          align="center"
          eyebrow="Packages"
          title="Start where you are"
          description="From a foundation website to a full operating system — transparent CAD pricing, advisory not cheap-SaaS."
        />
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {PACKAGES.map((p) => (
            <Reveal key={p.tier}>
              <PricingCard pkg={p} featured={p.tier === 'Growth'} />
            </Reveal>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/discovery" variant="gold" size="lg">
            Start Discovery
          </ButtonLink>
          <ButtonLink href="/modules" variant="outline" size="lg">
            See all modules
          </ButtonLink>
          <ButtonLink href="/meeting" variant="ghost" size="lg">
            Guided demo
          </ButtonLink>
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-center text-xs leading-relaxed text-ink-500">
          {DISCLAIMERS.adSpend} {DISCLAIMERS.noGuarantees}
        </p>
      </Section>

      <TrustStrip />

      <Section className="pb-4">
        <div className="rounded-2xl border border-line bg-surface p-6 text-center shadow-sm sm:p-8">
          <p className="font-display text-lg font-semibold text-ink-100">
            {PRODUCT.demandara} operates growth. {PRODUCT.cognitia} powers the proof.
          </p>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-ink-400">
            See the governance, approval gates, and proof ledger that sit under every workflow.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/powered-by-cognitia" variant="navy" size="md">
              Powered by Cognitia
            </ButtonLink>
            <ButtonLink href="/portal/dashboard" variant="outline" size="md">
              Open portal demo
            </ButtonLink>
          </div>
        </div>
      </Section>

      <Section className="py-12">
        <ComplianceNotice />
      </Section>
    </>
  );
}
