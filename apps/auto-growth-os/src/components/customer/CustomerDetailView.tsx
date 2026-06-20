'use client';

// components/customer/CustomerDetailView.tsx
// Store-backed customer profile. Resolves both seed and runtime-captured customers
// (created from public leads) and surfaces the leads linked to this customer.
import Link from 'next/link';
import { useAppState } from '@/lib/store/useAppState';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { CustomerProfile } from '@/components/customer/CustomerProfile';
import { CustomerTimeline } from '@/components/customer/CustomerTimeline';
import { StageBadge } from '@/components/ui/Badge';

export function CustomerDetailView({ id }: { id: string }) {
  const { customers, leads, mounted } = useAppState();
  const customer = customers.find((c) => c.id === id);

  if (!customer) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center">
        <p className="text-sm text-ink-400">
          {mounted ? 'Customer not found.' : 'Loading…'}{' '}
          <Link href="/portal/customers" className="text-cyan-700">
            Back to customers
          </Link>
        </p>
      </div>
    );
  }

  const relatedLeads = leads.filter((l) => l.customerId === id);

  return (
    <>
      <PortalPageHeader
        eyebrow="Customer memory"
        title={customer.name}
        description={customer.vehicle}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr] lg:items-start">
        <CustomerProfile customer={customer} />
        <div className="space-y-6">
          <CustomerTimeline events={customer.timeline} />
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <p className="font-display text-sm font-semibold text-ink-100">Related leads</p>
            {relatedLeads.length === 0 ? (
              <p className="mt-3 text-sm text-ink-400">
                No leads linked to this customer yet. Leads captured on the public site that match
                this contact will appear here.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {relatedLeads.map((l) => (
                  <li key={l.id}>
                    <Link
                      href={`/portal/leads/${l.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 transition hover:border-cyan-400/30"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-ink-100">
                          {l.vehicleInterest}
                        </span>
                        <span className="block text-xs text-ink-500">
                          {l.source} · score {l.score}
                        </span>
                      </span>
                      <StageBadge stage={l.stage} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
