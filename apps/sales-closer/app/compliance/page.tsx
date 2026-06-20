import { listComplianceLogs } from '@/lib/queries';
import { Badge, Card, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function CompliancePage() {
  const logs = await listComplianceLogs();

  return (
    <div className="space-y-6">
      <PageHeader title="Compliance" subtitle="Append-only audit trail" />
      <Card title={`Audit log (${logs.length})`}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
              <th className="py-2">When</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Actor</th>
              <th>Lawful basis</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b border-slate-100">
                <td className="py-2 text-slate-500">{new Date(l.occurredAt).toLocaleString()}</td>
                <td>
                  <Badge>{l.action}</Badge>
                </td>
                <td className="text-slate-500">
                  {l.entityType}
                  {l.entityId ? `:${l.entityId.slice(0, 8)}` : ''}
                </td>
                <td>{l.actor}</td>
                <td className="text-slate-500">{l.lawfulBasis ?? '—'}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-slate-400">
                  No audit events yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
