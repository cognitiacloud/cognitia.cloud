import React from "react";
import { AbsoluteFill } from "remotion";
import { Kicker } from "../components/Kicker";
import { COLORS, FONTS, TYPE, SAFE, SPACE, RADII } from "../tokens";

/**
 * S2 · Problem — pitch vs reality (00:07–00:15).
 * Two columns wipe in from center; "reality" text gets a brief chromatic
 * jitter (tension) then locks. See STORYBOARD S2.
 */
export const ProblemScene: React.FC = () => (
  <AbsoluteFill style={{ padding: SAFE.left, paddingTop: SAFE.top }}>
    <Kicker>THE PITCH vs THE TRUTH</Kicker>
    <div style={{ display: "flex", gap: SPACE.lg, marginTop: SPACE.xxl }}>
      <Column title="The pitch" tone={COLORS.textMuted} body="script → voice → avatar → edit → done" />
      <Column title="The reality" tone={COLORS.stateWarn} body="7 tools. 7 ways to fail." />
    </div>
    <div
      style={{
        marginTop: SPACE.xl,
        alignSelf: "flex-start",
        background: COLORS.surfaceAlt,
        border: `1px solid ${COLORS.hairline}`,
        borderRadius: RADII.chip,
        padding: `${SPACE.sm}px ${SPACE.md}px`,
        fontFamily: FONTS.sans,
        fontSize: TYPE.body.size,
        color: COLORS.textPrimary,
      }}
    >
      so I instrumented every stage
    </div>
  </AbsoluteFill>
);

const Column: React.FC<{ title: string; tone: string; body: string }> = ({ title, tone, body }) => (
  <div
    style={{
      flex: 1,
      background: COLORS.surface,
      border: `1px solid ${COLORS.hairline}`,
      borderRadius: RADII.card,
      padding: SPACE.lg,
      fontFamily: FONTS.sans,
    }}
  >
    <div style={{ color: tone, fontWeight: 700, marginBottom: SPACE.md }}>{title}</div>
    <div style={{ color: COLORS.textPrimary, fontSize: TYPE.sub.size, lineHeight: 1.3 }}>{body}</div>
  </div>
);
