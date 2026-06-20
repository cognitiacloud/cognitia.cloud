import type { Metadata } from 'next';
import { Section, SectionHeading } from '@/components/ui/Section';
import { ButtonLink } from '@/components/ui/Button';
import { Reveal } from '@/components/ui/Reveal';
import { ComplianceNotice } from '@/components/brand/ComplianceNotice';
import { PRODUCT } from '@/lib/copy';

export const metadata: Metadata = {
  title: 'Powered by Cognitia',
  description:
    'Cognitia provides the Client OS infrastructure under Auto Growth OS — CRM-lite, agent economy, proof registry, action ledger, and human-approval gates.',
};

const CAPABILITIES = [
  {
    title: 'Client OS & CRM-lite',
    body: 'A command center for leads, customers, inventory, and appointments — one shared customer record.',
  },
  {
    title: 'Agent economy',
    body: 'Named agents with explicit allowed/forbidden actions, risk boundaries, and deny-by-default governance.',
  },
  {
    title: 'Human-approval gates',
    body: 'Sensitive claims (finance, trade-in, warranty, price, availability) never send without sign-off.',
  },
  {
    title: 'Proof registry',
    body: 'Every meaningful action becomes a proof event — measurable, reviewable, exportable.',
  },
  {
    title: 'Action ledger',
    body: 'An append-only record of who (human, agent, or system) did what, when, and at what risk.',
  },
  {
    title: 'Consent-aware automation',
    body: 'CASL-aware consent tracking and compliance text built into every workflow.',
  },
];

export default function PoweredByCognitiaPage() {
  return (
    <>
      <Section className="py-16 sm:py-20">
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-cyan-700 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            Infrastructure
          </span>
          <h1 className="mt-5 max-w-3xl font-display text-4xl font-bold leading-[1.05] tracking-tight text-ink-100 sm:text-5xl">
            {PRODUCT.demandara} operates growth.{' '}
            <span className="text-gradient-tech">{PRODUCT.cognitia}</span> powers the proof.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-300 sm:text-lg">
            Auto Growth OS runs on Cognitia&apos;s Client OS: CRM-lite, an agent economy with
            governance, a proof registry, an action ledger, and human-approval gates on every
            sensitive action.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/portal/agent-economy" variant="gold" size="lg">
              See the agent economy
            </ButtonLink>
            <ButtonLink href="/portal/proof" variant="navy" size="lg">
              Open the proof ledger
            </ButtonLink>
          </div>
        </Reveal>
      </Section>

      <Section className="pb-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((c, i) => (
            <Reveal key={c.title} delayMs={i * 50}>
              <div className="h-full rounded-2xl border border-line bg-surface p-6 shadow-sm">
                <h2 className="font-display text-base font-semibold text-ink-100">{c.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-ink-400">{c.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section className="py-12">
        <div className="rounded-2xl border border-line bg-surface p-6 text-center shadow-sm sm:p-8">
          <p className="font-display text-lg font-semibold text-ink-100">
            Sell with {PRODUCT.demandara}
          </p>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-ink-400">
            Demandara brings the client and operates the growth workflow on top of this
            infrastructure.
          </p>
          <div className="mt-5">
            <ButtonLink href="/dealership-growth-os" variant="outline" size="md">
              Dealership Growth OS
            </ButtonLink>
          </div>
        </div>
      </Section>

      <Section className="py-12">
        <ComplianceNotice />
      </Section>
    </>
  );
}
