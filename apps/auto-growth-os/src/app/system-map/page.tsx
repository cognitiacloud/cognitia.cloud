import type { Metadata } from 'next';
import { Section, SectionHeading } from '@/components/ui/Section';
import { SystemFlow } from '@/components/system/SystemFlow';
import { ComplianceNotice } from '@/components/brand/ComplianceNotice';

export const metadata: Metadata = {
  title: 'System Map',
  description:
    'How the Cognitia Auto Growth OS connects traffic, capture, qualify, nurture, book, close, and retain over a shared customer data layer.',
};

export default function SystemMapPage() {
  return (
    <div className="py-14 sm:py-20">
      <Section>
        <SectionHeading
          eyebrow="System map"
          title="One pipeline, one memory"
          description="From first click to repurchase — every step reads and writes one shared customer record."
        />
      </Section>

      <Section className="mt-10">
        <SystemFlow />
      </Section>

      <Section className="mt-12">
        <ComplianceNotice />
      </Section>
    </div>
  );
}
