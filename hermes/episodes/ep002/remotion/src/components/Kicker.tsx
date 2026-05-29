import React from "react";
import { COLORS, FONTS, TYPE, SPACE } from "../tokens";

/** Top eyebrow label — UPPERCASE, tracked, hairline underline. */
export const Kicker: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      fontFamily: FONTS.sans,
      fontSize: TYPE.kicker.size,
      fontWeight: TYPE.kicker.weight,
      letterSpacing: TYPE.kicker.tracking,
      textTransform: "uppercase",
      color: COLORS.textMuted,
      paddingBottom: SPACE.sm,
      borderBottom: `1px solid ${COLORS.hairline}`,
      display: "inline-block",
    }}
  >
    {children}
  </div>
);
