import React from "react";
import { COLORS, FONTS, TYPE, SPACE } from "../tokens";

/**
 * Honest scorecard: worked (green) vs didn't-yet (amber) + a human-review
 * number. Must always show ≥1 "not yet" row (anti-hype credibility gate).
 */
export const Scorecard: React.FC<{
  worked: string[];
  notYet: string[];
  humanFrames: number;
}> = ({ worked, notYet, humanFrames }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: SPACE.lg, fontFamily: FONTS.sans }}>
    <Row tone={COLORS.statePass} label="Worked" items={worked} />
    <Row tone={COLORS.stateWarn} label="Didn't, yet" items={notYet} />
    <div style={{ display: "flex", alignItems: "baseline", gap: SPACE.md }}>
      <span style={{ fontSize: 96, fontWeight: 800, color: COLORS.textPrimary }}>
        {humanFrames} frame{humanFrames === 1 ? "" : "s"}
      </span>
      <span style={{ fontSize: TYPE.body.size, color: COLORS.textMuted }}>
        still reviewed by a human
      </span>
    </div>
  </div>
);

const Row: React.FC<{ tone: string; label: string; items: string[] }> = ({ tone, label, items }) => (
  <div>
    <div style={{ color: tone, fontWeight: 700, marginBottom: SPACE.sm }}>{label}</div>
    <div style={{ color: COLORS.textPrimary, fontSize: TYPE.sub.size }}>{items.join(" · ")}</div>
  </div>
);
