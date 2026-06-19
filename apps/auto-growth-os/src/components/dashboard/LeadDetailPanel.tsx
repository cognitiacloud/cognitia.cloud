'use client';

// components/dashboard/LeadDetailPanel.tsx
import { useEffect, useState } from 'react';
import type { Lead } from '@/types';
import { scoreBreakdown } from '@/lib/scoring';
import { SIGNAL_LABELS } from '@/lib/constants';
import { formatCad, formatDate } from '@/lib/format';
import { adapters } from '@/lib/adapters';
import { StageBadge, Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

type Activity = { id: number; text: string; tone: 'mint' | 'cyan' | 'gold' };

const TONE_DOT: Record<Activity['tone'], string> = {
  mint: 'bg-mint-400',
  cyan: 'bg-cyan-400',
  gold: 'bg-gold-400',
};

export function LeadDetailPanel({ lead }: { lead: Lead }) {
  const [activity, setActivity] = useState<Activity[]>([]);
  const [aiDraft, setAiDraft] = useState<{
    draft: string;
    rationale: string;
    approved: boolean;
  } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Reset transient state when a different lead is selected.
  useEffect(() => {
    setActivity([]);
    setAiDraft(null);
    setBusy(null);
  }, [lead.id]);

  const log = (text: string, tone: Activity['tone']) =>
    setActivity((a) => [{ id: Date.now() + Math.random(), text, tone }, ...a].slice(0, 5));

  const draftAi = async () => {
    setBusy('ai');
    const res = await adapters.ai.draftReply({ lead, history: [lead.message] });
    setAiDraft({ draft: res.draft, rationale: res.rationale, approved: false });
    setBusy(null);
  };

  const sendWhatsApp = async () => {
    setBusy('wa');
    const res = await adapters.whatsapp.sendMessage(
      lead.phone,
      `Hi ${lead.name.split(' ')[0]}, following up on your inquiry.`,
    );
    log(res.detail, 'mint');
    setBusy(null);
  };

  const logToCrm = async () => {
    setBusy('crm');
    const res = await adapters.crm.upsertLead(lead);
    log(`${res.detail} (id: ${res.data?.crmId})`, 'cyan');
    setBusy(null);
  };

  const breakdown = scoreBreakdown(lead.signals);

  return (
    <div className="rounded-2xl border border-white/8 glass-strong p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold text-ink-100">{lead.name}</h3>
          <p className="text-sm text-ink-400">
            {lead.source} · {formatDate(lead.createdAt)}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-3xl font-bold text-gradient-gold">{lead.score}</p>
          <StageBadge stage={lead.stage} />
        </div>
      </div>

      {/* Contact + interest */}
      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-ink-500">Email</dt>
          <dd className="truncate text-ink-200">{lead.email}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-500">Phone</dt>
          <dd className="text-ink-200">{lead.phone || '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-500">Vehicle interest</dt>
          <dd className="text-ink-200">{lead.vehicleInterest}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-500">Budget</dt>
          <dd className="text-ink-200">{lead.budgetCad ? formatCad(lead.budgetCad) : '—'}</dd>
        </div>
      </dl>

      {lead.message && (
        <p className="mt-4 rounded-xl border border-white/8 bg-navy-900/50 p-3 text-sm italic text-ink-300">
          “{lead.message}”
        </p>
      )}

      {/* Score breakdown */}
      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">
          Why this score
        </p>
        <ul className="space-y-1.5">
          {breakdown.map((row) => (
            <li
              key={row.key}
              className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm ${
                row.active ? 'bg-white/[0.04] text-ink-100' : 'text-ink-500'
              }`}
            >
              <span className="flex items-center gap-2">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${row.active ? 'bg-mint-400' : 'bg-white/15'}`}
                />
                {SIGNAL_LABELS[row.key]}
              </span>
              <span className={row.active ? 'font-medium text-mint-300' : ''}>
                {row.active ? `+${row.points}` : '—'}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Consent */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink-500">Consent:</span>
        {(['email', 'sms', 'whatsapp'] as const).map((ch) => (
          <Badge key={ch} tone={lead.consent[ch] ? 'mint' : 'neutral'}>
            {ch} {lead.consent[ch] ? '✓' : '—'}
          </Badge>
        ))}
      </div>

      {/* Next action */}
      <div className="mt-4 rounded-xl border border-gold-400/30 bg-gold-400/[0.07] p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-gold-300">
          Recommended next action
        </p>
        <p className="mt-1 text-sm text-ink-100">{lead.nextAction}</p>
      </div>

      {/* Simulated actions */}
      <div className="mt-5 border-t border-white/8 pt-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="tech" size="sm" onClick={draftAi} disabled={busy === 'ai'}>
            {busy === 'ai' ? 'Drafting…' : 'Draft AI reply'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={sendWhatsApp}
            disabled={busy === 'wa' || !lead.consent.whatsapp}
            title={!lead.consent.whatsapp ? 'No WhatsApp consent on file' : undefined}
          >
            Send WhatsApp
          </Button>
          <Button variant="outline" size="sm" onClick={logToCrm} disabled={busy === 'crm'}>
            Log to CRM
          </Button>
        </div>
        {!lead.consent.whatsapp && (
          <p className="mt-2 text-xs text-ink-500">
            WhatsApp is disabled — no consent on file (CASL).
          </p>
        )}

        {aiDraft && (
          <div className="mt-3 rounded-xl border border-cyan-400/25 bg-cyan-400/[0.05] p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
                AI draft
              </span>
              <Badge tone="gold">Requires human approval</Badge>
            </div>
            <p className="mt-2 text-sm text-ink-100">{aiDraft.draft}</p>
            <p className="mt-2 text-xs text-ink-500">{aiDraft.rationale}</p>
            {aiDraft.approved ? (
              <p className="mt-2 text-xs font-medium text-mint-300">
                ✓ Approved by human — would send now (simulated)
              </p>
            ) : (
              <div className="mt-3 flex gap-2">
                <Button
                  variant="gold"
                  size="sm"
                  onClick={() => {
                    setAiDraft((d) => (d ? { ...d, approved: true } : d));
                    log('AI reply approved by human (simulated send)', 'gold');
                  }}
                >
                  Approve &amp; send
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setAiDraft(null)}>
                  Discard
                </Button>
              </div>
            )}
          </div>
        )}

        {activity.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {activity.map((a) => (
              <li key={a.id} className="flex items-start gap-2 text-xs text-ink-300">
                <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[a.tone]}`} />
                <span>
                  <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-400">
                    Simulated
                  </span>{' '}
                  {a.text}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
