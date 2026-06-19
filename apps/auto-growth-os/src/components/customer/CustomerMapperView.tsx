'use client';

// components/customer/CustomerMapperView.tsx
import { useState } from 'react';
import type { Customer } from '@/types';
import { CustomerProfile } from '@/components/customer/CustomerProfile';
import { CustomerTimeline } from '@/components/customer/CustomerTimeline';

export function CustomerMapperView({ customers }: { customers: Customer[] }) {
  const [activeId, setActiveId] = useState(customers[0]?.id);
  const active = customers.find((c) => c.id === activeId) ?? customers[0];
  if (!active) return null;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {customers.map((c) => {
          const selected = c.id === active.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveId(c.id)}
              className={`rounded-full border px-4 py-2 text-sm transition ${
                selected
                  ? 'border-gold-400/40 bg-gold-400/10 text-gold-200'
                  : 'border-white/10 bg-navy-850/50 text-ink-300 hover:border-cyan-400/30 hover:text-ink-100'
              }`}
            >
              {c.name}
              <span className="ml-2 hidden text-xs text-ink-500 sm:inline">
                {c.vehicle.split(' ').slice(0, 3).join(' ')}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2 lg:items-start">
        <CustomerProfile customer={active} />
        <CustomerTimeline events={active.timeline} />
      </div>
    </div>
  );
}
