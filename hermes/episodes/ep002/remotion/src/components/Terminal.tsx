import React from "react";
import { COLORS, FONTS, TYPE, RADII, SPACE } from "../tokens";
import type { TerminalRow } from "../data/episode-002";

/**
 * Mono console that renders REAL run rows (not invented UI). Per-char type-in
 * and ✓/✗ pop happen in the build phase via useCurrentFrame; this scaffold
 * lays out the structure and statuses. Carries the "real engine" signal.
 */
export const Terminal: React.FC<{
  rows: TerminalRow[];
  title?: string;
}> = ({ rows, title }) => (
  <div
    style={{
      background: COLORS.surface,
      border: `1px solid ${COLORS.hairline}`,
      borderRadius: RADII.terminal,
      padding: SPACE.lg,
      fontFamily: FONTS.mono,
      fontSize: TYPE.mono.size,
      lineHeight: TYPE.mono.lineHeight,
      color: COLORS.textPrimary,
      width: "100%",
    }}
  >
    {title ? (
      <div style={{ color: COLORS.textFaint, marginBottom: SPACE.sm }}>{title}</div>
    ) : null}
    {rows.map((r, i) => (
      <div key={i} style={{ display: "flex", gap: SPACE.md, whiteSpace: "pre" }}>
        <span style={{ color: r.status === "ok" ? COLORS.statePass : COLORS.stateWarn }}>
          {r.status === "ok" ? "✓" : "✗"}
        </span>
        <span style={{ color: COLORS.accent, minWidth: 130 }}>{r.tool}</span>
        <span style={{ color: COLORS.textPrimary, flex: 1 }}>{r.artifact}</span>
        {r.meta ? <span style={{ color: COLORS.textMuted }}>{r.meta}</span> : null}
        <span style={{ color: COLORS.textMuted }}>{r.duration}</span>
        <span style={{ color: COLORS.textMuted }}>{r.size}</span>
      </div>
    ))}
  </div>
);
