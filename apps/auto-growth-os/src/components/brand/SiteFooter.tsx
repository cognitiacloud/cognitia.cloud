// components/brand/SiteFooter.tsx
// Deep-navy trust band: concise compliance, light text on a dark accent surface.
import Link from 'next/link';
import { Wordmark } from '@/components/brand/CognitiaMark';
import { NAV_LINKS, COMPLIANCE_POINTS } from '@/lib/constants';

export function SiteFooter() {
  return (
    <footer className="mt-24 bg-navy-950 text-white/70">
      <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.1fr_1fr_1fr]">
          <div className="max-w-xs">
            <Wordmark tone="light" />
            <p className="mt-4 text-sm leading-relaxed text-white/55">
              Website, intake, CRM, and human-approved AI agents — one system for dealership growth.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
              Platform
            </p>
            <nav className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2.5">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-white/65 transition hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
              Trust &amp; compliance
            </p>
            <ul className="mt-4 space-y-2">
              {COMPLIANCE_POINTS.slice(0, 4).map((point) => (
                <li key={point.title} className="flex items-start gap-2 text-sm text-white/65">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-mint-400" aria-hidden />
                  {point.title}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Cognitia. Built for dealership growth.</p>
          <p>Demo environment · Integrations simulated · No real customer data</p>
        </div>
      </div>
    </footer>
  );
}
