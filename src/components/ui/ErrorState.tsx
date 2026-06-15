"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./Button";
import type { ShellError } from "@/types/shell";

export interface ErrorStateProps {
  error?: Partial<ShellError>;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}

/** Canonical error surface used by route `error.tsx` and inline failures. */
export function ErrorState({ error, onRetry, className, compact }: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "px-6 py-10" : "px-6 py-16",
        className,
      )}
    >
      <div className="grid size-11 place-items-center rounded-full border border-danger/30 bg-danger/10 text-danger">
        <AlertTriangle className="size-5" strokeWidth={1.75} />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-foreground">
        {error?.title ?? "Something went wrong"}
      </h3>
      <p className="mt-1 max-w-sm text-pretty text-xs leading-relaxed text-muted">
        {error?.message ??
          "This panel failed to load. Retry, or check the audit log for details."}
      </p>
      {error?.code ? (
        <code className="mt-3 rounded bg-surface-raised px-2 py-1 font-mono text-[11px] text-faint">
          {error.code}
        </code>
      ) : null}
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
