import { dashboardOutcomes } from '@/lib/queries';
import { Card, PageHeader, SafetyBanner, StatTile } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const d = await dashboardOutcomes();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Outcomes"
        title="Call outcome dashboard"
        subtitle="Aggregated vendor activity, reconciled from signed webhook events."
      />

      <SafetyBanner tone="navy" title="Outcomes come from the vendor, not from us">
        Every number below is derived from vendor webhook events recorded in the append-only audit
        trail — no outcome is inferred or edited by hand.
      </SafetyBanner>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Calls with outcome" value={d.totalCalls} hint="Completed vendor calls" />
        <StatTile label="Meetings booked" value={d.booked} tone="mint" hint="booked_meeting" />
        <StatTile label="Booking rate" value={`${d.bookingRate}%`} tone="gold" hint="Of calls with outcome" />
        <StatTile label="DNC requests" value={d.dnc} tone="red" hint="Suppressed going forward" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Outcomes" subtitle="By call result">
          <BarList
            rows={d.byOutcome.map((o) => ({ label: o.outcome ?? '—', count: o.count }))}
            bar="bg-mint"
          />
        </Card>
        <Card title="Events" subtitle="By vendor event type">
          <BarList
            rows={d.byEvent.map((e) => ({ label: e.eventType, count: e.count }))}
            bar="bg-navy-600"
          />
        </Card>
      </div>
    </div>
  );
}

function BarList({
  rows,
  bar = 'bg-navy-600',
}: {
  rows: { label: string; count: number }[];
  bar?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="space-y-2.5 text-sm">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-3">
          <span className="w-36 shrink-0 text-slate-600">{r.label.replace(/_/g, ' ')}</span>
          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-navy-50">
            <span
              className={`block h-full rounded-full ${bar}`}
              style={{ width: `${(r.count / max) * 100}%` }}
            />
          </span>
          <span className="w-6 text-right text-xs font-semibold tabular text-slate-500">
            {r.count}
          </span>
        </li>
      ))}
      {rows.length === 0 && <li className="text-slate-400">No data yet.</li>}
    </ul>
  );
}
