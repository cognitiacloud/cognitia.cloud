import { AppShell } from "@/components/shell";

/**
 * All operator routes live under this group so they share one shell instance.
 * The route group `(dashboard)` keeps the URL flat (e.g. `/overview`) while
 * isolating the chrome from the root layout.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
