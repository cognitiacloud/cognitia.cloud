// components/portal/RiskBadge.tsx
import { Badge } from '@/components/ui/Badge';
import type { RiskLevel } from '@/lib/guardrails';

const TONE = { low: 'cyan', medium: 'gold', high: 'alert' } as const;

export function RiskBadge({ level }: { level: RiskLevel }) {
  return <Badge tone={TONE[level]}>{level} risk</Badge>;
}

export function ClaimChips({ claims }: { claims: string[] }) {
  if (claims.length === 0) return <span className="text-xs text-ink-500">No sensitive claims</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {claims.map((c) => (
        <span
          key={c}
          className="rounded-md bg-rose-500/10 px-1.5 py-0.5 text-[11px] font-medium text-rose-600"
        >
          {c.replace(/_/g, ' ')}
        </span>
      ))}
    </span>
  );
}
