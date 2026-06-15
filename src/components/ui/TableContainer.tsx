import { cn } from "@/lib/cn";

/**
 * Chrome for tabular data: a bordered surface with an optional toolbar header
 * and a horizontally-scrollable body. Downstream lanes drop their own `<table>`
 * (or rows) inside; Lane A owns the frame, not the columns.
 */
export interface TableContainerProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Toolbar slot, right-aligned in the header (filters, actions). */
  toolbar?: React.ReactNode;
  /** Footer slot, e.g. pagination. */
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function TableContainer({
  title,
  description,
  toolbar,
  footer,
  children,
  className,
}: TableContainerProps) {
  const hasHeader = title || description || toolbar;
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-line bg-surface shadow-card",
        className,
      )}
    >
      {hasHeader ? (
        <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title ? (
              <h3 className="truncate text-sm font-semibold text-foreground">
                {title}
              </h3>
            ) : null}
            {description ? (
              <p className="truncate text-xs text-muted">{description}</p>
            ) : null}
          </div>
          {toolbar ? <div className="flex shrink-0 items-center gap-2">{toolbar}</div> : null}
        </div>
      ) : null}
      <div className="overflow-x-auto">{children}</div>
      {footer ? (
        <div className="border-t border-line px-4 py-3 text-xs text-muted">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Lightweight presentational table primitives. These keep header/cell styling
 * consistent without forcing a column model on downstream lanes.
 */
export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return <table className={cn("w-full text-sm", className)}>{children}</table>;
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-faint",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <td className={cn("whitespace-nowrap px-4 py-3 text-foreground", className)}>
      {children}
    </td>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return <thead className="border-b border-line bg-surface-raised/40">{children}</thead>;
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-line">{children}</tbody>;
}

export function Tr({
  children,
  interactive,
  onClick,
}: {
  children: React.ReactNode;
  interactive?: boolean;
  onClick?: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        interactive && "cursor-pointer transition-colors hover:bg-surface-raised/60",
      )}
    >
      {children}
    </tr>
  );
}
