import Link from 'next/link';
import { listAccounts } from '@/lib/queries';
import { ActionButton } from '@/components/ActionButton';
import { Card, PageHeader, TierBadge } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function ProspectsPage() {
  const accounts = await listAccounts();

  return (
    <div>
      <PageHeader title="Prospects" subtitle={`${accounts.length} accounts`} />
      <Card
        title="Accounts"
        action={
          <ActionButton endpoint="/api/scrape-runs" body={{ source: 'apify/google-maps-scraper' }}>
            Start scrape run
          </ActionButton>
        }
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
              <th className="py-2">Company</th>
              <th>Domain</th>
              <th>Industry</th>
              <th>Size</th>
              <th>Score</th>
              <th>Tier</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="py-2 font-medium">
                  <Link href={`/prospects/${a.id}`} className="text-indigo-600 hover:underline">
                    {a.displayName}
                  </Link>
                </td>
                <td className="text-slate-500">{a.domain}</td>
                <td>{a.industry ?? '—'}</td>
                <td>{a.employeeRange ?? '—'}</td>
                <td>{a.latestScore ? Number(a.latestScore.score).toFixed(0) : '—'}</td>
                <td>
                  <TierBadge tier={a.latestScore?.tier} />
                </td>
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-400">
                  No prospects yet. Start a scrape run to populate the pipeline.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
