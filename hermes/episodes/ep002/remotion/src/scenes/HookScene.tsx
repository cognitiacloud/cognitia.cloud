import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Kicker } from "../components/Kicker";
import { COLORS, FONTS, TYPE, SAFE, SPACE } from "../tokens";
import { enter, riseIn } from "../anim";

/**
 * S1 · Hook (00:00–00:07).
 * Layers: dim real terminal scrollback (behind) + masked headline + sub.
 * Motion: headline lines mask-reveal upward, staggered 4f. PiP scales in
 * (handled by global AvatarPiP). See STORYBOARD S1.
 */
export const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ padding: SAFE.left, paddingTop: SAFE.top }}>
      {/* TODO build: dim `run41/terminal_boot.txt` scrollback at ~18% opacity behind */}
      <Kicker>COGNITIA REPUBLIC · EP 002</Kicker>
      <div
        style={{
          marginTop: SPACE.xxl,
          fontFamily: FONTS.sans,
          fontSize: TYPE.headline.size,
          fontWeight: TYPE.headline.weight,
          letterSpacing: TYPE.headline.tracking,
          lineHeight: TYPE.headline.lineHeight,
          color: COLORS.textPrimary,
        }}
      >
        <div style={riseIn(enter(frame, 6))}>I automated my entire</div>
        <div style={riseIn(enter(frame, 14))}>AI video pipeline.</div>
      </div>
      <div
        style={{
          marginTop: SPACE.lg,
          ...riseIn(enter(frame, 24)),
          fontFamily: FONTS.sans,
          fontSize: TYPE.sub.size,
          fontWeight: TYPE.sub.weight,
          color: COLORS.textMuted,
        }}
      >
        One prompt in. Finished video out. (In theory.)
      </div>
    </AbsoluteFill>
  );
};
