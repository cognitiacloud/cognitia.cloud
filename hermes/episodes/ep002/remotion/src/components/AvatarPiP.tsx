import React from "react";
import { OffthreadVideo, staticFile } from "remotion";
import { COLORS, RADII, SHADOW, SAFE } from "../tokens";
import type { AvatarPresence } from "../data/episode-002";

/**
 * Framed HeyGen avatar PiP (DESIGN_SYSTEM §5). The avatar is NEVER full-screen.
 * - corner: ≤28% frame width, bottom corner
 * - enlarged: ≤40% width (S6 to-camera)
 * - hidden: not rendered
 * Video is muted in composition (VO is the single ElevenLabs master track).
 * Scaffold: card chrome + placement; crop is guaranteed upstream by the QC gate.
 */
const WIDTHS: Record<Exclude<AvatarPresence, "hidden">, number> = {
  corner: Math.round(1080 * 0.28),
  enlarged: Math.round(1080 * 0.4),
};

export const AvatarPiP: React.FC<{
  src: string;
  presence: AvatarPresence;
  side?: "left" | "right"; // bottom-left in S5 so it never covers QC lines
}> = ({ src, presence, side = "right" }) => {
  if (presence === "hidden") return null;
  const width = WIDTHS[presence];
  const height = Math.round((width * 4) / 3); // chest-up portrait box

  return (
    <div
      style={{
        position: "absolute",
        bottom: SAFE.bottom + 120, // above caption band + bottom UI
        [side]: SAFE.left,
        width,
        height,
        borderRadius: RADII.card,
        overflow: "hidden",
        border: `1px solid ${COLORS.hairline}`,
        boxShadow: SHADOW.card,
        background: COLORS.surface,
      }}
    >
      <OffthreadVideo
        src={staticFile(src)}
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }}
      />
      {/* subtle inner vignette so the card reads as a device, not a sticker */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          boxShadow: "inset 0 0 80px rgba(0,0,0,0.45)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
};
