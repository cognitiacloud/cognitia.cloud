import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Kicker } from "../components/Kicker";
import { PipelineMap } from "../components/PipelineMap";
import { COLORS, FONTS, TYPE, SAFE, SPACE, VIDEO } from "../tokens";
import { EPISODE_002 } from "../data/episode-002";

/**
 * S3 · Pipeline map (00:15–00:24). B-roll (avatar hidden).
 * Nodes light L→R ~150ms apart; edges draw; QC node foreshadows S5.
 * See STORYBOARD S3.
 */
export const PipelineScene: React.FC = () => {
  const frame = useCurrentFrame();
  const step = Math.floor(frame / (0.15 * VIDEO.fps)); // ~150ms cadence
  return (
    <AbsoluteFill style={{ padding: SAFE.left, paddingTop: SAFE.top }}>
      <Kicker>THE ENGINE</Kicker>
      <div style={{ marginTop: SPACE.xxl }}>
        <PipelineMap nodes={EPISODE_002.pipeline} activeIndex={step} />
      </div>
      <div
        style={{
          marginTop: SPACE.xl,
          fontFamily: FONTS.mono,
          fontSize: TYPE.body.size,
          color: COLORS.textMuted,
        }}
      >
        one command · six stages · one gate
      </div>
    </AbsoluteFill>
  );
};
