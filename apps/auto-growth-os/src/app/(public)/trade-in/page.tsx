import type { Metadata } from 'next';
import { Section, SectionHeading } from '@/components/ui/Section';
import { PublicInquiryForm } from '@/components/public/PublicInquiryForm';

export const metadata: Metadata = {
  title: 'Trade-In',
  description:
    'Submit your trade-in details for review. Any estimate is confirmed after the dealership reviews the vehicle.',
};

const POINTS = [
  'Share your vehicle details for review',
  'No obligation — just start the conversation',
  'A value is confirmed after the dealership reviews the vehicle',
];

export default function TradeInPage() {
  return (
    <div className="py-12 sm:py-16">
      <Section>
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <SectionHeading
              eyebrow="Trade-In"
              title="Submit trade-in details for review"
              description="Tell us about your current vehicle. We'll review the details — any estimate is confirmed after the dealership reviews the vehicle and condition."
            />
            <ul className="mt-6 space-y-2.5">
              {POINTS.map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-sm text-ink-300">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" />
                  {p}
                </li>
              ))}
            </ul>
            <p className="mt-6 rounded-xl border border-line bg-surface-2 px-4 py-3 text-xs leading-relaxed text-ink-400">
              We don&apos;t provide instant guaranteed values online. A trade-in value is confirmed
              after an in-person or detailed review.
            </p>
          </div>
          <PublicInquiryForm variant="trade_in" />
        </div>
      </Section>
    </div>
  );
}
