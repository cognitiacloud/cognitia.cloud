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
      <ExplanationStrip />
      <InventoryPreview />
      <TrustStrip />

      <Section id="lead-form" className="scroll-mt-24 py-16">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <SectionHeading
              eyebrow="Live demo"
              title="Capture a lead in seconds"
              description="Every inquiry is scored and routed the moment it's submitted — then it appears in the dashboard."
            />
            <ComplianceNotice variant="compact" className="mt-6" />
          </div>
          <LeadForm />
        </div>
      </Section>
    </>
  );
}
