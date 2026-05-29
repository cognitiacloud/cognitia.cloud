import React from "react";
import { AbsoluteFill } from "remotion";
import { COLORS, FONTS, TYPE, SAFE, SPACE } from "../tokens";

/**
 * S7 · CTA / sign-off (00:55–01:00). Everything fades to the lockup; wordmark
 * tracks in (0.3em→0.08em); CTA arrow nudges right ×2. No fake metrics.
 * See STORYBOARD S7.
 */
export const CTAScene: React.FC = () => (
  <AbsoluteFill
    style={{
      padding: SAFE.left,
      justifyContent: "center",
      alignItems: "center",
      textAlign: "center",
      fontFamily: FONTS.sans,
    }}
  >
    <div
      style={{
        fontSize: TYPE.headline.size,
        fontWeight: TYPE.headline.weight,
        letterSpacing: TYPE.headline.tracking,
        color: COLORS.textPrimary,
      }}
    >
      Automated, not unattended.
    </div>
    <div style={{ marginTop: SPACE.md, fontSize: TYPE.sub.size, color: COLORS.textMuted }}>
      That's the honest version.
    </div>
    <div style={{ marginTop: SPACE.xl, fontSize: TYPE.sub.size, color: COLORS.accent }}>
      Follow for run #42 →
    </div>
    {/* wordmark lockup — tracking-in animation in build phase */}
    <div
      style={{
        marginTop: SPACE.xxxl,
        fontSize: TYPE.kicker.size,
        fontWeight: 700,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: COLORS.textPrimary,
      }}
    >
      COGNITIA REPUBLIC
    </div>
  </AbsoluteFill>
);
