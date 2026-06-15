import { cn } from "@/lib/cn";
import { Skeleton } from "./Skeleton";

/**
 * Generic loading placeholder for a page body. Mirrors the rhythm of a typical
 * stat-row + table layout so the transition to loaded content is calm.
 */
export function LoadingState({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)} aria-busy aria-live="polite">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-line bg-surface p-5 shadow-card"
          >
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-4 h-7 w-28" />
            <Skeleton className="mt-3 h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-line bg-surface shadow-card">
        <div className="border-b border-line p-4">
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="divide-y divide-line">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-3 w-1/4" />
              <Skeleton className="h-3 w-1/5" />
              <Skeleton className="ml-auto h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
