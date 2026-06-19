// components/landing/VehicleCard.tsx
import Link from 'next/link';
import type { Vehicle } from '@/types';
import { formatCad, formatKm } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';

const STATUS_TONE = {
  Available: 'mint',
  Reserved: 'gold',
  'In Transit': 'cyan',
} as const;

function CarGlyph() {
  return (
    <svg viewBox="0 0 120 48" className="h-16 w-40 text-white/80" fill="currentColor" aria-hidden>
      <path d="M10 34c0-2 1-3 3-3h2l6-9c1-1.4 2.6-2.3 4.4-2.3h28c1.7 0 3.3.8 4.4 2.1l6.2 7.5 14 2.2c3 .5 5.4 3 5.4 6V37c0 1.7-1.3 3-3 3h-5a7 7 0 0 0-14 0H44a7 7 0 0 0-14 0h-7c-1.7 0-3-1.3-3-3v-3z" />
      <circle cx="37" cy="38" r="5" className="text-navy-950" fill="currentColor" />
      <circle cx="79" cy="38" r="5" className="text-navy-950" fill="currentColor" />
    </svg>
  );
}

export function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-white/8 bg-navy-850/60 transition duration-200 hover:-translate-y-1 hover:border-cyan-400/30 hover:shadow-[0_24px_60px_-28px_rgba(54,210,230,0.4)]">
      <div
        className="relative flex h-36 items-center justify-center"
        style={{
          backgroundImage: `linear-gradient(135deg, ${vehicle.accent[0]}, ${vehicle.accent[1]})`,
        }}
      >
        <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_30%_20%,white,transparent_55%)]" />
        <CarGlyph />
        <div className="absolute right-3 top-3">
          <Badge tone={STATUS_TONE[vehicle.status]}>{vehicle.status}</Badge>
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold text-ink-100">
              {vehicle.year} {vehicle.make} {vehicle.model}
            </h3>
            <p className="text-sm text-ink-400">{vehicle.trim}</p>
          </div>
          <p className="font-display text-lg font-bold text-gradient-gold">
            {formatCad(vehicle.priceCad)}
          </p>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-2 text-xs text-ink-400">
          <div>
            <dt className="text-ink-500">Odometer</dt>
            <dd className="mt-0.5 text-ink-200">{formatKm(vehicle.odometerKm)}</dd>
          </div>
          <div>
            <dt className="text-ink-500">Drivetrain</dt>
            <dd className="mt-0.5 text-ink-200">{vehicle.drivetrain}</dd>
          </div>
          <div>
            <dt className="text-ink-500">Fuel</dt>
            <dd className="mt-0.5 text-ink-200">{vehicle.fuelType}</dd>
          </div>
        </dl>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex flex-wrap gap-1.5">
            {vehicle.badges.map((b) => (
              <span key={b} className="rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-ink-300">
                {b}
              </span>
            ))}
          </div>
          <Link
            href="#lead-form"
            className="text-sm font-medium text-cyan-300 transition group-hover:text-cyan-200"
          >
            Enquire →
          </Link>
        </div>
      </div>
    </article>
  );
}
