import { cn } from "@/lib/cn";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Removes inner padding for tables / media that bleed to the edge. */
  flush?: boolean;
  /** Adds hover affordance for clickable cards. */
  interactive?: boolean;
}

/** Base surface primitive — the building block for every panel in the shell. */
export function Card({ flush, interactive, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-line bg-surface shadow-card",
        !flush && "p-5",
        interactive &&
          "cursor-pointer transition-colors hover:border-line-strong hover:bg-surface-raised",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-xs text-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
