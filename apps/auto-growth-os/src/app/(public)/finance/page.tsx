import type { Metadata } from 'next';
import { Section, SectionHeading } from '@/components/ui/Section';
import { PublicInquiryForm } from '@/components/public/PublicInquiryForm';

export const metadata: Metadata = {
  title: 'Financing',
  description:
    'Start a finance conversation. Request a callback — financing options are reviewed with our team on approved credit.',
};

const POINTS = [
  'Start the conversation online in minutes',
  'Share your budget or monthly comfort (optional)',
  'A team member follows up to review options',
];

export default function FinancePage() {
  return (
    <div className="py-12 sm:py-16">
      <Section>
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <SectionHeading
              eyebrow="Financing"
              title="Start a finance conversation"
              description="Request a finance callback. We'll review options with you — approvals are confirmed by the dealership or finance provider on approved credit."
            />
            <ul className="mt-6 space-y-2.5">
              {POINTS.map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-sm text-ink-300">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-400" />
                  {p}
                </li>
              ))}
            </ul>
            <p className="mt-6 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.05] px-4 py-3 text-xs leading-relaxed text-ink-400">
              We never promise guaranteed approval. Financing terms and approvals are confirmed by
              the dealership or finance provider.
            </p>
          </div>
          <PublicInquiryForm variant="finance" />
        </div>
      </Section>
    </div>
  );
}
