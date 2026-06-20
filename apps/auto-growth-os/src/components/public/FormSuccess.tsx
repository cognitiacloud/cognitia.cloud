// components/public/FormSuccess.tsx
import { DISCLAIMERS } from '@/lib/copy';

export function FormSuccess({
  title = 'Request received',
  lines = [],
}: {
  title?: string;
  lines?: string[];
}) {
  return (
    <div className="rounded-2xl border border-mint-400/30 bg-mint-400/[0.06] p-6 sm:p-7">
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-mint-400/20 text-mint-600">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
          >
            <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <p className="font-display text-lg font-semibold text-ink-100">{title}</p>
      </div>
      <p className="mt-3 text-sm text-ink-300">{DISCLAIMERS.formSuccess}</p>
      {lines.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-ink-400">
          {lines.map((l) => (
            <li key={l}>• {l}</li>
          ))}
        </ul>
      )}
      <p className="mt-4 border-t border-line pt-3 text-xs text-ink-500">
        {DISCLAIMERS.confirmDetails}
      </p>
    </div>
  );
}
