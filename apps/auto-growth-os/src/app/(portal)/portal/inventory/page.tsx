import type { Metadata } from 'next';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { InventoryAdminTable } from '@/components/portal/InventoryAdminTable';

export const metadata: Metadata = { title: 'Inventory' };

export default function PortalInventoryPage() {
  return (
    <>
      <PortalPageHeader
        eyebrow="Inventory"
        title="Inventory manager"
        description="Draft, attest sensitive fields, approve, and publish vehicles to the public site."
        actions={
          <ButtonLink href="/portal/inventory/new" variant="gold" size="sm">
            Add vehicle
          </ButtonLink>
        }
      />
      <InventoryAdminTable />
    </>
  );
}
