import Link from 'next/link';
import { getFeaturedAccountId } from '@/lib/queries';
import { Badge, Card, PageHeader, SafetyBanner } from '@/components/ui';

export const dynamic = 'force-dynamic';

type Step = {
  n: number;
  title: string;
  blurb: string;
  href: string;
  cta: string;
  badge: { label: string; tone: 'navy' | 'mint' | 'gold' | 'amber' };
};

export default async function DemoPage() {
  const id = await getFeaturedAccountId();
  const account = id ? `/prospects/${id}` : '/prospects';

  const steps: Step[] = [
    {
      n: 1,
      title: 'Source & observed evidence',
      blurb:
        'A prospect is sourced and enriched from public signals — site traffic, review reputation, tech stack, and a website funnel audit. These are scraped, verifiable facts, kept distinct from anything the model infers.',
      href: account,
      cta: 'View the account & evidence',
      badge: { label: 'Source data', tone: 'navy' },
    },
    {
      n: 2,
      title: 'Fit score & priority tier',
      blurb:
        'A deterministic scorer turns the evidence into a 0–100 fit score and an A–D tier, so reps work the highest-intent dealerships first instead of guessing.',
      href: account,
      cta: 'See the fit score',
      badge: { label: 'Scored', tone: 'gold' },
    },
    {
      n: 3,
      title: 'AI closer brief',
      blurb:
        'The model drafts a closer brief — likely pain, recommended offer, talk track, objection handling, and a personalized email. Every AI section is labelled as inference to be reviewed, never presented as fact.',
      href: id ? `${account}/brief` : '/prospects',
      cta: 'Open the closer brief',
      badge: { label: 'AI generated', tone: 'mint' },
    },
    {
      n: 4,
      title: 'Human approval gate',
      blurb:
        'Nothing is sent automatically. Every draft lands in the approval queue, where a person approves or rejects it before any vendor handoff. Suppressed (DNC / unsubscribed) contacts never reach this stage.',
      href: '/approvals',
      cta: 'Go to the approval queue',
      badge: { label: 'Human-in-the-loop', tone: 'amber' },
    },
    {
      n: 5,
      title: 'Compliance & audit trail',
      blurb:
        'Consent basis, provenance, and suppression are tracked per contact, and every state change is written to an append-only audit log. Outcomes on the dashboard are reconciled from signed vendor webhooks.',
      href: '/compliance',
      cta: 'Open the compliance panel',
      badge: { label: 'Governance', tone: 'navy' },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Guided demo"
        title="Boardroom walkthrough"
        subtitle="The human-supervised closer pipeline, end to end — from scraped evidence to a logged, approved handoff."
      />

      <SafetyBanner tone="mint" title="Safe demo mode — nothing here is live">
        This walkthrough runs on mocked data. No calls, emails, or scrapes are sent. It shows how the
        engine separates observed evidence from AI inference, and keeps a human in control of every
        outbound action.
      </SafetyBanner>

      <ol className="space-y-4">
        {steps.map((s) => (
          <li key={s.n}>
            <Card>
              <div className="flex items-start gap-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-base font-bold text-navy">
                  {s.n}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-ink">{s.title}</h3>
                    <Badge tone={s.badge.tone}>{s.badge.label}</Badge>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{s.blurb}</p>
                  <Link
                    href={s.href}
                    className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-mint-600 hover:text-mint"
                  >
                    {s.cta} <span aria-hidden>→</span>
                  </Link>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ol>

      <Card title="Where to start">
        <p className="text-sm text-slate-600">
          Jump straight into the highest-priority prospect, or browse the full pipeline.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={account}
            className="rounded-lg bg-navy px-3.5 py-2 text-sm font-semibold text-white hover:bg-navy-700"
          >
            Open the featured prospect
          </Link>
          <Link
            href="/prospects"
            className="rounded-lg border border-navy/15 px-3.5 py-2 text-sm font-semibold text-navy hover:bg-navy-50"
          >
            Browse all prospects
          </Link>
        </div>
      </Card>
    </div>
  );
}
