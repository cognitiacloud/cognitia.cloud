/**
 * Shared animation helpers — keep easing consistent across all scenes
 * (DESIGN_SYSTEM / STORYBOARD "global motion grammar").
 * Scaffold: signatures + intent. Fill bodies during the build phase.
 */
import { interpolate, spring } from "remotion";
import { VIDEO } from "./tokens";

/** Standard entrance spring: fast settle, no bounce. Returns 0→1 progress. */
export const enter = (frame: number, delay = 0) =>
  spring({
    frame: frame - delay,
    fps: VIDEO.fps,
    config: { damping: 200, mass: 0.6 },
  });

/** translateY + opacity entrance from a spring progress value. */
export const riseIn = (p: number, distance = 24) => ({
  opacity: p,
  transform: `translateY(${interpolate(p, [0, 1], [distance, 0])}px)`,
});

/** Count a number up over `frames` frames for "measured proof" feel. */
export const countUp = (frame: number, to: number, frames = 12, delay = 0) =>
  interpolate(frame - delay, [0, frames], [0, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

/** 6-frame exit cut (opacity + small rise). */
export const exitCut = (frame: number, at: number) =>
  interpolate(frame, [at, at + 6], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
