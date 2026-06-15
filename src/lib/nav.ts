import {
  LayoutDashboard,
  ShieldCheck,
  PlayCircle,
  Users,
  CalendarClock,
  ScrollText,
  Plug,
  Settings,
} from "lucide-react";
import type { NavItem } from "@/types/shell";

/**
 * Canonical navigation model. Route structure for the operator shell lives here
 * so the sidebar, command bar, and breadcrumbs stay in sync. Downstream lanes
 * own the *content* of each route; the route list itself is a Lane A contract.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    key: "overview",
    label: "Overview",
    href: "/overview",
    icon: LayoutDashboard,
    section: "operate",
  },
  {
    key: "approvals",
    label: "Approvals",
    href: "/approvals",
    icon: ShieldCheck,
    section: "operate",
    badge: 0,
  },
  {
    key: "runs",
    label: "Runs",
    href: "/runs",
    icon: PlayCircle,
    section: "operate",
  },
  {
    key: "contacts",
    label: "Contacts",
    href: "/contacts",
    icon: Users,
    section: "context",
  },
  {
    key: "meetings",
    label: "Meetings",
    href: "/meetings",
    icon: CalendarClock,
    section: "context",
  },
  {
    key: "audit",
    label: "Audit",
    href: "/audit",
    icon: ScrollText,
    section: "context",
  },
  {
    key: "integrations",
    label: "Integrations",
    href: "/integrations",
    icon: Plug,
    section: "system",
  },
  {
    key: "settings",
    label: "Settings",
    href: "/settings",
    icon: Settings,
    section: "system",
  },
];

export const NAV_SECTIONS: { id: NavItem["section"]; label: string }[] = [
  { id: "operate", label: "Operate" },
  { id: "context", label: "Context" },
  { id: "system", label: "System" },
];

/** Resolve the active nav item from a pathname (longest-prefix match). */
export function activeRoute(pathname: string): NavItem | undefined {
  return [...NAV_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}
