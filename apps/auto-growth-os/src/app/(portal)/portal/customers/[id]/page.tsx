import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { CustomerProfile } from '@/components/customer/CustomerProfile';
import { CustomerTimeline } from '@/components/customer/CustomerTimeline';
import type { Customer } from '@/types';
import customersRaw from '@/data/customers.json';

const CUSTOMERS = customersRaw as Customer[];

export function generateStaticParams() {
  return CUSTOMERS.map((c) => ({ id: c.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const c = CUSTOMERS.find((x) => x.id === id);
  return { title: c ? c.name : 'Customer' };
}

export default async function PortalCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = CUSTOMERS.find((x) => x.id === id);
  if (!c) notFound();
  return (
    <>
      <PortalPageHeader eyebrow="Customer memory" title={c.name} description={c.vehicle} />
      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr] lg:items-start">
        <CustomerProfile customer={c} />
        <CustomerTimeline events={c.timeline} />
      </div>
    </>
  );
}
