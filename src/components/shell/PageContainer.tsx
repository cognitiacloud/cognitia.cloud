import { cn } from "@/lib/cn";

/**
 * Standard page body wrapper. Sits inside the shell's single scroll region and
 * constrains content to a comfortable measure. Every route renders its content
 * inside one of these so spacing stays uniform across lanes.
 */
export function PageContainer({
  children,
  className,
  size = "default",
}: {
  children: React.ReactNode;
  className?: string;
  /** `wide` for dense tables, `default` for most pages. */
  size?: "default" | "wide";
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-6 py-6 lg:px-8",
        size === "wide" ? "max-w-[1600px]" : "max-w-[1200px]",
        className,
      )}
    >
      {children}
    </div>
  );
}
