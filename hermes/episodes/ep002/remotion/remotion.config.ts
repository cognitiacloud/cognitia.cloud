import { Config } from "remotion";

// Episode 002 — vertical Shorts master.
// Dimensions/fps are the single source for the composition (mirrored in tokens.ts).
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setCodec("h264");

// NOTE: 1080x1920 @ 30fps, 1800 frames is declared on <Composition> in Root.tsx.
// Final render remains gated on human approval of the Hermes preview
// (see ../HERMES_HANDOFF.md). Do not wire an auto-publish step here.
