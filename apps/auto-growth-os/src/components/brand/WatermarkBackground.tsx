// components/brand/WatermarkBackground.tsx
// Fixed, app-wide light backdrop: off-white canvas, soft gold/cyan tints, and a
// very faint tiled "COGNITIA" wordmark. Mounted once in the root layout.

export function WatermarkBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Base canvas */}
      <div className="absolute inset-0 bg-canvas" />
      {/* Soft brand tints */}
      <div className="absolute -top-40 -left-32 h-[30rem] w-[30rem] rounded-full bg-cyan-400/[0.06] blur-[130px]" />
      <div className="absolute top-1/3 -right-32 h-[28rem] w-[28rem] rounded-full bg-gold-400/[0.07] blur-[140px]" />
      {/* Faint tiled wordmark */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.022]">
        <defs>
          <pattern
            id="cognitia-watermark"
            width="360"
            height="190"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-18)"
          >
            <text
              x="0"
              y="40"
              fill="#0a1124"
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
    </div>
  );
}
