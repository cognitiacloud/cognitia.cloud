import type { Metadata } from 'next';
import { CustomerDetailView } from '@/components/customer/CustomerDetailView';
import type { Customer } from '@/types';
import customersRaw from '@/data/customers.json';

const CUSTOMERS = customersRaw as Customer[];

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
  // Detail is store-backed (client) so runtime-captured customers resolve too;
  // metadata above is best-effort from the static seed for SEO.
  return <CustomerDetailView id={id} />;
}
