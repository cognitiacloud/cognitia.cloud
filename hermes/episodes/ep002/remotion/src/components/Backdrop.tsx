import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COLORS } from "../tokens";

/**
 * Global background layer — gradient canvas + drifting technical grid.
 * Rendered ONCE outside the scene series so it's continuous (parallax 8px
 * over the whole clip). Guarantees we never show flat black (v1 failure).
 * Scaffold: structure + grid intent; tune drift/opacity in build phase.
 */
export const Backdrop: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = (frame / 1800) * 8; // 8px parallax across the clip

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${COLORS.bgRaised} 0%, ${COLORS.bgBase} 100%)`,
      }}
    >
      {/* Dot/line grid overlay — low-opacity hairline, drifts with `drift`. */}
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${COLORS.hairline} 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
          backgroundPosition: `0px ${drift}px`,
          opacity: 0.5,
        }}
      />
      {/* Soft top + corner vignette to add depth. TODO: radial vignettes. */}
    </AbsoluteFill>
  );
};
