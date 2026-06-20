'use client';

// components/public/InventoryBrowser.tsx
// Client-side filtering over the published inventory (make / body / price).
import { useMemo, useState } from 'react';
import type { Vehicle } from '@/types';
import { VehicleCard } from '@/components/landing/VehicleCard';
import { Select } from '@/components/ui/Field';

export function InventoryBrowser({ vehicles }: { vehicles: Vehicle[] }) {
  const [make, setMake] = useState('All');
  const [body, setBody] = useState('All');
  const [maxPrice, setMaxPrice] = useState('Any');

  const makes = ['All', ...Array.from(new Set(vehicles.map((v) => v.make))).sort()];
  const bodies = ['All', ...Array.from(new Set(vehicles.map((v) => v.bodyType))).sort()];
  const priceCaps = ['Any', '25000', '30000', '35000'];

  const filtered = useMemo(
    () =>
      vehicles.filter(
        (v) =>
          (make === 'All' || v.make === make) &&
          (body === 'All' || v.bodyType === body) &&
          (maxPrice === 'Any' || v.priceCad <= Number(maxPrice)),
      ),
    [vehicles, make, body, maxPrice],
  );

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
        <label className="flex-1">
          <span className="mb-1 block text-xs font-medium text-ink-500">Make</span>
          <Select value={make} onChange={(e) => setMake(e.target.value)}>
            {makes.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </Select>
        </label>
        <label className="flex-1">
          <span className="mb-1 block text-xs font-medium text-ink-500">Body type</span>
          <Select value={body} onChange={(e) => setBody(e.target.value)}>
            {bodies.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </Select>
        </label>
        <label className="flex-1">
          <span className="mb-1 block text-xs font-medium text-ink-500">Max price (CAD)</span>
          <Select value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)}>
            {priceCaps.map((p) => (
              <option key={p} value={p}>
                {p === 'Any' ? 'Any' : `$${Number(p).toLocaleString()}`}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <p className="mt-4 text-sm text-ink-400">
        {filtered.length} vehicle{filtered.length === 1 ? '' : 's'}
      </p>

      <div className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((v) => (
          <VehicleCard key={v.id} vehicle={v} />
        ))}
      </div>
      {filtered.length === 0 && (
        <p className="mt-6 rounded-xl border border-line bg-surface-2 p-6 text-center text-sm text-ink-400">
          No vehicles match those filters. Try widening your search.
        </p>
      )}
    </div>
  );
}
