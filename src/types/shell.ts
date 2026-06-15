import type { LucideIcon } from "lucide-react";

/**
 * Shared shell contracts (Lane A).
 *
 * These types are the seam between the app shell and downstream lanes. Lanes
 * that render page content, command results, or status surfaces should import
 * from here rather than redefining shapes.
 */

/** Top-level navigation destinations rendered in the sidebar. */
export type RouteKey =
  | "overview"
  | "approvals"
  | "runs"
  | "contacts"
  | "meetings"
  | "audit"
  | "integrations"
  | "settings";

export interface NavItem {
  key: RouteKey;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Optional live count surfaced as a pill (e.g. pending approvals). */
  badge?: number;
  /** Grouping for the sidebar; controls visual section dividers. */
  section: "operate" | "context" | "system";
}

/** Semantic status used across badges, runs, approvals, and audit rows. */
export type StatusTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "accent";

/** Generic async state envelope downstream lanes can render uniformly. */
export type AsyncState<T> =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error"; error: ShellError }
  | { status: "ready"; data: T };

export interface ShellError {
  title: string;
  message: string;
  /** Optional machine code for support/audit correlation. */
  code?: string;
}

/** A single result returned to the command bar by a downstream provider. */
export interface CommandResult {
  id: string;
  title: string;
  subtitle?: string;
  group: "Navigate" | "Actions" | "Contacts" | "Runs" | "Meetings";
  href?: string;
  icon?: LucideIcon;
}
