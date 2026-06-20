'use client';

// components/brand/SiteHeader.tsx
// Configurable sticky header used by the public-dealer and sales chrome. The
// portal uses its own PortalShell sidebar instead.
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { ButtonLink } from '@/components/ui/Button';

export function SiteHeader({
  logo,
  nav,
  cta,
  ctaVariant = 'gold',
}: {
  logo: ReactNode;
  nav: { href: string; label: string }[];
  cta: { href: string; label: string };
  ctaVariant?: 'gold' | 'navy';
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="shrink-0" aria-label="Home">
          {logo}
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {nav.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative rounded-full px-3.5 py-2 text-sm transition ${
                  active ? 'text-ink-100' : 'text-ink-300 hover:bg-surface-2 hover:text-ink-100'
                }`}
              >
                {link.label}
                {active && (
                  <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-gold-400 to-gold-500" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="hidden lg:block">
          <ButtonLink href={cta.href} variant={ctaVariant} size="sm">
            {cta.label}
          </ButtonLink>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line text-ink-200 lg:hidden"
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            {open ? (
              <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <nav className="border-t border-line bg-white px-4 py-3 lg:hidden">
          <ul className="flex flex-col gap-1">
            {nav.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`block rounded-lg px-3 py-2.5 text-sm ${
                    isActive(link.href) ? 'bg-surface-2 text-ink-100' : 'text-ink-300'
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li className="pt-2">
              <ButtonLink href={cta.href} variant={ctaVariant} size="sm" className="w-full">
                {cta.label}
              </ButtonLink>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
