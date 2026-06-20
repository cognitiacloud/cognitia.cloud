'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

/** POSTs to an API route, then refreshes server components on success. */
export function ActionButton({
  endpoint,
  body,
  children,
  variant = 'primary',
}: {
  endpoint: string;
  body?: Record<string, unknown>;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const styles = {
    primary: 'bg-navy text-white hover:bg-navy-700',
    secondary: 'border border-navy/20 bg-white text-navy-700 hover:bg-navy-50',
    danger: 'border border-rose-200 bg-white text-rose-600 hover:bg-rose-50',
  }[variant];

  async function onClick() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col">
      <button
        onClick={onClick}
        disabled={busy || pending}
        className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${styles}`}
      >
        {busy || pending ? '…' : children}
      </button>
      {error && <span className="mt-1 text-xs text-rose-600">{error}</span>}
    </span>
  );
}
