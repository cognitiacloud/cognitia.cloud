"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { NAV_ITEMS, NAV_SECTIONS, activeRoute } from "@/lib/nav";
import { ShieldCheck } from "lucide-react";

/**
 * Primary navigation rail. Fixed width, full height, owns the route list.
 * Mobile open/close is driven by `open`/`onClose` from the shell layout.
 */
export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const active = activeRoute(pathname);

  return (
    <>
      {/* Mobile scrim */}
      <div
        className={cn(
          "fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden",
          open ? "block animate-fade-in" : "hidden",
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[var(--sidebar-w)] flex-col border-r border-line bg-surface",
          "transition-transform duration-200 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <BrandMark />

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_SECTIONS.map((section) => {
            const items = NAV_ITEMS.filter((i) => i.section === section.id);
            if (items.length === 0) return null;
            return (
              <div key={section.id} className="mb-6 last:mb-0">
                <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-faint">
                  {section.label}
                </p>
                <ul className="space-y-0.5">
                  {items.map((item) => {
                    const isActive = active?.key === item.key;
                    const Icon = item.icon;
                    return (
                      <li key={item.key}>
                        <Link
                          href={item.href}
                          onClick={onClose}
                          aria-current={isActive ? "page" : undefined}
                          className={cn(
                            "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:shadow-focus",
                            isActive
                              ? "bg-surface-raised text-foreground"
                              : "text-muted hover:bg-surface-raised/60 hover:text-foreground",
                          )}
                        >
                          <Icon
                            className={cn(
                              "size-[18px] shrink-0",
                              isActive ? "text-accent" : "text-faint group-hover:text-muted",
                            )}
                            strokeWidth={1.85}
                          />
                          <span className="flex-1 truncate">{item.label}</span>
                          {typeof item.badge === "number" && item.badge > 0 ? (
                            <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">
                              {item.badge}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        <GovernanceFooter />
      </aside>
    </>
  );
}

function BrandMark() {
  return (
    <div className="flex h-[var(--topbar-h)] items-center gap-2.5 border-b border-line px-5">
      <div className="grid size-7 place-items-center rounded-md bg-accent text-accent-foreground">
        <ShieldCheck className="size-4" strokeWidth={2.25} />
      </div>
      <div className="leading-tight">
        <div className="text-sm font-semibold tracking-tight text-foreground">
          Cognitia
        </div>
        <div className="text-[10px] uppercase tracking-wider text-faint">
          Revenue Operator
        </div>
      </div>
    </div>
  );
}

function GovernanceFooter() {
  return (
    <div className="border-t border-line p-3">
      <div className="flex items-center gap-2.5 rounded-md bg-surface-raised px-3 py-2.5">
        <span className="size-2 shrink-0 rounded-full bg-success shadow-[0_0_8px] shadow-success/60" />
        <div className="min-w-0 leading-tight">
          <div className="truncate text-xs font-medium text-foreground">
            Governance active
          </div>
          <div className="truncate text-[10px] text-faint">
            Human-in-the-loop enforced
          </div>
        </div>
      </div>
    </div>
  );
}
