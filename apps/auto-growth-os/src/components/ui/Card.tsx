// components/ui/Card.tsx
import type { ReactNode } from 'react';

export function Card({
  children,
  className = '',
  hover = false,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  as?: 'div' | 'article' | 'li';
}) {
  return (
    <Tag
      className={`glass rounded-2xl ${
        hover
          ? 'transition duration-200 hover:-translate-y-0.5 hover:border-cyan-400/30 hover:shadow-[0_18px_50px_-20px_rgba(54,210,230,0.35)]'
          : ''
      } ${className}`}
    >
      {children}
    </Tag>
  );
}
