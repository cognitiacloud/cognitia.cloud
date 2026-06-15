import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import type { StatusTone } from "@/types/shell";

const DELTA_TONE: Record<"up" | "down" | "flat", string> = {
  up: "text-success",
  down: "text-danger",
  flat: "text-muted",
};

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  /** Trend annotation, e.g. "+12% vs last week". */
  delta?: { direction: "up" | "down" | "flat"; label: string };
  tone?: StatusTone;
  className?: string;
}

/**
 * Headline metric tile for the overview grid. Visually-led, low text density:
 * one number, one label, one optional trend.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  delta,
  tone = "neutral",
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-line bg-surface p-5 shadow-card",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-faint">
          {label}
        </span>
        {Icon ? (
          <Icon
            className={cn(
              "size-4",
              tone === "accent" ? "text-accent" : "text-faint",
            )}
            strokeWidth={1.75}
          />
        ) : null}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </div>
      {delta ? (
        <div className={cn("mt-2 text-xs", DELTA_TONE[delta.direction])}>
          {delta.label}
        </div>
      ) : null}
    </div>
  );
}
