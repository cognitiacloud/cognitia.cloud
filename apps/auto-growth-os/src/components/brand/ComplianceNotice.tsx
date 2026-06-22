// components/brand/ComplianceNotice.tsx
// Visible trust/compliance commitments, reused across pages.

import { COMPLIANCE_POINTS } from '@/lib/constants';

function ShieldIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="text-mint-600"
    >
      <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ComplianceNotice({
  variant = 'full',
  className = '',
}: {
  variant?: 'full' | 'compact';
  className?: string;
}) {
  if (variant === 'compact') {
    return (
      <div
        className={`flex items-start gap-3 rounded-xl border border-mint-400/20 bg-mint-400/[0.04] p-4 ${className}`}
      >
        <span className="mt-0.5">
          <ShieldIcon />
        </span>
        <p className="text-xs leading-relaxed text-ink-300">
          <span className="font-medium text-mint-600">Compliance-first.</span> CASL-ready consent
          tracking, one-click unsubscribe, internal do-not-call suppression, and human approval
          gates on every AI action. AI never promises discounts, financing, legal, or warranty
          terms.
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-line glass p-6 ${className}`}>
      <div className="mb-4 flex items-center gap-2">
        <ShieldIcon />
        <h3 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-mint-600">
          Trust &amp; Compliance
        </h3>
      </div>
      <ul className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {COMPLIANCE_POINTS.map((point) => (
          <li key={point.title}>
            <p className="text-sm font-medium text-ink-100">{point.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-400">{point.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
