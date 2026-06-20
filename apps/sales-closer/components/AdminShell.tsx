import Link from 'next/link';
import { env } from '@cognitia/config';

const NAV_SECTIONS: { heading: string; items: { href: string; label: string; icon: string }[] }[] = [
  {
    heading: 'Pipeline',
    items: [
      { href: '/prospects', label: 'Prospects', icon: '◳' },
      { href: '/approvals', label: 'Approval Queue', icon: '✎' },
    ],
  },
  {
    heading: 'Outcomes',
    items: [{ href: '/dashboard', label: 'Call Dashboard', icon: '◔' }],
  },
  {
    heading: 'Governance',
    items: [{ href: '/compliance', label: 'Compliance', icon: '⚖' }],
  },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col bg-navy-800 text-white lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gold text-sm font-bold text-navy-900">
            C
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Cognitia</p>
            <p className="text-[11px] uppercase tracking-widest text-mint">Sales Closer</p>
          </div>
        </div>

        <Link
          href="/demo"
          className="mx-3 mb-4 rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs font-semibold text-gold-200 hover:bg-gold/20"
        >
          ★ Boardroom walkthrough
        </Link>

        <nav className="flex-1 space-y-6 px-3">
          {NAV_SECTIONS.map((section) => (
            <div key={section.heading}>
              <p className="px-2 text-[10px] font-semibold uppercase tracking-widest text-white/35">
                {section.heading}
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {section.items.map((n) => (
                  <li key={n.href}>
                    <Link
                      href={n.href}
                      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-white/75 hover:bg-white/5 hover:text-white"
                    >
                      <span className="w-4 text-center text-white/40">{n.icon}</span>
                      {n.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 px-4 py-4">
          {env.MOCK_MODE && (
            <div className="rounded-lg bg-mint/10 px-3 py-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-mint">
                <span className="h-1.5 w-1.5 rounded-full bg-mint" /> Safe demo mode
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-white/50">
                Mocked data. No live calls, emails, or scrapes are sent.
              </p>
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-navy/10 bg-surface px-6 py-3 lg:px-10">
          <Link href="/prospects" className="text-sm font-semibold text-navy lg:hidden">
            Cognitia <span className="text-mint-600">Sales Closer</span>
          </Link>
          <div className="hidden text-xs text-slate-400 lg:block">
            Human-supervised B2B sales closer engine
          </div>
          {env.MOCK_MODE && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-soft px-3 py-1 text-xs font-semibold text-gold-600">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" /> MOCK MODE
            </span>
          )}
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
