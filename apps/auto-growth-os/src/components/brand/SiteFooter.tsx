// components/brand/SiteFooter.tsx
import Link from 'next/link';
import { Wordmark } from '@/components/brand/CognitiaMark';
import { ComplianceNotice } from '@/components/brand/ComplianceNotice';
import { NAV_LINKS } from '@/lib/constants';

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-white/5 bg-navy-950/60">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <ComplianceNotice className="mb-10" />
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <Wordmark />
            <p className="mt-4 text-sm leading-relaxed text-ink-400">
              The dealership growth operating system — website, intake, CRM, and AI workflows in one
              trusted platform.
            </p>
          </div>
          <nav className="grid grid-cols-2 gap-x-10 gap-y-2 sm:grid-cols-3">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm text-ink-300 transition hover:text-cyan-300"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-white/5 pt-6 text-xs text-ink-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Cognitia. Built for dealership growth.</p>
          <p className="text-ink-500">
            Demo environment · All integrations are simulated · No real customer data
          </p>
        </div>
      </div>
    </footer>
  );
}
