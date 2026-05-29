import React from "react";
import { AbsoluteFill, Audio, Series, Sequence, staticFile, useCurrentFrame } from "remotion";
import { Backdrop } from "./components/Backdrop";
import { Captions } from "./components/Captions";
import { AvatarPiP } from "./components/AvatarPiP";
import { HookScene } from "./scenes/HookScene";
import { ProblemScene } from "./scenes/ProblemScene";
import { PipelineScene } from "./scenes/PipelineScene";
import { RealProofScene } from "./scenes/RealProofScene";
import { FailureScene } from "./scenes/FailureScene";
import { LessonScene } from "./scenes/LessonScene";
import { CTAScene } from "./scenes/CTAScene";
import { SCENES } from "./tokens";
import { EPISODE_002, AVATAR_PRESENCE, type AvatarPresence } from "./data/episode-002";

/**
 * Master timeline. Scenes run sequentially via <Series> with exact frame
 * budgets from tokens.SCENES. Backdrop, Captions, AvatarPiP and Audio are
 * GLOBAL layers (continuous across cuts). Avatar presence is data-driven per
 * scene; S5 returns to corner in its second half (handled below).
 *
 * Blueprint stage: this wires structure. Final render is gated on human
 * approval of the Hermes preview (see ../../HERMES_HANDOFF.md).
 */
export const Episode002: React.FC = () => {
  return (
    <AbsoluteFill>
      {/* 1. continuous background */}
      <Backdrop />

      {/* 2. scene series */}
      <Series>
        <Series.Sequence durationInFrames={SCENES.hook.durationInFrames}>
          <HookScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.problem.durationInFrames}>
          <ProblemScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.pipeline.durationInFrames}>
          <PipelineScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.realProof.durationInFrames}>
          <RealProofScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.failure.durationInFrames}>
          <FailureScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.lesson.durationInFrames}>
          <LessonScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SCENES.cta.durationInFrames}>
          <CTAScene />
        </Series.Sequence>
      </Series>

      {/* 3. global avatar PiP (presence + side resolved per scene) */}
      <AvatarLayer />

      {/* 4. global karaoke captions off the VO timeline */}
      <Captions chunks={EPISODE_002.captions} />

      {/* 5. single ElevenLabs master VO (+ optional bed under it) */}
      <Audio src={staticFile(EPISODE_002.vo)} />
      {EPISODE_002.bed ? <Audio src={staticFile(EPISODE_002.bed)} volume={0.12} /> : null}
    </AbsoluteFill>
  );
};

/** Resolves which scene we're in and renders the PiP with that presence. */
const AvatarLayer: React.FC = () => {
  const frame = useCurrentFrame();
  const order: (keyof typeof SCENES)[] = [
    "hook",
    "problem",
    "pipeline",
    "realProof",
    "failure",
    "lesson",
    "cta",
  ];
  const current = order.find(
    (k) => frame >= SCENES[k].from && frame < SCENES[k].from + SCENES[k].durationInFrames,
  );
  if (!current) return null;

  let presence: AvatarPresence = AVATAR_PRESENCE[current];
  let side: "left" | "right" = "right";

  // S5: avatar returns (corner, bottom-left) in beat B only.
  if (current === "failure") {
    const half = SCENES.failure.from + SCENES.failure.durationInFrames / 2;
    presence = frame >= half ? "corner" : "hidden";
    side = "left";
  }

  return <AvatarPiP src={EPISODE_002.avatarSrc} presence={presence} side={side} />;
};
