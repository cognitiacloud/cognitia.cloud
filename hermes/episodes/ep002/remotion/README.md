# Episode 002 — Remotion scaffold

**Status: BLUEPRINT / structure only.** This is the clean component scaffold for
the Episode 002 rebuild. It is **not** a final render and is **not**
publish-ready. Animation bodies, real-artifact wiring, and the karaoke
word-split are intentionally stubbed with `TODO build:` markers.

## Layout
```
src/
├─ index.ts            registerRoot
├─ Root.tsx            <Composition id="Episode002"> 1080×1920 · 30fps · 1800f
├─ Episode002.tsx      master timeline: Backdrop + <Series> 7 scenes + Captions + AvatarPiP + Audio
├─ tokens.ts           design tokens (mirror of ../../DESIGN_SYSTEM.md)
├─ anim.ts             shared easing/count-up helpers
├─ data/episode-002.ts content spec (placeholder shapes of run41 artifacts)
├─ components/         Backdrop, Kicker, Captions, AvatarPiP, Terminal,
│                      ProcessCard, PipelineMap, StatusStamp, Scorecard
├─ scenes/             HookScene, ProblemScene, PipelineScene, RealProofScene,
│                      FailureScene, LessonScene, CTAScene
└─ assets/             real-run artifacts (see assets/README.md)
```

## Scene → component map
| Storyboard | Component | Frames |
|---|---|---|
| S1 Hook | `HookScene` | 0–210 |
| S2 Problem | `ProblemScene` | 210–450 |
| S3 Pipeline | `PipelineScene` | 450–720 |
| S4 Real proof | `RealProofScene` | 720–1140 |
| S5 Failure/fix | `FailureScene` | 1140–1440 |
| S6 Lesson | `LessonScene` | 1440–1650 |
| S7 CTA | `CTAScene` | 1650–1800 |

## Preview (no final render)
```bash
npm install
npm run dev      # Remotion Studio — inspect scenes/timeline
npm run lint     # tsc --noEmit
```
Final `remotion render` is deliberately gated: see `../HERMES_HANDOFF.md`. Do
not auto-publish. Human approval of the Hermes preview comes first.
