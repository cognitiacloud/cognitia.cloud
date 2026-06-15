"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Footer slot for actions (approve/reject, save, etc.). */
  footer?: React.ReactNode;
  children: React.ReactNode;
  width?: "sm" | "md" | "lg";
}

const WIDTH: Record<NonNullable<DrawerProps["width"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-xl",
};

/**
 * Right-anchored detail drawer. This is the shell's primary pattern for
 * inspecting a single record (an approval, a run, a contact) without leaving the
 * main scroll region. Downstream lanes provide the body and footer content.
 */
export function Drawer({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  width = "md",
}: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 animate-fade-in bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={cn(
          "absolute inset-y-0 right-0 flex w-full flex-col border-l border-line bg-surface shadow-drawer animate-slide-in",
          WIDTH[width],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            {title ? (
              <h2 className="truncate text-sm font-semibold text-foreground">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 truncate text-xs text-muted">{description}</p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 shrink-0 place-items-center rounded-md text-muted outline-none transition-colors hover:bg-surface-raised hover:text-foreground focus-visible:shadow-focus"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer ? (
          <div className="border-t border-line px-5 py-4">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
