// components/ui/Button.tsx
import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'gold' | 'navy' | 'outline' | 'ghost' | 'tech';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  gold: 'cta-gold font-semibold',
  navy: 'cta-navy font-semibold',
  tech: 'border border-cyan-400/40 bg-cyan-400/10 text-cyan-700 hover:bg-cyan-400/20',
  outline: 'border border-line-strong text-ink-100 hover:border-cyan-400/50 hover:bg-surface-2',
  ghost: 'text-ink-200 hover:bg-surface-2',
};

const SIZES: Record<Size, string> = {
  sm: 'px-3.5 py-2 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
};

const base =
  'inline-flex items-center justify-center gap-2 rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:opacity-50 disabled:pointer-events-none';

export function Button({
  children,
  variant = 'gold',
  size = 'md',
  className = '',
  ...rest
}: {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`${base} ${VARIANTS[variant]} ${SIZES[size]} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  children,
  href,
  variant = 'gold',
  size = 'md',
  className = '',
  external = false,
}: {
  children: ReactNode;
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  external?: boolean;
}) {
  const cls = `${base} ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}
