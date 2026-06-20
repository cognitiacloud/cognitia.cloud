// components/brand/PublicSiteFooter.tsx
// Dealership-facing footer for the public car-buyer site: light, with the
// required confirm-details disclaimer and a discreet platform attribution.
import Link from 'next/link';
import { PUBLIC_NAV } from '@/lib/routes';
import { PRODUCT, DISCLAIMERS } from '@/lib/copy';

export function PublicSiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <p className="font-display text-lg font-semibold text-ink-100">{PRODUCT.dealer}</p>
            <p className="mt-2 text-sm text-ink-400">
              Quality used vehicles in Toronto and the GTA. Capture every inquiry, answered fast.
            </p>
          </div>
          <nav className="grid grid-cols-2 gap-x-10 gap-y-2 sm:grid-cols-3">
            {PUBLIC_NAV.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm text-ink-300 transition hover:text-cyan-700"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <p className="mt-10 rounded-xl border border-line bg-surface-2 px-4 py-3 text-xs leading-relaxed text-ink-400">
          {DISCLAIMERS.confirmDetails}
        </p>

        <div className="mt-6 flex flex-col gap-2 border-t border-line pt-6 text-xs text-ink-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {PRODUCT.dealer}. {DISCLAIMERS.demo}
          </p>
          <p>
            Powered by{' '}
            <Link
              href="/dealership-growth-os"
              className="font-medium text-ink-300 hover:text-cyan-700"
            >
              {PRODUCT.demandara} × {PRODUCT.cognitia}
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
