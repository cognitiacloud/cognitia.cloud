/**
 * Episode 002 content spec — data-driven so the same composition re-renders
 * from any real run's manifest. Values here are PLACEHOLDERS shaped like the
 * real `run41` artifacts; the build phase loads them from
 * ../../assets/run41/* (manifest.json, qc_fail.json, qc_pass.json, captions.json).
 *
 * Sourcing rule (STORYBOARD): if a value isn't in a real run artifact, it does
 * not render. Nothing here is invented UI — it mirrors real artifact shapes.
 */

export type CaptionChunk = {
  text: string; // ≤4 words
  fromFrame: number;
  toFrame: number;
  activeWord?: number; // index for karaoke highlight
  tint?: "accent" | "pass" | "warn";
};

export type TerminalRow = {
  status: "ok" | "fail";
  tool: string;
  artifact: string;
  meta?: string;
  duration: string;
  size: string;
};

export type ArtifactChip = { name: string; size: string };

export type AvatarPresence = "corner" | "enlarged" | "hidden";

export interface EpisodeData {
  vo: string; // staticFile path, e.g. "run41/vo.mp3"
  bed?: string;
  avatarSrc: string; // staticFile path, e.g. "run41/avatar.mp4"
  captions: CaptionChunk[]; // loaded from run41/captions.json
  pipeline: { id: string; tool: string; label: string }[];
  proof: { kicker: string; rows: TerminalRow[]; chips: ArtifactChip[] };
  failure: {
    fail: string[]; // real lines from qc_fail.json
    fix: string[]; // real lines + qc_pass.json result
  };
  scorecard: { worked: string[]; notYet: string[]; humanFrames: number };
}

// Per-scene avatar presence (DESIGN_SYSTEM §PiP presence map).
export const AVATAR_PRESENCE: Record<string, AvatarPresence> = {
  hook: "corner",
  problem: "corner",
  pipeline: "hidden",
  realProof: "hidden",
  failure: "hidden", // returns to "corner" in beat B (handled inside FailureScene)
  lesson: "enlarged",
  cta: "corner",
};

export const EPISODE_002: EpisodeData = {
  vo: "run41/vo.mp3",
  bed: "run41/bed_minimal.mp3",
  avatarSrc: "run41/avatar.mp4",
  captions: [], // populate from run41/captions.json at build time
  pipeline: [
    { id: "01", tool: "CLAUDE", label: "script" },
    { id: "02", tool: "ELEVENLABS", label: "voice" },
    { id: "03", tool: "HEYGEN", label: "avatar" },
    { id: "04", tool: "FFMPEG", label: "composite" },
    { id: "05", tool: "VISION QC", label: "gate" },
    { id: "06", tool: "TELEGRAM", label: "deliver" },
  ],
  proof: {
    kicker: "RUN #41 · LIVE LOG",
    rows: [
      { status: "ok", tool: "claude", artifact: "script.md", duration: "11.2s", size: "1.4 kB" },
      { status: "ok", tool: "11labs", artifact: "vo.mp3", meta: "00:58", duration: "6.0s", size: "1.1 MB" },
      { status: "ok", tool: "heygen", artifact: "avatar.mp4", meta: "chest-up", duration: "41.7s", size: "18.3 MB" },
      { status: "ok", tool: "ffmpeg", artifact: "compose.mp4", meta: "1 pass", duration: "9.4s", size: "22.6 MB" },
    ],
    chips: [
      { name: "script.md", size: "1.4 kB" },
      { name: "vo.mp3", size: "1.1 MB" },
      { name: "avatar.mp4", size: "18.3 MB" },
      { name: "ep002.mp4", size: "22.6 MB" },
    ],
  },
  failure: {
    fail: [
      "✗ avatar crop — chin clipped (face_box 0.94 > 0.90)",
      "✗ slide 2 — ink coverage 6% (< 12% min)",
      "BLOCKED before Telegram. Not after.",
    ],
    fix: [
      "→ re-frame avatar to chest-up",
      "→ rebuild slide 2 with proof layer",
      "✓ re-check passed · brand 0.91 · fake-AI risk 0.07",
    ],
  },
  scorecard: {
    worked: ["scripting", "voice", "composition", "delivery"],
    notYet: ["fully hands-off QC"],
    humanFrames: 1,
  },
};
