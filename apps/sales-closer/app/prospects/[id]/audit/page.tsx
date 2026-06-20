import { notFound } from 'next/navigation';
import { getWebsiteAuditSignals } from '@/lib/queries';
import { getAccountDetail } from '@/lib/queries';
import { Badge, BackLink, Card, PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';

/**
 * Website audit screen. Renders the `website_audit` signals, including the
 * screenshot QC produced by the hermes vision-skill (privacy/PII flags,
 * quality metrics) via packages/vision.
 */
export default async function AuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getAccountDetail(id);
  if (!detail) notFound();

  const signals = await getWebsiteAuditSignals(id);
  const audits = signals.filter((s) => s.type === 'website_audit');

  return (
    <div className="space-y-6">
      <BackLink href={`/prospects/${id}`} label={detail.account.displayName} />
      <PageHeader title="Website audit" subtitle={detail.account.domain} />

      {audits.length === 0 && (
        <Card>
          <p className="text-sm text-slate-400">
            No website-audit signals captured yet. Run a scrape that includes the screenshot QC
            step.
          </p>
        </Card>
      )}

      {audits.map((a) => {
        const v = a.value as {
          lighthousePerf?: number;
          hasLiveChat?: boolean;
          privacyFlags?: string[];
        };
        return (
          <Card key={a.id} title={`Audit · ${a.source ?? 'unknown source'}`}>
            <dl className="grid grid-cols-3 gap-4 text-sm">
              <Metric label="Lighthouse perf" value={v.lighthousePerf?.toString() ?? '—'} />
              <Metric label="Live chat" value={v.hasLiveChat ? 'Yes' : 'No'} />
              <Metric
                label="Privacy flags"
                value={(v.privacyFlags?.length ?? 0).toString()}
              />
            </dl>
            <div className="mt-3 flex flex-wrap gap-2">
              {(v.privacyFlags ?? []).map((f) => (
                <Badge key={f}>{f}</Badge>
              ))}
              {(v.privacyFlags?.length ?? 0) === 0 && (
                <span className="text-xs text-emerald-600">No PII / privacy issues detected.</span>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-slate-400">{label}</dt>
      <dd className="text-lg font-semibold">{value}</dd>
    </div>
  );
}
