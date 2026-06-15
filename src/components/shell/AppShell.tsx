"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

/**
 * The operator shell frame: fixed sidebar + sticky topbar + a single scrolling
 * main region. Routes render their content into `children`; everything else here
 * is chrome that stays mounted across navigations.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="lg:pl-[var(--sidebar-w)]">
        <Topbar onMenu={() => setNavOpen(true)} />
        {/* The one main scroll region for page content. */}
        <main className="min-h-[calc(100vh-var(--topbar-h))]">{children}</main>
      </div>
    </div>
  );
}
