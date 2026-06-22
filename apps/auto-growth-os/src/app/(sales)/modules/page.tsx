import type { Metadata } from 'next';
import { Section, SectionHeading } from '@/components/ui/Section';
import { Reveal } from '@/components/ui/Reveal';
import { ModuleCard } from '@/components/modules/ModuleCard';
import { PricingCard } from '@/components/modules/PricingCard';
import type { Module, Package } from '@/types';
import modulesRaw from '@/data/modules.json';
import packagesRaw from '@/data/packages.json';

const MODULES = modulesRaw as Module[];
const PACKAGES = packagesRaw as Package[];

export const metadata: Metadata = {
  title: 'Modules & Pricing',
  description:
    'Modular pricing for the Cognitia Auto Growth OS — pick the modules you need, or start with a Pilot, Growth, or Empire package.',
};

export default function ModulesPage() {
  return (
    <div className="py-14 sm:py-20">
      <Section>
        <SectionHeading
          eyebrow="Modules & pricing"
          title="Build your growth stack"
          description="Transparent CAD pricing. Start with a package, or add modules as you scale."
        />
      </Section>

      {/* Packages */}
      <Section className="mt-10">
        <div className="grid gap-5 lg:grid-cols-3">
          {PACKAGES.map((pkg) => (
            <Reveal key={pkg.tier}>
              <PricingCard pkg={pkg} featured={pkg.tier === 'Growth'} />
            </Reveal>
          ))}
        </div>
        <p className="mt-5 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.05] px-4 py-3 text-sm text-ink-300">
          <span className="font-medium text-cyan-700">Note:</span> Ad spend is paid directly by the
          client in their own Google / Meta accounts. Pass-through costs (hosting, API conversation
          fees, app store accounts) are billed at cost and listed on every module.
        </p>
      </Section>

      {/* Module menu */}
      <Section className="mt-16">
        <SectionHeading
          eyebrow="À la carte"
          title="Every module, explained"
          description="What each module does, what it costs to set up and run, pass-through costs, and how long delivery takes."
        />
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((module, i) => (
            <Reveal key={module.id} delayMs={(i % 3) * 60}>
              <ModuleCard module={module} />
            </Reveal>
          ))}
        </div>
      </Section>
    </div>
  );
}
