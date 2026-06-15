"use client";

import { usePathname } from "next/navigation";
import { Menu, Bell } from "lucide-react";
import { activeRoute } from "@/lib/nav";
import { CommandBar } from "./CommandBar";

/**
 * Global top bar: mobile nav toggle, breadcrumb/title, command bar, and the
 * operator's status cluster. Spans the main column; the sidebar has its own
 * brand header so the two align at `--topbar-h`.
 */
export function Topbar({ onMenu }: { onMenu: () => void }) {
  const pathname = usePathname();
  const active = activeRoute(pathname);

  return (
    <header className="sticky top-0 z-20 flex h-[var(--topbar-h)] items-center gap-3 border-b border-line bg-canvas/80 px-4 backdrop-blur lg:px-6">
      <button
        onClick={onMenu}
        aria-label="Open navigation"
        className="grid size-9 place-items-center rounded-md text-muted outline-none transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:shadow-focus lg:hidden"
      >
        <Menu className="size-5" />
      </button>

      <div className="hidden min-w-0 items-center gap-2 md:flex">
        <span className="truncate text-sm font-medium text-foreground">
          {active?.label ?? "Operator"}
        </span>
      </div>

      <div className="flex flex-1 justify-center px-2 lg:px-6">
        <CommandBar />
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          aria-label="Notifications"
          className="relative grid size-9 place-items-center rounded-md text-muted outline-none transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:shadow-focus"
        >
          <Bell className="size-[18px]" strokeWidth={1.85} />
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-accent" />
        </button>
        <OperatorChip />
      </div>
    </header>
  );
}

function OperatorChip() {
  return (
    <button className="flex items-center gap-2 rounded-md py-1 pl-1 pr-2 outline-none transition-colors hover:bg-surface-raised focus-visible:shadow-focus">
      <span className="grid size-7 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
        OP
      </span>
      <span className="hidden text-sm font-medium text-foreground sm:inline">
        Operator
      </span>
    </button>
  );
}
