import { cn } from "@/lib/cn";

/** Shimmer placeholder used by loading states across the shell. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-surface-raised",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer",
        "after:bg-gradient-to-r after:from-transparent after:via-line/60 after:to-transparent",
        className,
      )}
    />
  );
}
