// components/modules/ModuleCard.tsx
import type { Module } from '@/types';
import { formatRange } from '@/lib/format';

function ModuleIcon({ name }: { name: string }) {
  const p = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (name) {
    case 'globe':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
        </svg>
      );
    case 'layers':
      return (
        <svg {...p}>
          <path d="M12 3l9 5-9 5-9-5 9-5z" />
          <path d="M3 13l9 5 9-5" />
        </svg>
      );
    case 'target':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        </svg>
      );
    case 'compass':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
          <path d="M15.5 8.5l-2 5-5 2 2-5 5-2z" />
        </svg>
      );
    case 'spark':
      return (
        <svg {...p}>
          <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
        </svg>
      );
    case 'chat':
      return (
        <svg {...p}>
          <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 21l2-5.6A8.5 8.5 0 1 1 21 11.5z" />
        </svg>
      );
    case 'map':
      return (
        <svg {...p}>
          <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
          <path d="M9 4v14M15 6v14" />
        </svg>
      );
    case 'phone':
      return (
        <svg {...p}>
          <rect x="7" y="2" width="10" height="20" rx="2.5" />
          <path d="M11 18h2" />
        </svg>
      );
    default:
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}

export function ModuleCard({ module }: { module: Module }) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-white/8 bg-navy-850/50 p-6 transition duration-200 hover:-translate-y-1 hover:border-gold-400/30 hover:shadow-[0_24px_60px_-30px_rgba(227,189,77,0.35)]">
      <div className="flex items-start justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-gold-400/25 bg-gold-400/10 text-gold-300">
          <ModuleIcon name={module.icon} />
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-ink-400">
          {module.category}
        </span>
      </div>

      <h3 className="mt-4 font-display text-lg font-semibold text-ink-100">{module.name}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-400">{module.whatItDoes}</p>

      <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/8 bg-white/5 text-sm">
        <div className="bg-navy-900/70 p-3">
          <dt className="text-xs text-ink-500">Setup (CAD)</dt>
          <dd className="mt-0.5 font-medium text-ink-100">{formatRange(module.setupCad)}</dd>
        </div>
        <div className="bg-navy-900/70 p-3">
          <dt className="text-xs text-ink-500">Monthly (CAD)</dt>
          <dd className="mt-0.5 font-medium text-ink-100">{formatRange(module.monthlyCad)}</dd>
        </div>
        <div className="bg-navy-900/70 p-3">
          <dt className="text-xs text-ink-500">Pass-through</dt>
          <dd className="mt-0.5 text-xs text-ink-300">{module.passThrough}</dd>
        </div>
        <div className="bg-navy-900/70 p-3">
          <dt className="text-xs text-ink-500">Delivery</dt>
          <dd className="mt-0.5 text-xs text-ink-300">{module.delivery}</dd>
        </div>
      </dl>
    </article>
  );
}
