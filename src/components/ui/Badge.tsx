import { cn } from "@/lib/cn";
import type { StatusTone } from "@/types/shell";

const TONE: Record<StatusTone, string> = {
  neutral: "bg-surface-raised text-muted ring-line",
  success: "bg-success/10 text-success ring-success/25",
  warning: "bg-warning/10 text-warning ring-warning/25",
  danger: "bg-danger/10 text-danger ring-danger/25",
  info: "bg-info/10 text-info ring-info/25",
  accent: "bg-accent-soft text-accent ring-accent/25",
};

export interface BadgeProps {
  tone?: StatusTone;
  children: React.ReactNode;
  /** Renders a leading status dot. */
  dot?: boolean;
  className?: string;
}

/** Compact status pill used across runs, approvals, and audit rows. */
export function Badge({ tone = "neutral", children, dot, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONE[tone],
        className,
      )}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}
