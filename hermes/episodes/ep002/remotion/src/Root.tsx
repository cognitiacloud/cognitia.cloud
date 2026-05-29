import React from "react";
import { Composition } from "remotion";
import { Episode002 } from "./Episode002";
import { VIDEO } from "./tokens";

/**
 * Composition registry. One master composition for Episode 002.
 * Preview in Remotion Studio (`npm run dev`). Final render stays gated on
 * human approval — see ../../HERMES_HANDOFF.md.
 */
export const RemotionRoot: React.FC = () => (
  <Composition
    id="Episode002"
    component={Episode002}
    durationInFrames={VIDEO.durationInFrames}
    fps={VIDEO.fps}
    width={VIDEO.width}
    height={VIDEO.height}
  />
);
