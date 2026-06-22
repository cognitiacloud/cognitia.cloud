'use client';

// components/portal/PortalShell.tsx
// Internal portal chrome: a fixed sidebar (grouped nav) + topbar with the demo
// role switcher. Used by app/(portal)/portal/layout.tsx.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode } from 'react';
import { PORTAL_NAV } from '@/lib/routes';
import { CognitiaMark } from '@/components/brand/CognitiaMark';
import { DemoRoleSwitcher } from '@/components/portal/DemoRoleSwitcher';
import { PRODUCT, DISCLAIMERS } from '@/lib/copy';

const ICON_PATHS: Record<string, string> = {
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  users:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87',
  heart:
    'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z',
  calendar:
    'M8 2v4M16 2v4M3 10h18M5 6h14a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z',
  car: 'M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13M5 13h14v4H5zM7 17v2M17 17v2',
  doc: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5',
  play: 'M5 3l14 9-14 9z',
  shield: 'M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3zM9 12l2 2 4-4',
  check: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  bot: 'M12 8V4H8M4 8h16v12H4zM2 14h2M20 14h2M9 13v2M15 13v2',
  chart: 'M3 3v18h18M7 15l3-3 3 3 5-6',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 2h-4l-.3 2.4a7 7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.3 2.4h4l.3-2.4a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6a7 7 0 0 0 .1-1z',
};

function NavIcon({ name }: { name: string }) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={ICON_PATHS[name] ?? ICON_PATHS.grid} />
    </svg>
  );
}

export function PortalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const active = (href: string) => pathname === href || pathname.startsWith(href + '/');
  const flatItems = PORTAL_NAV.flatMap((g) => g.items);

  return (
    <div className="flex min-h-screen bg-canvas">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-white lg:flex">
        <Link
          href="/portal/dashboard"
          className="flex items-center gap-2.5 border-b border-line px-5 py-4"
        >
          <CognitiaMark size={28} />
          <span className="flex flex-col leading-none">
            <span className="font-display text-sm font-semibold text-ink-100">{PRODUCT.short}</span>
            <span className="text-[10px] uppercase tracking-[0.16em] text-cyan-700/90">
              Operating Portal
            </span>
          </span>
        </Link>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {PORTAL_NAV.map((group) => (
            <div key={group.group} className="mb-5">
              <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-500">
                {group.group}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition ${
                        active(item.href)
                          ? 'bg-surface-2 font-medium text-ink-100'
                          : 'text-ink-400 hover:bg-surface-2 hover:text-ink-100'
                      }`}
                    >
                      <NavIcon name={item.icon} />
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <p className="border-t border-line px-5 py-3 text-[10px] leading-relaxed text-ink-500">
          {DISCLAIMERS.demo}
        </p>
      </aside>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-line bg-white/85 backdrop-blur-md">
          <div className="flex h-14 items-center justify-between px-4 sm:px-8">
            <Link href="/portal/dashboard" className="flex items-center gap-2 lg:hidden">
              <CognitiaMark size={24} />
              <span className="font-display text-sm font-semibold text-ink-100">Portal</span>
            </Link>
            <span className="hidden text-sm text-ink-400 lg:inline">{PRODUCT.name}</span>
            <div className="flex items-center gap-3">
              <DemoRoleSwitcher />
              <Link
                href="/"
                className="hidden rounded-lg border border-line px-3 py-1.5 text-xs text-ink-300 hover:text-ink-100 sm:inline"
              >
                View public site
              </Link>
            </div>
          </div>
          {/* Mobile nav strip */}
          <nav className="flex gap-1 overflow-x-auto border-t border-line px-3 py-2 lg:hidden">
            {flatItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs ${
                  active(item.href) ? 'bg-surface-2 text-ink-100' : 'text-ink-400'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="flex-1 px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
