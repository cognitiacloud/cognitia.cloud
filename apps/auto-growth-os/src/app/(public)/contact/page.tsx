import type { Metadata } from 'next';
import { Section, SectionHeading } from '@/components/ui/Section';
import { PublicInquiryForm } from '@/components/public/PublicInquiryForm';
import { PRODUCT } from '@/lib/copy';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch with our team by form, phone, or message.',
};

export default function ContactPage() {
  return (
    <div className="py-12 sm:py-16">
      <Section>
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <SectionHeading
              eyebrow="Contact"
              title="Talk to our team"
              description="Send a message and we’ll get back to you quickly during business hours."
            />
            <div className="mt-6 space-y-3">
              <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
                <p className="text-sm font-medium text-ink-100">Call or message</p>
                <p className="mt-1 font-display text-lg font-semibold text-ink-100">
                  +1 (416) 555-0100
                </p>
                <p className="mt-1 text-sm text-ink-400">
                  {PRODUCT.dealer} · Toronto &amp; the GTA
                </p>
              </div>
              <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
                <p className="text-sm font-medium text-ink-100">Hours</p>
                <p className="mt-1 text-sm text-ink-400">Mon–Sat, 9am–7pm</p>
              </div>
            </div>
          </div>
          <PublicInquiryForm variant="contact" />
        </div>
      </Section>
    </div>
  );
}
