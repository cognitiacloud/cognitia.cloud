'use client';

// components/portal/ReportsView.tsx
import { useAppState } from '@/lib/store/useAppState';
import { computeKpis } from '@/lib/metrics';
import { DashboardKpiCard } from '@/components/dashboard/DashboardKpiCard';
import { DisclosureNote } from '@/components/portal/DisclosureNote';

const REPORTS = [
  { title: 'Lead source report', detail: 'Where captured leads came from this period.' },
  { title: 'Response-time snapshot', detail: 'First-response times against the SLA target.' },
  { title: 'Inventory publishing report', detail: 'Vehicles drafted, approved, and published.' },
  { title: 'Approvals report', detail: 'AI drafts reviewed, approved, edited, or rejected.' },
  { title: 'Content & social drafts', detail: 'Drafts produced and their approval status.' },
  { title: 'SEO foundation checklist', detail: 'Structured data, metadata, and page coverage.' },
];

export function ReportsView() {
  const { leads, proofEvents, approvals, vehicles } = useAppState();
  const kpis = computeKpis(leads);
  const published = vehicles.filter((v) => v.publishedStatus === 'published').length;
  const decided = approvals.filter((a) => a.status !== 'pending').length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <DashboardKpiCard label="New leads" value={kpis.newLeadsToday} accent="gold" />
        <DashboardKpiCard label="Qualified" value={kpis.qualifiedLeads} accent="cyan" />
        <DashboardKpiCard label="Appointments" value={kpis.appointmentsBooked} accent="mint" />
        <DashboardKpiCard label="Proof events" value={proofEvents.length} accent="cyan" />
        <DashboardKpiCard label="Published" value={published} accent="mint" />
        <DashboardKpiCard label="Approvals" value={decided} accent="gold" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <div key={r.title} className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
            <p className="font-display text-sm font-semibold text-ink-100">{r.title}</p>
            <p className="mt-1 text-sm text-ink-400">{r.detail}</p>
            <p className="mt-3 text-xs font-medium text-cyan-700">Proof-backed →</p>
          </div>
        ))}
      </div>

      <DisclosureNote>
        This report summarizes captured activity, workflow status, and operational improvements. It
        does not guarantee sales, leads, ROI, rankings, financing approvals, or customer decisions.
      </DisclosureNote>
    </div>
  );
}
