// components/customer/CustomerProfile.tsx
import type { Customer } from '@/types';
import { Badge } from '@/components/ui/Badge';

function initials(name: string): string {
  const clean = name.replace(/^(Mr\.|Ms\.|Mrs\.|Dr\.)\s*/i, '');
  const parts = clean.split(' ').filter(Boolean);
  const first = parts[0] ?? '';
  const last = parts[parts.length - 1] ?? '';
  if (!first) return '?';
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  return ((first[0] ?? '') + (last[0] ?? '')).toUpperCase();
}

const CHANNEL_LABEL: Record<string, string> = {
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
};

function InfoTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 p-4">
      <p className="text-xs uppercase tracking-wider text-ink-500">{label}</p>
      <div className="mt-1.5 text-sm text-ink-100">{children}</div>
    </div>
  );
}

export function CustomerProfile({ customer }: { customer: Customer }) {
  return (
    <div className="rounded-2xl border border-line glass p-6 sm:p-7">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-gold-400/30 to-cyan-400/20 font-display text-lg font-bold text-ink-100">
          {initials(customer.name)}
        </div>
        <div className="flex-1">
          <h2 className="font-display text-2xl font-semibold text-ink-100">{customer.name}</h2>
          <p className="text-sm text-ink-400">{customer.vehicle}</p>
        </div>
        <div className="text-right">
          <p className="font-display text-2xl font-bold text-gradient-tech">
            {customer.loyaltyMonths}
          </p>
          <p className="text-xs text-ink-500">months as a customer</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <InfoTile label="Preferred channel">{CHANNEL_LABEL[customer.preferredChannel]}</InfoTile>
        <InfoTile label="Family context">{customer.familyNote}</InfoTile>
        <InfoTile label="Preferences">
          <div className="flex flex-wrap gap-1.5">
            {customer.preferences.map((p) => (
              <span key={p} className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-ink-300">
                {p}
              </span>
            ))}
          </div>
        </InfoTile>
        <InfoTile label="Last concern">{customer.lastConcern}</InfoTile>
      </div>

      <div className="mt-4 rounded-xl border border-gold-400/30 bg-gold-400/[0.07] p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-gold-700">
          Next best action
        </p>
        <p className="mt-1.5 text-sm text-ink-100">{customer.nextAction}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink-500">Consent:</span>
        {(['email', 'sms', 'whatsapp'] as const).map((ch) => (
          <Badge key={ch} tone={customer.consent[ch] ? 'mint' : 'neutral'}>
            {CHANNEL_LABEL[ch]} {customer.consent[ch] ? '✓' : '—'}
          </Badge>
        ))}
        <Badge tone="cyan">CASL: {customer.consent.basis}</Badge>
      </div>
    </div>
  );
}
