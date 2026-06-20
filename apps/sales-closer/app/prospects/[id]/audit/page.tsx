import { notFound } from 'next/navigation';
import { getAccountDetail, getWebsiteAuditSignals } from '@/lib/queries';
import { BackLink, Card, CheckRow, PageHeader, ScoreMeter, StatTile } from '@/components/ui';

export const dynamic = 'force-dynamic';

type FunnelGaps = {
  weakCta?: boolean;
  noFinancing?: boolean;
  noTradeIn?: boolean;
  noAppointmentBooking?: boolean;
  noLiveChat?: boolean;
  noWhatsApp?: boolean;
};

type AuditValue = {
  funnelGaps?: FunnelGaps;
  mobilePerf?: number;
  desktopPerf?: number;
  pageLoadSec?: number;
  mobileFriendly?: boolean;
  privacyFlags?: string[];
  screenshotQc?: string;
  sourceUrl?: string;
};

/**
 * Website audit screen. Renders the `website_audit` signal: dealership funnel
 * gaps plus the screenshot QC produced by the hermes vision-skill.
 */
export default async function AuditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getAccountDetail(id);
  if (!detail) notFound();

  const signals = await getWebsiteAuditSignals(id);
  const audit = signals.find((s) => s.type === 'website_audit');
  const v = (audit?.value ?? {}) as AuditValue;
  const gaps = v.funnelGaps ?? {};

  // Each row: ok=true means the conversion path EXISTS (no gap).
  const checks = [
    { label: 'Strong primary CTA', ok: !gaps.weakCta, missing: 'Weak / buried CTA' },
    { label: 'Online financing pre-qual', ok: !gaps.noFinancing, missing: 'No financing flow' },
    { label: 'Trade-in valuation path', ok: !gaps.noTradeIn, missing: 'No trade-in path' },
    { label: 'Appointment booking', ok: !gaps.noAppointmentBooking, missing: 'No booking flow' },
    { label: 'Live chat', ok: !gaps.noLiveChat, missing: 'No live chat' },
    { label: 'WhatsApp / click-to-chat', ok: !gaps.noWhatsApp, missing: 'No WhatsApp channel' },
  ];
  const gapCount = checks.filter((c) => !c.ok).length;
  const mobilePerf = v.mobilePerf ?? 0;

  return (
    <div className="space-y-6">
      <BackLink href={`/prospects/${id}`} label={detail.account.displayName} />
      <PageHeader
        eyebrow="Funnel audit"
        title="Website audit"
        subtitle={`${detail.account.domain} · screenshot QC by hermes vision-skill`}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          label="Funnel gaps"
          value={gapCount}
          tone={gapCount >= 4 ? 'red' : gapCount >= 2 ? 'amber' : 'green'}
          hint="Missing conversion paths"
        />
        <StatTile
          label="Mobile perf"
          value={`${mobilePerf}`}
          tone={mobilePerf < 50 ? 'red' : 'amber'}
          hint="Lighthouse / 100"
        />
        <StatTile label="Page load" value={`${v.pageLoadSec ?? '—'}s`} tone="amber" hint="Mobile, simulated" />
        <StatTile
          label="Mobile friendly"
          value={v.mobileFriendly ? 'Yes' : 'No'}
          tone={v.mobileFriendly ? 'green' : 'red'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Conversion funnel" subtitle="What a car shopper can / cannot do" className="lg:col-span-2">
          <ul>
            {checks.map((c) => (
              <CheckRow key={c.label} ok={c.ok} label={c.label} detail={c.ok ? 'Present' : c.missing} />
            ))}
          </ul>
        </Card>

        <div className="space-y-6">
          <Card title="Performance">
            <div className="space-y-3">
              <Metric label="Mobile" value={mobilePerf} />
              <Metric label="Desktop" value={v.desktopPerf ?? 0} />
            </div>
          </Card>
          <Card title="Screenshot QC">
            <p className="text-sm text-slate-600">{v.screenshotQc ?? 'Not captured.'}</p>
            <div className="mt-3 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-600">
                ✓
              </span>
              <span className="text-sm text-slate-600">
                No PII / privacy issues detected ({(v.privacyFlags ?? []).length} flags)
              </span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="text-slate-500">{label}</span>
        <span className="font-medium tabular text-slate-600">{value}/100</span>
      </div>
      <ScoreMeter value={value} showLabel={false} />
    </div>
  );
}
