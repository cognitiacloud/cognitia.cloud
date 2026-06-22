// components/portal/DisclosureNote.tsx
import type { ReactNode } from 'react';

export function DisclosureNote({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'info';
}) {
  const cls =
    tone === 'info'
      ? 'border-cyan-400/20 bg-cyan-400/[0.05] text-ink-400'
      : 'border-line bg-surface-2 text-ink-500';
  return <p className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${cls}`}>{children}</p>;
}
