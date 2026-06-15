'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { NAV } from './nav';
import { Icon } from './Icon';

/** Dark control-plane sidebar with active-route highlighting. */
export function Sidebar() {
  const pathname = usePathname();
  return (
    <nav className="sidebar" aria-label="Primary">
      <div className="brand">
        <span className="brand-dot" />
        Cognitia
      </div>
      <div className="nav-label">Revenue Operator</div>
      <div className="nav">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={active ? 'nav-item active' : 'nav-item'}
              aria-current={active ? 'page' : undefined}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </div>
      <div className="sidebar-foot">Governed · approval-gated · audited</div>
    </nav>
  );
}
