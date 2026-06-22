// components/ui/Badge.tsx
import type { ReactNode } from 'react';
import type { Stage } from '@/types';

type Tone = 'neutral' | 'cyan' | 'mint' | 'gold' | 'alert';

const TONES: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-ink-300 border-line',
  cyan: 'bg-cyan-400/10 text-cyan-700 border-cyan-400/30',
  mint: 'bg-mint-400/10 text-mint-600 border-mint-400/30',
  gold: 'bg-gold-400/10 text-gold-700 border-gold-400/30',
  alert: 'bg-rose-500/10 text-rose-600 border-rose-300',
};

export const STAGE_TONE: Record<Stage, Tone> = {
  Nurture: 'neutral',
  Qualified: 'cyan',
  'Hot Lead': 'mint',
  'Immediate Sales Handoff': 'gold',
};

export function Badge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function StageBadge({ stage }: { stage: Stage }) {
  return (
    <Badge tone={STAGE_TONE[stage]}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {stage}
    </Badge>
  );
}
