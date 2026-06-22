// components/public/VehicleDetail.tsx
import Link from 'next/link';
import type { Vehicle } from '@/types';
import { formatCad, formatKm } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { PublicInquiryForm } from '@/components/public/PublicInquiryForm';
import { DISCLAIMERS } from '@/lib/copy';

const STATUS_TONE = { Available: 'mint', Reserved: 'gold', 'In Transit': 'cyan' } as const;

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-3">
      <dt className="text-xs uppercase tracking-wider text-ink-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-ink-100">{value}</dd>
    </div>
  );
}

export function VehicleDetail({ vehicle: v }: { vehicle: Vehicle }) {
  const title = `${v.year} ${v.make} ${v.model} ${v.trim}`;
  return (
    <div>
      <nav className="mb-4 text-sm text-ink-500">
        <Link href="/inventory" className="hover:text-cyan-700">
          Inventory
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-ink-300">{title}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div>
          <div
            className="relative flex h-64 items-center justify-center overflow-hidden rounded-2xl"
            style={{ backgroundImage: `linear-gradient(135deg, ${v.accent[0]}, ${v.accent[1]})` }}
          >
            <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_30%_20%,white,transparent_55%)]" />
            <svg
              viewBox="0 0 120 48"
              className="h-28 w-72 text-white/80"
              fill="currentColor"
              aria-hidden
            >
              <path d="M10 34c0-2 1-3 3-3h2l6-9c1-1.4 2.6-2.3 4.4-2.3h28c1.7 0 3.3.8 4.4 2.1l6.2 7.5 14 2.2c3 .5 5.4 3 5.4 6V37c0 1.7-1.3 3-3 3h-5a7 7 0 0 0-14 0H44a7 7 0 0 0-14 0h-7c-1.7 0-3-1.3-3-3v-3z" />
            </svg>
            <span className="absolute right-4 top-4">
              <Badge tone={STATUS_TONE[v.status]}>{v.status}</Badge>
            </span>
          </div>

          <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-ink-100">
                {title}
              </h1>
              <p className="mt-1 text-sm text-ink-400">
                Stock {v.stockNumber ?? '—'} · {formatKm(v.odometerKm)}
              </p>
            </div>
            <p className="font-display text-3xl font-bold text-gradient-gold">
              {formatCad(v.priceCad)}
            </p>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Spec label="Body" value={v.bodyType} />
            <Spec label="Drivetrain" value={v.drivetrain} />
            <Spec label="Transmission" value={v.transmission} />
            <Spec label="Fuel" value={v.fuelType} />
            <Spec label="Exterior" value={v.exteriorColor} />
            <Spec label="Odometer" value={formatKm(v.odometerKm)} />
          </dl>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {v.badges.map((b) => (
              <span key={b} className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-ink-300">
                {b}
              </span>
            ))}
            {v.carfaxAvailable && (
              <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-ink-300">
                CarFax on request
              </span>
            )}
          </div>

          <p className="mt-6 rounded-xl border border-line bg-surface-2 px-4 py-3 text-xs leading-relaxed text-ink-400">
            {DISCLAIMERS.confirmDetails}
          </p>
        </div>

        <div id="lead-form">
          <h2 className="mb-3 font-display text-lg font-semibold text-ink-100">
            Interested in this {v.make}?
          </h2>
          <PublicInquiryForm variant="test_drive" vehicleId={v.id} vehicleLabel={title} />
        </div>
      </div>
    </div>
  );
}
