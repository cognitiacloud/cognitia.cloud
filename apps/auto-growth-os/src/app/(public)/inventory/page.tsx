import type { Metadata } from 'next';
import { Section, SectionHeading } from '@/components/ui/Section';
import { InventoryBrowser } from '@/components/public/InventoryBrowser';
import { publishedVehicles } from '@/lib/inventory';

export const metadata: Metadata = {
  title: 'Inventory',
  description:
    'Browse our published used-vehicle inventory. Filter by make, body type, and price, then check availability or book a test drive.',
};

export default function InventoryPage() {
  const vehicles = publishedVehicles();
  return (
    <div className="py-12 sm:py-16">
      <Section>
        <SectionHeading
          eyebrow="Inventory"
          title="Browse our vehicles"
          description="Certified, inspected used cars. Every listing opens a full vehicle page with specs and a lead form."
        />
        <div className="mt-8">
          <InventoryBrowser vehicles={vehicles} />
        </div>
      </Section>
    </div>
  );
}
