import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Kicker } from "../components/Kicker";
import { StatusStamp, ProgressSweep } from "../components/StatusStamp";
import { COLORS, FONTS, TYPE, SAFE, SPACE, SCENES, VIDEO } from "../tokens";
import { EPISODE_002 } from "../data/episode-002";

/**
 * S5 · Failure/fix loop (00:38–00:48). Two beats.
 * Beat A (fail, amber): border flash, lines shake, BLOCKED stamp.
 * Beat B (fix→pass, green): lines crossfade to checks, progress sweep, avatar
 * PiP returns (presence override handled in Episode002). Uses REAL qc JSON.
 * See STORYBOARD S5.
 */
export const FailureScene: React.FC = () => {
  const frame = useCurrentFrame();
  const half = SCENES.failure.durationInFrames / 2;
  const inBeatB = frame >= half;
  const { failure } = EPISODE_002;
  const lines = inBeatB ? failure.fix : failure.fail;
  const tone = inBeatB ? COLORS.statePass : COLORS.stateWarn;
  const sweep = inBeatB ? Math.min(1, (frame - half) / (0.6 * VIDEO.fps)) : 0;

  return (
    <AbsoluteFill
      style={{
        padding: SAFE.left,
        paddingTop: SAFE.top,
        // border flash recolors per beat (amber -> green)
        boxShadow: `inset 0 0 0 4px ${tone}33`,
      }}
    >
      <Kicker>{inBeatB ? "QC GATE · RE-CHECK" : "QC GATE · BLOCKED"}</Kicker>
      <div style={{ marginTop: SPACE.xl }}>
        <StatusStamp label={inBeatB ? "PASSED" : "BLOCKED"} tone={inBeatB ? "pass" : "warn"} />
      </div>
      <div
        style={{
          marginTop: SPACE.xl,
          fontFamily: FONTS.mono,
          fontSize: TYPE.mono.size,
          lineHeight: 1.6,
          color: tone,
        }}
      >
        {lines.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
      {inBeatB ? (
        <div style={{ marginTop: SPACE.xl }}>
          <ProgressSweep progress={sweep} />
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
