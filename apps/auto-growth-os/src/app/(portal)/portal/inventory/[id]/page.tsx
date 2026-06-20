import type { Metadata } from 'next';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { InventoryForm } from '@/components/portal/InventoryForm';

export const metadata: Metadata = { title: 'Edit vehicle' };

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <PortalPageHeader
        eyebrow="Inventory"
        title="Edit vehicle"
        description="Update specs, attest sensitive fields, approve, and publish."
      />
      <InventoryForm vehicleId={id} />
    </>
  );
}
