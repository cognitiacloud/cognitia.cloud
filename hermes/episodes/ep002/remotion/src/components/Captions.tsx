import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { COLORS, FONTS, TYPE, SAFE } from "../tokens";
import type { CaptionChunk } from "../data/episode-002";

/**
 * Karaoke caption band (DESIGN_SYSTEM §4). Global layer driven by the VO
 * timeline. Baseline ≈78% height, above the PiP card, inside Shorts safe zone.
 * - ≤4 words/line, ≤2 lines, phrase-chunked
 * - active word -> accent; past -> white; upcoming -> 55%
 * - soft radial scrim behind the band only (no solid box)
 * Scaffold: layout + active-chunk selection; word-level highlight is stubbed.
 */
export const Captions: React.FC<{ chunks: CaptionChunk[] }> = ({ chunks }) => {
  const frame = useCurrentFrame();
  const active = chunks.find((c) => frame >= c.fromFrame && frame < c.toFrame);
  if (!active) return null;

  const tint =
    active.tint === "pass"
      ? COLORS.statePass
      : active.tint === "warn"
        ? COLORS.stateWarn
        : COLORS.accent;

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center" }}>
      {/* radial scrim behind the band only */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          height: 520,
          width: "100%",
          background: `radial-gradient(120% 80% at 50% 100%, ${COLORS.scrim} 0%, rgba(7,10,15,0) 70%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: SAFE.bottom - 60, // baseline ≈78% height, above PiP/UI
          maxWidth: 1080 - SAFE.left - SAFE.right,
          textAlign: "center",
          fontFamily: FONTS.sans,
          fontSize: TYPE.caption.size,
          fontWeight: TYPE.caption.weight,
          letterSpacing: TYPE.caption.tracking,
          lineHeight: TYPE.caption.lineHeight,
          color: COLORS.textPrimary,
        }}
      >
        {/* TODO build phase: split active.text into words, highlight active
            word with `tint`, dim upcoming words to 55% opacity. */}
        <span style={{ color: tint }}>{active.text}</span>
      </div>
    </AbsoluteFill>
  );
};
