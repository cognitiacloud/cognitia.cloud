"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { NAV_ITEMS } from "@/lib/nav";
import type { CommandResult } from "@/types/shell";

/**
 * Global command + search palette.
 *
 * Lane A ships navigation results out of the box and exposes a `providers` hook
 * so downstream lanes can contribute results (contacts, runs, actions) without
 * touching the shell. A provider receives the current query and returns
 * `CommandResult[]` (sync or async).
 */
export type CommandProvider = (
  query: string,
) => CommandResult[] | Promise<CommandResult[]>;

const NAV_RESULTS: CommandResult[] = NAV_ITEMS.map((item) => ({
  id: `nav:${item.key}`,
  title: item.label,
  subtitle: item.href,
  group: "Navigate",
  href: item.href,
  icon: item.icon,
}));

export function CommandBar({ providers = [] }: { providers?: CommandProvider[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CommandResult[]>(NAV_RESULTS);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl-K to open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Resolve navigation + provider results for the active query.
  useEffect(() => {
    let cancelled = false;
    const q = query.trim().toLowerCase();
    const navMatches = q
      ? NAV_RESULTS.filter((r) => r.title.toLowerCase().includes(q))
      : NAV_RESULTS;

    Promise.all(providers.map((p) => p(query)))
      .then((sets) => {
        if (cancelled) return;
        setResults([...navMatches, ...sets.flat()]);
        setCursor(0);
      })
      .catch(() => {
        if (!cancelled) setResults(navMatches);
      });
    return () => {
      cancelled = true;
    };
  }, [query, providers]);

  const grouped = useMemo(() => {
    const map = new Map<string, CommandResult[]>();
    for (const r of results) {
      const list = map.get(r.group) ?? [];
      list.push(r);
      map.set(r.group, list);
    }
    return [...map.entries()];
  }, [results]);

  const flat = results;

  function run(result?: CommandResult) {
    const target = result ?? flat[cursor];
    if (!target) return;
    setOpen(false);
    if (target.href) router.push(target.href);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group flex h-9 w-full max-w-md items-center gap-2.5 rounded-md border border-line bg-surface-raised px-3 text-sm text-faint outline-none transition-colors hover:border-line-strong focus-visible:shadow-focus"
      >
        <Search className="size-4 shrink-0" />
        <span className="flex-1 text-left">Search or run a command…</span>
        <kbd className="hidden rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] text-faint sm:inline-block">
          ⌘K
        </kbd>
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
          <div
            className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full max-w-xl animate-fade-in overflow-hidden rounded-lg border border-line-strong bg-surface shadow-drawer">
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="size-4 shrink-0 text-faint" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setCursor((c) => Math.min(c + 1, flat.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setCursor((c) => Math.max(c - 1, 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    run();
                  }
                }}
                placeholder="Search contacts, runs, meetings — or jump to a page"
                className="h-12 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-faint"
              />
            </div>

            <div className="max-h-[50vh] overflow-y-auto p-2">
              {flat.length === 0 ? (
                <div className="px-3 py-10 text-center text-sm text-muted">
                  No results for “{query}”
                </div>
              ) : (
                grouped.map(([group, items]) => (
                  <div key={group} className="mb-2 last:mb-0">
                    <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-faint">
                      {group}
                    </p>
                    {items.map((item) => {
                      const idx = flat.indexOf(item);
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          onMouseEnter={() => setCursor(idx)}
                          onClick={() => run(item)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
                            idx === cursor
                              ? "bg-surface-raised text-foreground"
                              : "text-muted",
                          )}
                        >
                          {Icon ? (
                            <Icon className="size-4 shrink-0 text-faint" strokeWidth={1.85} />
                          ) : null}
                          <span className="flex-1 truncate">{item.title}</span>
                          {item.subtitle ? (
                            <span className="truncate font-mono text-[11px] text-faint">
                              {item.subtitle}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-[11px] text-faint">
              <span className="flex items-center gap-1">
                <ArrowUp className="size-3" />
                <ArrowDown className="size-3" />
                navigate
              </span>
              <span className="flex items-center gap-1">
                <CornerDownLeft className="size-3" />
                select
              </span>
              <span className="ml-auto">esc to close</span>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
