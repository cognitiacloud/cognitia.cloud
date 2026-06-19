// components/customer/CustomerTimeline.tsx
import type { TimelineEvent, TimelineKind } from '@/types';
import { formatDate } from '@/lib/format';

const KIND_STYLE: Record<TimelineKind, { ring: string; dot: string }> = {
  inquiry: { ring: 'border-cyan-400/40', dot: 'bg-cyan-400' },
  'test-drive': { ring: 'border-cyan-400/40', dot: 'bg-cyan-400' },
  purchase: { ring: 'border-gold-400/40', dot: 'bg-gold-400' },
  service: { ring: 'border-mint-400/40', dot: 'bg-mint-400' },
  rapport: { ring: 'border-gold-400/40', dot: 'bg-gold-400' },
  repurchase: { ring: 'border-cyan-400/40', dot: 'bg-cyan-400' },
};

function KindIcon({ kind }: { kind: TimelineKind }) {
  const p = {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (kind) {
    case 'inquiry':
      return (
        <svg {...p}>
          <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 21l2-5.6A8.5 8.5 0 1 1 21 11.5z" />
        </svg>
      );
    case 'test-drive':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l3 2" />
        </svg>
      );
    case 'purchase':
      return (
        <svg {...p}>
          <path d="M5 12l5 5L20 7" />
        </svg>
      );
    case 'service':
      return (
        <svg {...p}>
          <path d="M14 7a4 4 0 0 1-5 5l-5 5 2 2 5-5a4 4 0 0 0 5-5l-2 2-2-2 2-2z" />
        </svg>
      );
    case 'rapport':
      return (
        <svg {...p}>
          <path d="M12 20s-7-4.5-7-9a4 4 0 0 1 7-2.5A4 4 0 0 1 19 11c0 4.5-7 9-7 9z" />
        </svg>
      );
    case 'repurchase':
      return (
        <svg {...p}>
          <path d="M4 12a8 8 0 0 1 14-5M20 12a8 8 0 0 1-14 5" />
          <path d="M18 3v4h-4M6 21v-4h4" />
        </svg>
      );
    default:
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}

export function CustomerTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="rounded-2xl border border-line glass p-6 sm:p-7">
      <h3 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
        Relationship timeline
      </h3>
      <ol className="mt-5 space-y-1">
        {events.map((event, i) => {
          const style = KIND_STYLE[event.kind];
          const last = i === events.length - 1;
          return (
            <li key={event.id} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full border ${style.ring} bg-surface-2 text-ink-100`}
                >
                  <KindIcon kind={event.kind} />
                </span>
                {!last && <span className="my-1 w-px flex-1 bg-line" />}
              </div>
              <div className={last ? 'pb-0' : 'pb-6'}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                  <p className="text-sm font-medium text-ink-100">{event.label}</p>
                  <span className="text-xs text-ink-500">{formatDate(event.date)}</span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-ink-400">{event.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
