import React from "react";
import { COLORS, FONTS, RADII, SPACE } from "../tokens";

/** BLOCKED / PASSED stamp for the failure/fix scene (scale 1.2→1.0 on entry). */
export const StatusStamp: React.FC<{ label: string; tone: "warn" | "pass" }> = ({
  label,
  tone,
}) => {
  const color = tone === "pass" ? COLORS.statePass : COLORS.stateWarn;
  return (
    <div
      style={{
        display: "inline-block",
        border: `3px solid ${color}`,
        color,
        borderRadius: RADII.chip,
        padding: `${SPACE.sm}px ${SPACE.lg}px`,
        fontFamily: FONTS.sans,
        fontWeight: 800,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        fontSize: 44,
      }}
    >
      {label}
    </div>
  );
};

/** Thin 0→100% sweep used during the "re-render" beat. */
export const ProgressSweep: React.FC<{ progress: number }> = ({ progress }) => (
  <div style={{ height: 6, width: "100%", background: COLORS.surfaceAlt, borderRadius: 3 }}>
    <div
      style={{
        height: "100%",
        width: `${Math.round(progress * 100)}%`,
        background: COLORS.accent,
        borderRadius: 3,
      }}
    />
  </div>
);
