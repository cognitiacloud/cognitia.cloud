import type { Metadata } from 'next';
import { LeadWorkspace } from '@/components/portal/LeadWorkspace';

export const metadata: Metadata = { title: 'Lead' };

export default async function PortalLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LeadWorkspace leadId={id} />;
}
