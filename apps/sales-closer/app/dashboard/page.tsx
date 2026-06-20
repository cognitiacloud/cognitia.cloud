import { dashboardOutcomes } from '@/lib/queries';
import { Card, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const d = await dashboardOutcomes();

  return (
    <div className="space-y-6">
      <PageHeader title="Call outcome dashboard" subtitle="Aggregated vendor activity" />

      <div className="grid grid-cols-4 gap-4">
        <Stat label="Calls with outcome" value={d.totalCalls} />
        <Stat label="Meetings booked" value={d.booked} />
        <Stat label="Booking rate" value={`${d.bookingRate}%`} />
        <Stat label="DNC requests" value={d.dnc} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card title="Outcomes">
          <BarList rows={d.byOutcome.map((o) => ({ label: o.outcome ?? '—', count: o.count }))} />
        </Card>
        <Card title="Events">
          <BarList rows={d.byEvent.map((e) => ({ label: e.eventType, count: e.count }))} />
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <p className="text-xs uppercase text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
    </Card>
  );
}

function BarList({ rows }: { rows: { label: string; count: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="space-y-2 text-sm">
      {rows.map((r) => (
        <li key={r.label} className="flex items-center gap-3">
          <span className="w-32 shrink-0 text-slate-600">{r.label}</span>
          <span className="h-3 rounded bg-indigo-500" style={{ width: `${(r.count / max) * 100}%` }} />
          <span className="text-xs text-slate-400">{r.count}</span>
        </li>
      ))}
      {rows.length === 0 && <li className="text-slate-400">No data yet.</li>}
    </ul>
  );
}
