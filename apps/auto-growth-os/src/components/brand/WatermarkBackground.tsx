// components/brand/WatermarkBackground.tsx
// Fixed, app-wide backdrop: navy gradient glows + a subtly tiled "COGNITIA"
// watermark. Mounted once in the root layout so branding repeats on every page.

export function WatermarkBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Base wash */}
      <div className="absolute inset-0 bg-navy-950" />
      {/* Accent glows */}
      <div className="absolute -top-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-cyan-400/10 blur-[120px]" />
      <div className="absolute top-1/3 -right-32 h-[26rem] w-[26rem] rounded-full bg-gold-500/10 blur-[130px]" />
      <div className="absolute bottom-0 left-1/4 h-[24rem] w-[24rem] rounded-full bg-mint-400/[0.06] blur-[120px]" />
      {/* Tiled wordmark watermark */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.04]">
        <defs>
          <pattern
            id="cognitia-watermark"
            width="340"
            height="180"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-18)"
          >
            <text
              x="0"
              y="40"
              fill="currentColor"
              className="text-ink-100"
              style={{
                fontFamily: 'var(--font-display), sans-serif',
                fontSize: '30px',
                fontWeight: 700,
                letterSpacing: '0.18em',
              }}
            >
              COGNITIA
            </text>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#cognitia-watermark)" />
      </svg>
      {/* Top vignette for header legibility */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-navy-950 to-transparent" />
    </div>
  );
}
