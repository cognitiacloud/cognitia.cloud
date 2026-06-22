// lib/routes.ts
// Navigation + redirect maps for the three chrome contexts.

export const PUBLIC_NAV: { href: string; label: string }[] = [
  { href: '/inventory', label: 'Inventory' },
  { href: '/finance', label: 'Finance' },
  { href: '/trade-in', label: 'Trade-In' },
  { href: '/book-test-drive', label: 'Book Test Drive' },
  { href: '/contact', label: 'Contact' },
  { href: '/faq', label: 'FAQ' },
];

export const SALES_NAV: { href: string; label: string }[] = [
  { href: '/dealership-growth-os', label: 'Growth OS' },
  { href: '/discovery', label: 'Discovery' },
  { href: '/modules', label: 'Pricing' },
  { href: '/system-map', label: 'System Map' },
  { href: '/powered-by-cognitia', label: 'Powered by Cognitia' },
  { href: '/meeting', label: 'Demo' },
];

export interface PortalNavItem {
  href: string;
  label: string;
  icon: string;
}

export const PORTAL_NAV: { group: string; items: PortalNavItem[] }[] = [
  {
    group: 'Operate',
    items: [
      { href: '/portal/dashboard', label: 'Dashboard', icon: 'grid' },
      { href: '/portal/leads', label: 'Leads', icon: 'users' },
      { href: '/portal/customers', label: 'Customers', icon: 'heart' },
      { href: '/portal/appointments', label: 'Appointments', icon: 'calendar' },
    ],
  },
  {
    group: 'Inventory & content',
    items: [
      { href: '/portal/inventory', label: 'Inventory', icon: 'car' },
      { href: '/portal/content', label: 'Content', icon: 'doc' },
      { href: '/portal/social', label: 'Social', icon: 'play' },
    ],
  },
  {
    group: 'Trust & governance',
    items: [
      { href: '/portal/ai-approvals', label: 'AI Approvals', icon: 'shield' },
      { href: '/portal/proof', label: 'Proof Ledger', icon: 'check' },
      { href: '/portal/agent-economy', label: 'Agent Economy', icon: 'bot' },
      { href: '/portal/reports', label: 'Reports', icon: 'chart' },
      { href: '/portal/settings', label: 'Settings', icon: 'gear' },
    ],
  },
];

/** Consumed by next.config.mjs async redirects(). */
export const REDIRECTS: { source: string; destination: string; permanent: boolean }[] = [
  { source: '/dashboard', destination: '/portal/dashboard', permanent: false },
  { source: '/customer-mapper', destination: '/portal/customers', permanent: false },
];
