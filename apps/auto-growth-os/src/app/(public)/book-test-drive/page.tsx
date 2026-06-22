import type { Metadata } from 'next';
import { Section, SectionHeading } from '@/components/ui/Section';
import { PublicInquiryForm } from '@/components/public/PublicInquiryForm';

export const metadata: Metadata = {
  title: 'Book a Test Drive',
  description: 'Request a test drive. Tell us the vehicle and a preferred time, and we’ll confirm.',
};

export default function BookTestDrivePage() {
  return (
    <div className="py-12 sm:py-16">
      <Section>
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <SectionHeading
              eyebrow="Test drive"
              title="Book a test drive"
              description="Pick a vehicle and a preferred time. We’ll confirm availability and the appointment with you."
            />
            <p className="mt-6 rounded-xl border border-line bg-surface-2 px-4 py-3 text-xs leading-relaxed text-ink-400">
              Appointment times are confirmed by the dealership. Vehicle availability should be
              confirmed before you visit.
            </p>
          </div>
          <PublicInquiryForm variant="test_drive" />
        </div>
      </Section>
    </div>
  );
}
