import { forwardRef } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-foreground hover:bg-accent/90 focus-visible:shadow-focus",
  secondary:
    "bg-surface-raised text-foreground ring-1 ring-inset ring-line-strong hover:bg-line/40 focus-visible:shadow-focus",
  ghost: "text-muted hover:text-foreground hover:bg-surface-raised",
  danger:
    "bg-danger/10 text-danger ring-1 ring-inset ring-danger/30 hover:bg-danger/20",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

/** Shell button primitive. Downstream lanes should compose, not restyle. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "secondary", size = "md", className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex select-none items-center justify-center rounded-md font-medium outline-none transition-colors disabled:pointer-events-none disabled:opacity-50",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";
