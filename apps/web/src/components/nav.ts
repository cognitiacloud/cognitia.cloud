import type { IconName } from './iconNames';

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** External to the dashboard route group (renders its own chrome). */
  standalone?: boolean;
}

/** Operator console navigation — the 28→50 revenue-operator loop, in order. */
export const NAV: NavItem[] = [
  { href: '/overview', label: 'Overview', icon: 'overview' },
  { href: '/approvals', label: 'Approvals', icon: 'approvals' },
  { href: '/runs', label: 'Agent Runs', icon: 'runs' },
  { href: '/contacts', label: 'Contacts', icon: 'contacts' },
  { href: '/meetings', label: 'Meetings', icon: 'meetings' },
  { href: '/audit', label: 'Audit & Trust', icon: 'audit' },
  { href: '/integrations', label: 'Integrations', icon: 'integrations' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
];
