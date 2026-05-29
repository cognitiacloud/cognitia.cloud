import React from "react";
import { AbsoluteFill } from "remotion";
import { Kicker } from "../components/Kicker";
import { Terminal } from "../components/Terminal";
import { ProcessCard } from "../components/ProcessCard";
import { SAFE, SPACE } from "../tokens";
import { EPISODE_002 } from "../data/episode-002";

/**
 * S4 · Real proof (00:24–00:38) — longest beat, internally chaptered.
 * Terminal types line-by-line; each ✓ pops; artifact chips slide up the
 * bottom rail as their line completes. ALL values from run41 manifest.
 * See STORYBOARD S4. (Per-char typing + chip stagger wired in build phase.)
 */
export const RealProofScene: React.FC = () => {
  const { proof } = EPISODE_002;
  return (
    <AbsoluteFill style={{ padding: SAFE.left, paddingTop: SAFE.top }}>
      <Kicker>{proof.kicker}</Kicker>
      <div style={{ marginTop: SPACE.xxl }}>
        <Terminal rows={proof.rows} />
      </div>
      {/* bottom artifact rail */}
      <div
        style={{
          position: "absolute",
          left: SAFE.left,
          right: SAFE.left,
          bottom: SAFE.bottom + 40,
          display: "flex",
          gap: SPACE.md,
          flexWrap: "wrap",
        }}
      >
        {proof.chips.map((c) => (
          <ProcessCard key={c.name} chip={c} />
        ))}
      </div>
    </AbsoluteFill>
  );
};
