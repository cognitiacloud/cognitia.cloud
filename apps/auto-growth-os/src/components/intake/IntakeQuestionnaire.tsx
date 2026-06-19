'use client';

// components/intake/IntakeQuestionnaire.tsx
// 12-question dealership intake → deterministic package recommendation.

import { useState } from 'react';
import type {
  AdBudgetBand,
  BudgetBand,
  IntakeAnswers,
  LeadSource,
  PackageRecommendation,
  ResponseTarget,
  RetentionMaturity,
} from '@/types';
import { recommendPackage } from '@/lib/recommendation';
import { Field, TextInput, Select } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { RecommendationResult } from '@/components/intake/RecommendationResult';

const LEAD_SOURCES: LeadSource[] = [
  'Website',
  'Google Ads',
  'Meta Ads',
  'WhatsApp',
  'Marketplace',
  'Referral',
  'Walk-in',
  'Phone',
];
const AD_BUDGETS: AdBudgetBand[] = ['Under $1k', '$1k–$3k', '$3k–$7k', '$7k+'];
const RESPONSE_TARGETS: ResponseTarget[] = [
  'Under 5 minutes',
  'Under 30 minutes',
  'Within 1 hour',
  'Same day',
];
const RETENTION: RetentionMaturity[] = [
  'No structured retention',
  'Some manual reminders',
  'Established retention program',
];
const BUDGETS: { value: BudgetBand; hint: string }[] = [
  { value: 'Starter', hint: 'Lean MVP, foundation only' },
  { value: 'Growth', hint: 'Foundation + acquisition' },
  { value: 'Premium', hint: 'Acquisition + automation' },
  { value: 'Enterprise', hint: 'Full operating system' },
];
const COMPLIANCE_OPTIONS = [
  'No autonomous pricing',
  'Consent required for all messaging',
  'No third-party data sharing',
  'Human review of all AI replies',
  'No SMS outside business hours',
];

const DEFAULTS = {
  currentWebsite: 'www.example-motors.ca',
  hosting: 'Shared hosting (Wix / GoDaddy)',
  inventoryWorkflow: 'Third-party feed (AutoTrader, Kijiji)',
  crmDms: 'Generic CRM',
  topLeadSources: ['Google Ads', 'Marketplace', 'Referral'] as LeadSource[],
  monthlyAdBudget: '$3k–$7k' as AdBudgetBand,
  responseTarget: 'Under 30 minutes' as ResponseTarget,
  financingTradeIn: 'Basic online forms',
  consentProcess: 'Checkbox at point of contact',
  salesHandoff: 'Round-robin',
  retentionMaturity: 'No structured retention' as RetentionMaturity,
  complianceBoundaries: ['No autonomous pricing', 'Consent required for all messaging'],
  mvpBudget: 'Premium' as BudgetBand,
  launchDate: '2026-08-01',
};

function SectionTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-400/15 text-xs font-bold text-cyan-300">
        {n}
      </span>
      <h3 className="font-display text-sm font-semibold uppercase tracking-[0.16em] text-ink-200">
        {children}
      </h3>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm transition ${
        active
          ? 'border-cyan-400/50 bg-cyan-400/15 text-cyan-100'
          : 'border-white/10 bg-navy-900/40 text-ink-400 hover:text-ink-100'
      }`}
    >
      {children}
    </button>
  );
}

export function IntakeQuestionnaire() {
  const [form, setForm] = useState(DEFAULTS);
  const [result, setResult] = useState<PackageRecommendation | null>(null);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleArray = (key: 'topLeadSources' | 'complianceBoundaries', value: string) =>
    setForm((f) => {
      const arr = f[key] as string[];
      const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
      return { ...f, [key]: next };
    });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const answers: IntakeAnswers = {
      currentWebsite: form.currentWebsite,
      hosting: form.hosting,
      inventoryWorkflow: form.inventoryWorkflow,
      crmDms: form.crmDms,
      topLeadSources: form.topLeadSources,
      monthlyAdBudget: form.monthlyAdBudget,
      responseTarget: form.responseTarget,
      financingTradeIn: form.financingTradeIn,
      consentProcess: form.consentProcess,
      salesHandoff: form.salesHandoff,
      retentionMaturity: form.retentionMaturity,
      complianceBoundaries: form.complianceBoundaries.join('; '),
      mvpBudget: form.mvpBudget,
      launchDate: form.launchDate,
    };
    setResult(recommendPackage(answers));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (result) {
    return <RecommendationResult recommendation={result} onEdit={() => setResult(null)} />;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Current state */}
      <div className="rounded-2xl border border-white/8 glass p-6">
        <SectionTitle n={1}>Current setup</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Current website" htmlFor="q-site">
            <TextInput
              id="q-site"
              value={form.currentWebsite}
              onChange={(e) => set('currentWebsite', e.target.value)}
            />
          </Field>
          <Field label="Hosting" htmlFor="q-host">
            <TextInput
              id="q-host"
              value={form.hosting}
              onChange={(e) => set('hosting', e.target.value)}
            />
          </Field>
          <Field label="Inventory source / posting workflow" htmlFor="q-inv">
            <Select
              id="q-inv"
              value={form.inventoryWorkflow}
              onChange={(e) => set('inventoryWorkflow', e.target.value)}
            >
              <option>Manual posting</option>
              <option>Third-party feed (AutoTrader, Kijiji)</option>
              <option>DMS-integrated feed</option>
              <option>No system yet</option>
            </Select>
          </Field>
          <Field label="Current CRM / DMS" htmlFor="q-crm">
            <Select id="q-crm" value={form.crmDms} onChange={(e) => set('crmDms', e.target.value)}>
              <option>None / spreadsheets</option>
              <option>Generic CRM</option>
              <option>Automotive CRM/DMS (VinSolutions, DealerSocket)</option>
            </Select>
          </Field>
        </div>
      </div>

      {/* Acquisition */}
      <div className="rounded-2xl border border-white/8 glass p-6">
        <SectionTitle n={2}>Acquisition &amp; response</SectionTitle>
        <div className="space-y-4">
          <Field label="Top 3 lead sources" hint="Select the channels you rely on most">
            <div className="flex flex-wrap gap-2">
              {LEAD_SOURCES.map((s) => (
                <Chip
                  key={s}
                  active={form.topLeadSources.includes(s)}
                  onClick={() => toggleArray('topLeadSources', s)}
                >
                  {s}
                </Chip>
              ))}
            </div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Monthly ad budget" htmlFor="q-ad">
              <Select
                id="q-ad"
                value={form.monthlyAdBudget}
                onChange={(e) => set('monthlyAdBudget', e.target.value as AdBudgetBand)}
              >
                {AD_BUDGETS.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </Select>
            </Field>
            <Field label="Response-time target" htmlFor="q-resp">
              <Select
                id="q-resp"
                value={form.responseTarget}
                onChange={(e) => set('responseTarget', e.target.value as ResponseTarget)}
              >
                {RESPONSE_TARGETS.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </Select>
            </Field>
          </div>
        </div>
      </div>

      {/* Operations */}
      <div className="rounded-2xl border border-white/8 glass p-6">
        <SectionTitle n={3}>Operations &amp; compliance</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Financing / trade-in process" htmlFor="q-fin">
            <Select
              id="q-fin"
              value={form.financingTradeIn}
              onChange={(e) => set('financingTradeIn', e.target.value)}
            >
              <option>Handled manually in person</option>
              <option>Basic online forms</option>
              <option>Integrated digital workflow</option>
            </Select>
          </Field>
          <Field label="WhatsApp / SMS / email consent process" htmlFor="q-consent">
            <Select
              id="q-consent"
              value={form.consentProcess}
              onChange={(e) => set('consentProcess', e.target.value)}
            >
              <option>No formal process</option>
              <option>Checkbox at point of contact</option>
              <option>Documented CASL consent tracking</option>
            </Select>
          </Field>
          <Field label="Sales staff &amp; handoff rules" htmlFor="q-hand">
            <Select
              id="q-hand"
              value={form.salesHandoff}
              onChange={(e) => set('salesHandoff', e.target.value)}
            >
              <option>First available rep</option>
              <option>Round-robin</option>
              <option>By source / territory</option>
              <option>No defined rules</option>
            </Select>
          </Field>
          <Field label="Service lane &amp; retention gaps" htmlFor="q-ret">
            <Select
              id="q-ret"
              value={form.retentionMaturity}
              onChange={(e) => set('retentionMaturity', e.target.value as RetentionMaturity)}
            >
              {RETENTION.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Compliance boundaries" hint="Hard rules the system must respect">
            <div className="flex flex-wrap gap-2">
              {COMPLIANCE_OPTIONS.map((c) => (
                <Chip
                  key={c}
                  active={form.complianceBoundaries.includes(c)}
                  onClick={() => toggleArray('complianceBoundaries', c)}
                >
                  {c}
                </Chip>
              ))}
            </div>
          </Field>
        </div>
      </div>

      {/* Project */}
      <div className="rounded-2xl border border-white/8 glass p-6">
        <SectionTitle n={4}>MVP budget &amp; launch</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="MVP budget tier" htmlFor="q-budget">
            <Select
              id="q-budget"
              value={form.mvpBudget}
              onChange={(e) => set('mvpBudget', e.target.value as BudgetBand)}
            >
              {BUDGETS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.value} — {b.hint}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Target launch date" htmlFor="q-launch">
            <TextInput
              id="q-launch"
              type="date"
              value={form.launchDate}
              onChange={(e) => set('launchDate', e.target.value)}
            />
          </Field>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs text-ink-500">
          Answers are processed locally — nothing leaves your browser in this demo.
        </p>
        <Button type="submit" variant="gold" size="lg">
          Generate my recommendation →
        </Button>
      </div>
    </form>
  );
}
