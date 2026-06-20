import { listComplianceLogs, listConsentRecords } from '@/lib/queries';
import { Badge, Card, PageHeader, SafetyBanner, StatTile } from '@/components/ui';

export const dynamic = 'force-dynamic';

const CONSENT_TONE = {
  opted_in: 'green',
  opted_out: 'amber',
  dnc: 'red',
  unknown: 'neutral',
} as const;

export default async function CompliancePage() {
  const [logs, consent] = await Promise.all([listComplianceLogs(), listConsentRecords()]);

  const dncCount = consent.filter((c) => c.contact.consentStatus === 'dnc').length;
  const unsubCount = consent.filter((c) => c.contact.consentStatus === 'opted_out').length;
  const contactable = consent.filter((c) => c.contact.consentStatus === 'opted_in').length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Governance"
        title="Compliance panel"
        subtitle="Consent basis, provenance, suppression, and an append-only audit trail."
      />

      <SafetyBanner tone="navy" title="Human approval gate is enforced">
        Every outreach draft is generated with a recorded lawful basis and must be approved by a
        person before any vendor handoff. DNC and unsubscribe states suppress all future outreach.
      </SafetyBanner>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Contactable" value={contactable} tone="green" hint="Opted-in (B2B)" />
        <StatTile label="Unsubscribed" value={unsubCount} tone="amber" hint="Email suppressed" />
        <StatTile label="Do-not-contact" value={dncCount} tone="red" hint="All channels suppressed" />
        <StatTile label="Audit events" value={logs.length} hint="Append-only" />
      </div>

      <Card title="Consent & provenance" subtitle="Per-contact basis and source">
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-navy/10 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-5 py-2.5 font-semibold">Contact</th>
                <th className="py-2.5 font-semibold">Account</th>
                <th className="py-2.5 font-semibold">Consent basis</th>
                <th className="py-2.5 font-semibold">DNC</th>
                <th className="py-2.5 font-semibold">Unsubscribe</th>
                <th className="px-5 py-2.5 font-semibold">Source</th>
              </tr>
            </thead>
            <tbody>
              {consent.map(({ contact, account }) => {
                const e = (account.enrichment ?? {}) as Record<string, unknown>;
                const isDnc = contact.consentStatus === 'dnc';
                const isUnsub = contact.consentStatus === 'opted_out';
                return (
                  <tr key={contact.id} className="border-b border-navy/5 last:border-0">
                    <td className="px-5 py-3">
                      <p className="font-medium text-ink">{contact.fullName}</p>
                      <p className="text-xs text-slate-400">{contact.title}</p>
                    </td>
                    <td className="py-3 text-slate-600">{account.displayName}</td>
                    <td className="py-3">
                      <Badge tone={CONSENT_TONE[contact.consentStatus]}>
                        {contact.consentStatus === 'opted_in'
                          ? 'Legitimate interest (B2B)'
                          : contact.consentStatus.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="py-3">
                      {isDnc ? (
                        <span className="font-medium text-rose-600">Suppressed</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3">
                      {isUnsub ? (
                        <span className="font-medium text-amber-600">Suppressed</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <a
                        className="text-mint-600 hover:underline"
                        href={String(e.sourceUrl ?? '#')}
                      >
                        {String(e.source ?? 'Source')}
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={`Audit trail (${logs.length})`} subtitle="Append-only — immutable record">
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-navy/10 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-5 py-2.5 font-semibold">When</th>
                <th className="py-2.5 font-semibold">Action</th>
                <th className="py-2.5 font-semibold">Actor</th>
                <th className="py-2.5 font-semibold">Lawful basis</th>
                <th className="px-5 py-2.5 font-semibold">Detail</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => {
                const d = (l.details ?? {}) as Record<string, unknown>;
                const detail =
                  (d.businessRelevance as string) ?? (d.note as string) ?? (d.sourceUrl as string) ?? '';
                return (
                  <tr key={l.id} className="border-b border-navy/5 last:border-0 align-top">
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {new Date(l.occurredAt).toLocaleString()}
                    </td>
                    <td className="py-3">
                      <Badge tone={actionTone(l.action)}>{l.action.replace(/_/g, ' ')}</Badge>
                    </td>
                    <td className="py-3 text-slate-500">{l.actor}</td>
                    <td className="py-3 text-slate-500">{l.lawfulBasis ?? '—'}</td>
                    <td className="px-5 py-3 max-w-md text-xs text-slate-500">{detail}</td>
                  </tr>
                );
              })}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                    No audit events yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function actionTone(action: string): 'green' | 'amber' | 'red' | 'mint' | 'navy' | 'neutral' {
  if (action.includes('dnc')) return 'red';
  if (action.includes('unsubscribe')) return 'amber';
  if (action.includes('approved')) return 'green';
  if (action.includes('brief') || action.includes('scored')) return 'mint';
  if (action.includes('collected')) return 'navy';
  return 'neutral';
}
