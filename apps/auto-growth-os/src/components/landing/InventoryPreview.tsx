// components/landing/InventoryPreview.tsx
import { Section, SectionHeading } from '@/components/ui/Section';
import { Reveal } from '@/components/ui/Reveal';
import { VehicleCard } from '@/components/landing/VehicleCard';
import type { Vehicle } from '@/types';
import vehiclesRaw from '@/data/vehicles.json';

const VEHICLES = vehiclesRaw as Vehicle[];

export function InventoryPreview() {
  return (
    <Section className="py-16">
      <div className="mb-8 flex items-end justify-between gap-4">
        <SectionHeading
          eyebrow="Featured inventory"
          title="Fresh arrivals on the lot"
          description="A fast, mobile-first storefront — every card links straight to instant help."
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {VEHICLES.map((vehicle, i) => (
          <Reveal key={vehicle.id} delayMs={i * 60}>
            <VehicleCard vehicle={vehicle} />
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
