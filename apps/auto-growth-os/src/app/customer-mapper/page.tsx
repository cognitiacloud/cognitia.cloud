import type { Metadata } from 'next';
import { Section, SectionHeading } from '@/components/ui/Section';
import { CustomerMapperView } from '@/components/customer/CustomerMapperView';
import type { Customer } from '@/types';
import customersRaw from '@/data/customers.json';

const CUSTOMERS = customersRaw as Customer[];

export const metadata: Metadata = {
  title: 'Customer Mapper',
  description:
    'Customer memory profiles — vehicles owned, family context, preferences, concerns, and the next best action to earn the repurchase.',
};

export default function CustomerMapperPage() {
  return (
    <div className="py-14 sm:py-20">
      <Section>
        <SectionHeading
          eyebrow="Customer Mapper"
          title="Remember every customer"
          description="Vehicle, family, preferences, concerns — and the next best action to earn the repurchase."
        />
      </Section>

      <Section className="mt-10">
        <CustomerMapperView customers={CUSTOMERS} />
      </Section>
    </div>
  );
}
