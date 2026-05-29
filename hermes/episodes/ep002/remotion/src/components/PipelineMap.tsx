import React from "react";
import { COLORS, FONTS, TYPE, RADII, SPACE } from "../tokens";

type Node = { id: string; tool: string; label: string };

/**
 * 6-node pipeline graph (Claude → ElevenLabs → HeyGen → FFmpeg → Vision QC →
 * Telegram). Nodes light L→R; edges draw via strokeDashoffset; QC node pulses
 * amber→neutral to foreshadow the failure scene. Maps 1:1 to the real Hermes
 * pipeline (node 05 == hermes/skills/vision-skill).
 * Scaffold: node layout + edge placeholders; sequential reveal in build phase.
 */
export const PipelineMap: React.FC<{ nodes: Node[]; activeIndex?: number }> = ({
  nodes,
  activeIndex = nodes.length,
}) => (
  <div style={{ display: "flex", flexDirection: "column", gap: SPACE.lg }}>
    {nodes.map((n, i) => {
      const lit = i < activeIndex;
      const isGate = n.tool === "VISION QC";
      return (
        <div
          key={n.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: SPACE.md,
            opacity: lit ? 1 : 0.35,
            background: COLORS.surface,
            border: `1px solid ${isGate ? COLORS.stateWarn : COLORS.hairline}`,
            borderRadius: RADII.chip,
            padding: `${SPACE.md}px ${SPACE.lg}px`,
            fontFamily: FONTS.sans,
          }}
        >
          <span style={{ color: COLORS.textFaint, fontFamily: FONTS.mono }}>{n.id}</span>
          <span
            style={{
              color: lit ? COLORS.accent : COLORS.textMuted,
              fontWeight: 700,
              fontSize: TYPE.body.size,
            }}
          >
            {n.tool}
          </span>
          <span style={{ color: COLORS.textMuted, fontSize: TYPE.body.size }}>— {n.label}</span>
          {/* TODO: tool logo (mono SVG) on the right; drawn edge to next node */}
        </div>
      );
    })}
  </div>
);
