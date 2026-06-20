import type { Metadata } from 'next';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { InventoryForm } from '@/components/portal/InventoryForm';

export const metadata: Metadata = { title: 'New vehicle' };

export default function NewVehiclePage() {
  return (
    <>
      <PortalPageHeader
        eyebrow="Inventory"
        title="Add a vehicle"
        description="Enter specs, attest the sensitive fields, then approve and publish."
      />
      <InventoryForm />
    </>
  );
}
