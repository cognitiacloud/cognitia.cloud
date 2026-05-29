import React from "react";
import { AbsoluteFill } from "remotion";
import { Kicker } from "../components/Kicker";
import { Scorecard } from "../components/Scorecard";
import { SAFE, SPACE } from "../tokens";
import { EPISODE_002 } from "../data/episode-002";

/**
 * S6 · Lesson — honest scorecard (00:48–00:55). Avatar PiP enlarged (to-camera).
 * Rows stagger in; "1 frame" counts 0→1 and holds. Must admit ≥1 "not yet".
 * See STORYBOARD S6.
 */
export const LessonScene: React.FC = () => {
  const { scorecard } = EPISODE_002;
  return (
    <AbsoluteFill style={{ padding: SAFE.left, paddingTop: SAFE.top }}>
      <Kicker>THE HONEST SCORECARD</Kicker>
      <div style={{ marginTop: SPACE.xxl }}>
        <Scorecard
          worked={scorecard.worked}
          notYet={scorecard.notYet}
          humanFrames={scorecard.humanFrames}
        />
      </div>
    </AbsoluteFill>
  );
};
