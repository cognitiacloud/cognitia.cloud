import Link from 'next/link';
import { env } from '@cognitia/config';

const NAV = [
  { href: '/prospects', label: 'Prospects' },
  { href: '/approvals', label: 'Approval Queue' },
  { href: '/dashboard', label: 'Call Dashboard' },
  { href: '/compliance', label: 'Compliance' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/prospects" className="text-lg font-semibold">
            Cognitia <span className="text-indigo-600">Sales Closer</span>
          </Link>
          <nav className="flex gap-5 text-sm">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="text-slate-600 hover:text-slate-900">
                {n.label}
              </Link>
            ))}
          </nav>
          {env.MOCK_MODE && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
              MOCK MODE
            </span>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
