/**
 * Cognitia Republic — design tokens (code mirror of ../../DESIGN_SYSTEM.md).
 * Single source of visual truth for Episode 002. No magic numbers in components.
 */

export const VIDEO = {
  width: 1080,
  height: 1920,
  fps: 30,
  durationInFrames: 1800, // 60s
} as const;

export const COLORS = {
  bgBase: "#0A0E14",
  bgRaised: "#0D1117",
  surface: "#11161F",
  surfaceAlt: "#161C26",
  hairline: "rgba(255,255,255,0.10)",
  textPrimary: "#E6EDF3",
  textMuted: "#8B949E",
  textFaint: "#566070",
  accent: "#58A6FF",
  accentDim: "#1F6FEB",
  statePass: "#3FB950",
  stateWarn: "#F0883E",
  scrim: "rgba(7,10,15,0.7)",
} as const;

export const FONTS = {
  // Resolve via @remotion/google-fonts at component load (Inter + JetBrains Mono).
  sans: "Inter, system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
} as const;

// Type scale (px @1080w). See DESIGN_SYSTEM §2.
export const TYPE = {
  headline: { size: 108, weight: 800, tracking: "-0.02em", lineHeight: 1.05 },
  sub: { size: 48, weight: 600, tracking: "-0.01em", lineHeight: 1.15 },
  kicker: { size: 30, weight: 700, tracking: "0.18em", lineHeight: 1.2 },
  caption: { size: 58, weight: 700, tracking: "-0.01em", lineHeight: 1.15 },
  body: { size: 36, weight: 500, tracking: "0", lineHeight: 1.4 },
  mono: { size: 34, weight: 500, tracking: "0", lineHeight: 1.4 },
} as const;

// 8px base spacing scale.
export const SPACE = { xs: 8, sm: 16, md: 24, lg: 32, xl: 48, xxl: 64, xxxl: 96 } as const;

export const RADII = { card: 24, chip: 16, terminal: 12 } as const;

export const SHADOW = { card: "0 20px 60px rgba(0,0,0,0.55)" } as const;

// Shorts safe zones (DESIGN_SYSTEM §7), in px.
export const SAFE = { top: 220, bottom: 480, right: 160, left: 64 } as const;

// Scene frame budgets (mirrors STORYBOARD scene map). [in, out) at 30fps.
export const SCENES = {
  hook: { from: 0, durationInFrames: 210 },
  problem: { from: 210, durationInFrames: 240 },
  pipeline: { from: 450, durationInFrames: 270 },
  realProof: { from: 720, durationInFrames: 420 },
  failure: { from: 1140, durationInFrames: 300 },
  lesson: { from: 1440, durationInFrames: 210 },
  cta: { from: 1650, durationInFrames: 150 },
} as const;

export const SHADOW_CARD = SHADOW.card;
