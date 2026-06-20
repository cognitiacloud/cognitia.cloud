import type { Metadata } from 'next';
import { Section, SectionHeading } from '@/components/ui/Section';
import { DiscoveryConsole } from '@/components/discovery/DiscoveryConsole';
import { DISCLAIMERS } from '@/lib/copy';

export const metadata: Metadata = {
  title: 'Discovery',
  description:
    'The Auto Growth OS Discovery Console — answer a few questions, score readiness, and generate a recommended build plan.',
};

export default function DiscoveryPage() {
  return (
    <div className="py-12 sm:py-16">
      <Section>
        <SectionHeading
          eyebrow="Discovery"
          title="Auto Growth OS Discovery Console"
          description="Answer a few questions. We score readiness and generate a recommended build plan — then ask: is this what you meant?"
        />
        <div className="mt-8">
          <DiscoveryConsole />
        </div>
        <p className="mt-8 text-xs text-ink-500">{DISCLAIMERS.noGuarantees}</p>
      </Section>
    </div>
  );
}
