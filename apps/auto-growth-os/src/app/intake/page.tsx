import type { Metadata } from 'next';
import { Section, SectionHeading } from '@/components/ui/Section';
import { IntakeQuestionnaire } from '@/components/intake/IntakeQuestionnaire';

export const metadata: Metadata = {
  title: 'Client Intake',
  description:
    'A 12-question dealership intake that generates a recommended package — Pilot, Growth, or Empire — with pricing, modules, and a launch timeline.',
};

export default function IntakePage() {
  return (
    <div className="py-14 sm:py-20">
      <Section>
        <SectionHeading
          eyebrow="Client intake"
          title="Scope your growth system"
          description="Twelve questions. One recommended build plan — with pricing, modules, and a timeline."
        />
      </Section>
      <Section className="mt-10">
        <IntakeQuestionnaire />
      </Section>
    </div>
  );
}
