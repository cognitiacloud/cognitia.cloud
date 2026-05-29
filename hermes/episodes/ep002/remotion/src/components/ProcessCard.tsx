import React from "react";
import { COLORS, FONTS, TYPE, RADII, SPACE } from "../tokens";
import type { ArtifactChip } from "../data/episode-002";

/**
 * Artifact chip — name · size · status. Renders a REAL produced artifact, not
 * a mockup card (the v1 "fake process card" is explicitly forbidden). Used as
 * a bottom-rail chip in RealProofScene.
 */
export const ProcessCard: React.FC<{ chip: ArtifactChip; done?: boolean }> = ({
  chip,
  done = true,
}) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: SPACE.sm,
      background: COLORS.surfaceAlt,
      border: `1px solid ${COLORS.hairline}`,
      borderRadius: RADII.chip,
      padding: `${SPACE.sm}px ${SPACE.md}px`,
      fontFamily: FONTS.mono,
      fontSize: TYPE.body.size,
      color: COLORS.textPrimary,
    }}
  >
    <span
      style={{
        width: 10,
        height: 10,
        borderRadius: 5,
        background: done ? COLORS.statePass : COLORS.textFaint,
      }}
    />
    <span>{chip.name}</span>
    <span style={{ color: COLORS.textMuted }}>{chip.size}</span>
  </div>
);
