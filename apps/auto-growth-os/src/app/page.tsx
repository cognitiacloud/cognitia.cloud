import { Hero } from '@/components/landing/Hero';
import { InventoryPreview } from '@/components/landing/InventoryPreview';
import { ExplanationStrip } from '@/components/landing/ExplanationStrip';
import { TrustStrip } from '@/components/landing/TrustStrip';
import { LeadForm } from '@/components/landing/LeadForm';
import { Section, SectionHeading } from '@/components/ui/Section';
import { ComplianceNotice } from '@/components/brand/ComplianceNotice';

export default function HomePage() {
  return (
    <>
      <Hero />
      <InventoryPreview />
      <ExplanationStrip />
      <TrustStrip />

      <Section id="lead-form" className="scroll-mt-24 py-16">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <SectionHeading
              eyebrow="Instant help"
              title="Tell us what you're looking for"
              description="Share a few details and we'll match inventory, prep financing, and reach out fast. Your inquiry is scored and routed the moment you hit send."
            />
            <ComplianceNotice variant="compact" className="mt-6" />
          </div>
          <LeadForm />
        </div>
      </Section>
    </>
  );
}
