import type { Metadata } from 'next';
import { Section, SectionHeading } from '@/components/ui/Section';
import { faqJsonLd, jsonLdScript } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'FAQ',
  description:
    'Common questions about buying, financing, trade-ins, availability, and test drives.',
};

const FAQS = [
  {
    q: 'Can I ask about financing online?',
    a: 'Yes — you can start a finance conversation online. Options are reviewed with our team, and any approval is confirmed by the dealership or finance provider on approved credit.',
  },
  {
    q: 'Can I trade in my current vehicle?',
    a: 'Yes. Submit your trade-in details for review. A value is confirmed after the dealership reviews the vehicle and its condition.',
  },
  {
    q: 'Who confirms vehicle availability?',
    a: 'The dealership confirms current availability. We recommend confirming before you visit.',
  },
  {
    q: 'How often is inventory updated?',
    a: 'Inventory is updated regularly. For the most current availability, contact our team.',
  },
  {
    q: 'Are prices final?',
    a: 'Pricing is confirmed with the dealership and may not include taxes, fees, or applicable charges.',
  },
  {
    q: 'Can I book a test drive online?',
    a: 'Yes. Choose a vehicle and a preferred time, and we’ll confirm the appointment with you.',
  },
];

export default function FaqPage() {
  return (
    <div className="py-12 sm:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLdScript(faqJsonLd(FAQS))} />
      <Section>
        <SectionHeading
          eyebrow="FAQ"
          title="Questions, answered"
          description="Helpful answers about how buying, financing, and trade-ins work with us."
        />
        <div className="mt-8 max-w-3xl space-y-3">
          {FAQS.map((f) => (
            <details
              key={f.q}
              className="group rounded-2xl border border-line bg-surface p-5 shadow-sm"
            >
              <summary className="cursor-pointer list-none font-display text-base font-semibold text-ink-100">
                {f.q}
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-ink-400">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>
    </div>
  );
}
