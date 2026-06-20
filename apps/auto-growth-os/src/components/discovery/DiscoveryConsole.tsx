'use client';

// components/discovery/DiscoveryConsole.tsx
// The Auto Growth OS Discovery Console: a sectioned questionnaire that scores
// readiness/complexity live and generates a structured proposal.
import { useMemo, useState } from 'react';
import {
  DISCOVERY_SECTIONS,
  scoreDiscovery,
  recommendDiscoveryPackage,
  generateDiscoveryOutput,
  type DiscoveryOutput,
} from '@/lib/discovery';
import type { DiscoveryAnswers } from '@/types/portal';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import { DiscoveryOutputView } from '@/components/discovery/DiscoveryOutput';

function buildMarkdown(o: DiscoveryOutput): string {
  const L = (items: string[]) => items.map((i) => `- ${i}`).join('\n');
  return [
    `# Auto Growth OS Proposal`,
    ``,
    `**Recommended package:** ${o.recommendedPackage}`,
    `**Investment:** ${o.pricingRange}`,
    ``,
    `## Client understanding`,
    o.clientUnderstanding,
    ``,
    `## What we heard`,
    L(o.whatWeHeard),
    ``,
    `## Proposed system`,
    L(o.proposedSystem),
    ``,
    `## 30/60/90 roadmap`,
    `**30:** ${o.roadmap.d30.join('; ')}`,
    `**60:** ${o.roadmap.d60.join('; ')}`,
    `**90:** ${o.roadmap.d90.join('; ')}`,
    ``,
    `## Responsibilities`,
    `**Client:** ${o.clientResponsibilities.join('; ')}`,
    `**Demandara:** ${o.demandaraResponsibilities.join('; ')}`,
    `**Cognitia:** ${o.cognitiaResponsibilities.join('; ')}`,
    ``,
    `## Risk notes`,
    L(o.riskNotes),
    ``,
    o.finalConfirmation,
  ].join('\n');
}

const hasAnswer = (a: DiscoveryAnswers, qid: string) => {
  const v = a[qid];
  if (v === undefined) return false;
  return Array.isArray(v) ? v.length > 0 : String(v).length > 0;
};

export function DiscoveryConsole() {
  const [answers, setAnswers] = useState<DiscoveryAnswers>({});
  const [idx, setIdx] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);

  const scores = useMemo(() => scoreDiscovery(answers), [answers]);
  const pkg = useMemo(() => recommendDiscoveryPackage(scores, answers), [scores, answers]);
  const output = useMemo(
    () => (submitted ? generateDiscoveryOutput(answers) : null),
    [submitted, answers],
  );

  const answeredSections = DISCOVERY_SECTIONS.filter((s) =>
    s.questions.some((q) => hasAnswer(answers, q.id)),
  ).length;
  const progress = Math.round((answeredSections / DISCOVERY_SECTIONS.length) * 100);

  const setSingle = (qid: string, v: string) => setAnswers((a) => ({ ...a, [qid]: v }));
  const toggleMulti = (qid: string, v: string) =>
    setAnswers((a) => {
      const cur = Array.isArray(a[qid]) ? (a[qid] as string[]) : [];
      return { ...a, [qid]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
    });

  const copyProposal = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(buildMarkdown(output));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  const section = DISCOVERY_SECTIONS[idx];

  return (
    <div className="grid gap-6 lg:grid-cols-[15rem_1fr] lg:items-start">
      <aside className="lg:sticky lg:top-24">
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-ink-500">
            <span>Progress</span>
            <span className="font-medium text-ink-300">{progress}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-mint-400"
              style={{ width: `${progress}%` }}
            />
          </div>
          <ol className="mt-4 space-y-0.5">
            {DISCOVERY_SECTIONS.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setIdx(i);
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                    i === idx && !submitted
                      ? 'bg-surface-2 font-medium text-ink-100'
                      : 'text-ink-400 hover:text-ink-100'
                  }`}
                >
                  <span className="text-ink-500">{i + 1}.</span>
                  {s.title}
                </button>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-4 rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">
            Live recommendation
          </p>
          <p className="mt-1.5 font-display text-sm font-semibold text-gold-700">{pkg}</p>
          <dl className="mt-3 space-y-1 text-xs text-ink-400">
            <div className="flex justify-between">
              <dt>Readiness</dt>
              <dd className="text-ink-200">{scores.infrastructureReadiness}/100</dd>
            </div>
            <div className="flex justify-between">
              <dt>Complexity</dt>
              <dd className="text-ink-200">{scores.complexity}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Automation</dt>
              <dd className="text-ink-200">{scores.automation}</dd>
            </div>
          </dl>
        </div>
      </aside>

      <div>
        {!submitted && section ? (
          <div className="rounded-2xl border border-line glass p-6 sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">
              Section {idx + 1} of {DISCOVERY_SECTIONS.length}
            </p>
            <h2 className="mt-1.5 font-display text-2xl font-bold text-ink-100">{section.title}</h2>

            <div className="mt-6 space-y-6">
              {section.questions.map((q) => (
                <div key={q.id}>
                  <p className="mb-2 text-sm font-medium text-ink-200">{q.label}</p>
                  {q.help && <p className="mb-2 text-xs text-ink-500">{q.help}</p>}
                  {q.type === 'text' && (
                    <TextInput
                      value={(answers[q.id] as string) ?? ''}
                      onChange={(e) => setSingle(q.id, e.target.value)}
                      placeholder="Type your answer"
                    />
                  )}
                  {q.type === 'single' && (
                    <div className="flex flex-wrap gap-2">
                      {q.options?.map((o) => {
                        const active = answers[q.id] === o.value;
                        return (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => setSingle(q.id, o.value)}
                            className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                              active
                                ? 'border-cyan-400/50 bg-cyan-400/10 text-cyan-700'
                                : 'border-line bg-surface text-ink-300 hover:border-cyan-400/30 hover:text-ink-100'
                            }`}
                          >
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {q.type === 'multi' && (
                    <div className="flex flex-wrap gap-2">
                      {q.options?.map((o) => {
                        const active =
                          Array.isArray(answers[q.id]) &&
                          (answers[q.id] as string[]).includes(o.value);
                        return (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => toggleMulti(q.id, o.value)}
                            className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
                              active
                                ? 'border-mint-400/50 bg-mint-400/10 text-mint-600'
                                : 'border-line bg-surface text-ink-300 hover:border-mint-400/30 hover:text-ink-100'
                            }`}
                          >
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-7 flex items-center justify-between gap-3 border-t border-line pt-5">
              <Button
                variant="ghost"
                size="md"
                disabled={idx === 0}
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
              >
                ← Back
              </Button>
              {idx < DISCOVERY_SECTIONS.length - 1 ? (
                <Button variant="navy" size="md" onClick={() => setIdx((i) => i + 1)}>
                  Next →
                </Button>
              ) : (
                <Button variant="gold" size="md" onClick={() => setSubmitted(true)}>
                  Generate proposal
                </Button>
              )}
            </div>
          </div>
        ) : (
          output && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-2xl font-bold text-ink-100">Your proposal</h2>
                <div className="flex gap-2">
                  <Button variant="gold" size="sm" onClick={copyProposal}>
                    {copied ? 'Copied!' : 'Copy proposal'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setSubmitted(false)}>
                    Edit answers
                  </Button>
                </div>
              </div>
              <DiscoveryOutputView output={output} />
            </div>
          )
        )}
      </div>
    </div>
  );
}
