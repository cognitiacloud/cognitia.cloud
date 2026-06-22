// components/discovery/DiscoveryOutput.tsx
import type { DiscoveryOutput } from '@/lib/discovery';

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">{title}</p>
      <div className="mt-2 text-sm text-ink-300">{children}</div>
    </div>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gold-400" />
          {i}
        </li>
      ))}
    </ul>
  );
}

export function DiscoveryOutputView({ output }: { output: DiscoveryOutput }) {
  return (
    <div className="space-y-4">
      {/* Proposal header */}
      <div className="panel-dark rounded-2xl p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-300">
          Recommended package
        </p>
        <h3 className="mt-2 font-display text-3xl font-bold text-white">
          {output.recommendedPackage}
        </h3>
        <p className="mt-2 max-w-2xl text-sm text-white/70">{output.clientUnderstanding}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-[11px] uppercase tracking-wider text-white/45">Readiness</p>
            <p className="font-display text-lg font-semibold text-white">
              {output.scores.infrastructureReadiness}/100
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-[11px] uppercase tracking-wider text-white/45">Complexity</p>
            <p className="font-display text-lg font-semibold text-white">
              {output.scores.complexity}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-[11px] uppercase tracking-wider text-white/45">Investment</p>
            <p className="text-sm font-medium text-white">{output.pricingRange}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Block title="What we heard">
          <List items={output.whatWeHeard} />
        </Block>
        <Block title="Clarification questions">
          <List items={output.clarificationQuestions} />
        </Block>
        <Block title="Proposed system">
          <List items={output.proposedSystem} />
        </Block>
        <Block title="Optional add-ons">
          <List items={output.optionalAddOns} />
        </Block>
      </div>

      <Block title="30 / 60 / 90 day roadmap">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="font-medium text-ink-100">First 30 days</p>
            <List items={output.roadmap.d30} />
          </div>
          <div>
            <p className="font-medium text-ink-100">Day 31–60</p>
            <List items={output.roadmap.d60} />
          </div>
          <div>
            <p className="font-medium text-ink-100">Day 61–90</p>
            <List items={output.roadmap.d90} />
          </div>
        </div>
      </Block>

      <div className="grid gap-4 lg:grid-cols-3">
        <Block title="Client responsibilities">
          <List items={output.clientResponsibilities} />
        </Block>
        <Block title="Demandara responsibilities">
          <List items={output.demandaraResponsibilities} />
        </Block>
        <Block title="Cognitia responsibilities">
          <List items={output.cognitiaResponsibilities} />
        </Block>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Block title="Access checklist">
          <List items={output.accessChecklist} />
        </Block>
        <Block title="Proof capture plan">
          <List items={output.proofCapturePlan} />
        </Block>
        <Block title="Proposal outline">
          <List items={output.proposalOutline} />
        </Block>
        <Block title="Risk &amp; expectation notes">
          <List items={output.riskNotes} />
        </Block>
      </div>

      <div className="rounded-2xl border border-gold-400/40 bg-gold-400/[0.07] p-6 text-center">
        <p className="font-display text-lg font-semibold text-ink-100">
          {output.finalConfirmation}
        </p>
      </div>
    </div>
  );
}
