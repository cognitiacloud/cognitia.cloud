// components/brand/CognitiaMark.tsx
// Inline-SVG Cognitia logomark (no external assets). Hexagon shell in gold with a
// cyan→mint "C" arc and a gold network node.

export function CognitiaMark({
  size = 36,
  className = '',
  title = 'Cognitia',
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      role="img"
      aria-label={title}
      className={className}
    >
      <defs>
        <linearGradient id="cgGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f0d480" />
          <stop offset="1" stopColor="#c9a227" />
        </linearGradient>
        <linearGradient id="cgTech" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6fe2f0" />
          <stop offset="1" stopColor="#4fe0b0" />
        </linearGradient>
      </defs>
      <path
        d="M20 2 L35.6 11 L35.6 29 L20 38 L4.4 29 L4.4 11 Z"
        fill="url(#cgGold)"
        fillOpacity="0.1"
        stroke="url(#cgGold)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M26.4 13.6 A9 9 0 1 0 26.4 26.4"
        fill="none"
        stroke="url(#cgTech)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="26.6" cy="20" r="2.4" fill="url(#cgGold)" />
    </svg>
  );
}

export function Wordmark({
  className = '',
  showProduct = true,
}: {
  className?: string;
  showProduct?: boolean;
}) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <CognitiaMark size={32} />
      <span className="flex flex-col leading-none">
        <span className="font-display text-lg font-semibold tracking-tight text-ink-100">
          Cognitia
        </span>
        {showProduct && (
          <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-cyan-300/80">
            Auto Growth OS
          </span>
        )}
      </span>
    </span>
  );
}
