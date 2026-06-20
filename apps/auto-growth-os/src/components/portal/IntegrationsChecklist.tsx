'use client';

// components/portal/IntegrationsChecklist.tsx
// Integrations card backed by the store `integrations` slice. Honest by default —
// nothing is "connected"; each row shows its real access state and a short note.
import type { IntegrationState } from '@/types';
import { useAppState } from '@/lib/store/useAppState';
import { Badge } from '@/components/ui/Badge';

const STATE_BADGE: Record<IntegrationState, { tone: 'mint' | 'gold' | 'neutral'; label: string }> =
  {
    connected: { tone: 'mint', label: 'Connected' },
    requires_access: { tone: 'gold', label: 'Requires approved access' },
    not_connected: { tone: 'neutral', label: 'Not connected' },
  };

export function IntegrationsChecklist() {
  const { integrations } = useAppState();
  return (
    <ul className="space-y-3">
      {integrations.map((i) => {
        const badge = STATE_BADGE[i.state];
        return (
          <li key={i.id} className="flex items-start justify-between gap-3">
            <div>
              <p className="text-ink-200">{i.name}</p>
              <p className="mt-0.5 text-xs text-ink-500">{i.note}</p>
            </div>
            <Badge tone={badge.tone}>{badge.label}</Badge>
          </li>
        );
      })}
    </ul>
  );
}
