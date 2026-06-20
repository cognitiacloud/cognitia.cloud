import type { Metadata } from 'next';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { CustomerMapperView } from '@/components/customer/CustomerMapperView';
import type { Customer } from '@/types';
import customersRaw from '@/data/customers.json';

const CUSTOMERS = customersRaw as Customer[];

export const metadata: Metadata = {
  title: 'Customers',
  description: 'Customer memory — vehicles, family context, preferences, and next best action.',
};

export default function PortalCustomersPage() {
  return (
    <>
      <PortalPageHeader
        eyebrow="Customer Mapper"
        title="Remember every customer"
        description="Vehicle, family, preferences, concerns — and the next best action to earn the repurchase."
      />
      <CustomerMapperView customers={CUSTOMERS} />
    </>
  );
}
