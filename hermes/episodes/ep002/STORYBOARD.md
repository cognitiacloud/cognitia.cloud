# Cognitia Republic — Episode 002 (Rebuild) · STORYBOARD

**Title:** "I tried to automate my entire AI video pipeline. Here's what actually worked."
**Format:** 60s vertical · 1080×1920 · 30fps · 1800 frames
**Voice:** anti-hype, proof-first, operator-led — "I tested this."
**Status:** BLUEPRINT — not rendered, not publish-ready.

> Companion docs: `DESIGN_SYSTEM.md` (tokens, captions, PiP, safe zones) ·
> `ACCEPTANCE_CHECKLIST.md` (ship gates) · `remotion/` (component scaffold) ·
> `HERMES_HANDOFF.md` (preview-only generation brief).

---

## Why we are rebuilding (Episode 002 v1 → v2)

v1 (Hermes auto-gen) failed on four measurable axes. Every rebuild rule traces back to one of them:

| v1 failure | Root cause | Rebuild rule |
|---|---|---|
| Sparse dark slides | One headline on black, <10% ink coverage | ≥3 layered elements + structural backdrop per scene; min ink-coverage gate |
| Bad avatar crop | Full-bleed HeyGen frame, chin/forehead cut | Avatar **never** full-screen; framed PiP card, chest-up, safe-padded |
| Weak visual density | Text-only, no proof | Real terminal logs, artifact chips, live pipeline graph on every beat |
| Fake-looking process cards | Generic invented "AI dashboard" UI | Cards render **actual run data** (durations, exit codes, file sizes) only |

North star: **premium dark tech that looks like an operator's console, not a guru's promo.**

---

## Scene map

| # | Scene → component | In→Out | Frames | Avatar (see DESIGN_SYSTEM §PiP) |
|---|---|---|---|---|
| S1 | Hook → `HookScene` | 00:00–00:07 | 0–210 | PiP corner |
| S2 | Problem → `ProblemScene` | 00:07–00:15 | 210–450 | PiP corner |
| S3 | Pipeline → `PipelineScene` | 00:15–00:24 | 450–720 | hidden (B-roll) |
| S4 | Real proof → `RealProofScene` | 00:24–00:38 | 720–1140 | hidden (B-roll) |
| S5 | Failure/fix → `FailureScene` | 00:38–00:48 | 1140–1440 | hidden → PiP return |
| S6 | Lesson → `LessonScene` | 00:48–00:55 | 1440–1650 | PiP enlarged |
| S7 | CTA → `CTAScene` | 00:55–01:00 | 1650–1800 | PiP corner |

Pacing: fast cold-open (S1–S2) → explainer spine (S3) → longest proof beat
(S4, 14s, internally chaptered) → tension+release (S5) → payoff (S6) → clean
close (S7). No scene under 5s.

---

## S1 · Hook → `HookScene` (00:00–00:07 · frames 0–210)

- **On-screen text**
  - Kicker (top): `COGNITIA REPUBLIC · EP 002`
  - Headline: `I automated my entire` / `AI video pipeline.`
  - Sub: `One prompt in. Finished video out. (In theory.)`
- **Voiceover:** "I tried to fully automate my AI video pipeline. One prompt in, finished video out. Here's what actually worked — and what broke."
- **Visual proof required:** real, dim terminal scrollback of `hermes run --episode 002` running *behind* the headline. Proves there is a real command, not a concept.
- **Motion:** terminal already scrolling on entry; headline lines mask-reveal upward (clip-path), staggered 4f; PiP card scales in 0.96→1.0 with shadow bloom.
- **Assets needed:** `assets/run41/terminal_boot.txt` (real scrollback) · HeyGen `avatar.mp4` (chest-up) · procedural backdrop+grid+kicker.

## S2 · Problem → `ProblemScene` (00:07–00:15 · frames 210–450)

- **On-screen text**
  - Kicker: `THE PITCH vs THE TRUTH`
  - Left column "The pitch": `script → voice → avatar → edit → done`
  - Right column "The reality": `7 tools. 7 ways to fail.`
  - Caption chip: `so I instrumented every stage`
- **Voiceover:** "The pitch is clean: script, voice, avatar, edit, done. The reality? Seven tools that all fail differently. So I instrumented every stage."
- **Visual proof required:** the two-column contrast itself is the proof of an honest framing; reality column references the 7 real tools by category.
- **Motion:** columns wipe in from center outward; "reality" letters get a 1px chromatic jitter for 8f (tension), then lock.
- **Assets needed:** procedural only (two-column block + jitter). No mockups.

## S3 · Pipeline → `PipelineScene` (00:15–00:24 · frames 450–720)

- **On-screen text** (nodes light in sequence)
  - Kicker: `THE ENGINE`
  - `01 CLAUDE — script` → `02 ELEVENLABS — voice` → `03 HEYGEN — avatar` → `04 FFMPEG — composite` → `05 VISION QC — gate` → `06 TELEGRAM — deliver`
  - Footer: `one command · six stages · one gate`
- **Voiceover:** "Claude writes the script. ElevenLabs voices it. HeyGen drives the avatar. FFmpeg composites. Then a QC gate decides if it ships."
- **Visual proof required:** the 6-stage graph maps 1:1 to the real Hermes pipeline (incl. `hermes/skills/vision-skill` as node 05). Mono, single-color tool logos.
- **Motion:** nodes light L→R (≈150ms apart); edges draw via `strokeDashoffset`; QC node (05) pulses amber→neutral once to foreshadow S5.
- **Assets needed:** `assets/logos/{claude,elevenlabs,heygen,ffmpeg,telegram}.svg` (recolored to brand) · procedural node graph.

## S4 · Real proof → `RealProofScene` (00:24–00:38 · frames 720–1140)

- **On-screen text** — chaptered into 4 micro-beats (~3.5s each); one terminal + 4 artifact chips.
  - Kicker: `RUN #41 · LIVE LOG`
  - Terminal (typed in):
    ```
    ✓ claude  script.md            11.2s   1.4 kB
    ✓ 11labs  vo.mp3      00:58    6.0s    1.1 MB
    ✓ heygen  avatar.mp4  chest-up 41.7s   18.3 MB
    ✓ ffmpeg  compose.mp4 1 pass   9.4s    22.6 MB
    ```
  - Artifact chips (bottom rail): `script.md` · `vo.mp3` · `avatar.mp4` · `ep002.mp4`
- **Voiceover:** "This is a real run. Script generated in eleven seconds. Voice: one take, no edits. Avatar: lip-synced, chest-up, no crop. FFmpeg burns captions and the PiP in a single pass. Every artifact logged."
- **Visual proof required:** EVERY value on screen comes from the real `run41` manifest — durations, file sizes, exit codes. This is the anti-fake-card beat; if a number can't be sourced, it doesn't appear.
- **Motion:** terminal types per-char (~22ms/char); each `✓` pops (spring 1.0→1.15→1.0); chips slide up the rail as their line completes; numbers count up over 12f.
- **Assets needed:** `assets/run41/run.log` + `assets/run41/manifest.json` (real durations/sizes/filenames). Hermes demo capture required — see HERMES_HANDOFF.

## S5 · Failure/fix → `FailureScene` (00:38–00:48 · frames 1140–1440)

- **On-screen text**
  - Kicker: `QC GATE · BLOCKED`
  - Beat A (fail, amber): `✗ avatar crop — chin clipped (face_box 0.94 > 0.90)` / `✗ slide 2 — ink coverage 6% (< 12% min)` / `BLOCKED before Telegram. Not after.`
  - Beat B (fix→pass, green): `→ re-frame avatar to chest-up` / `→ rebuild slide 2 with proof layer` / `✓ re-check passed · brand 0.91 · fake-AI risk 0.07`
- **Voiceover:** "First pass failed QC — the avatar crop cut off the chin, and two slides rendered nearly empty. The gate caught it before Telegram, not after. Re-render, re-check, pass."
- **Visual proof required:** a REAL blocked→fixed transition using actual `vision-skill` output fields (`face_box`, `ink_coverage`, `brand_score`, `fake_ai_risk_score`). Must not be staged.
- **Motion:** Beat A — border flashes amber, failed lines shake 2px ×3, `BLOCKED` stamps 1.2→1.0. Beat B — amber lines crossfade to green checks; progress bar sweeps 0→100% during re-render; avatar PiP returns for sign-off.
- **Assets needed:** `assets/run41/qc_fail.json` + `assets/run41/qc_pass.json` (real vision-skill JSON). Hermes demo capture required.

## S6 · Lesson → `LessonScene` (00:48–00:55 · frames 1440–1650)

- **On-screen text**
  - Kicker: `THE HONEST SCORECARD`
  - Worked (green): `scripting · voice · composition · delivery`
  - Didn't, yet (amber): `fully hands-off QC`
  - Number: `1 frame` `still reviewed by a human`
- **Voiceover:** "What worked: scripting, voice, composition, delivery. What didn't, yet: fully hands-off QC. I still review one frame."
- **Visual proof required:** the scorecard must admit at least one thing that did NOT work (anti-hype credibility). Numbers from run summary.
- **Motion:** rows stagger in; green rows check-draw; amber row single slow pulse; "1 frame" counts 0→1 and holds. Avatar PiP enlarged (to-camera).
- **Assets needed:** run summary (cost, durations) · HeyGen `avatar.mp4` · procedural scorecard.

## S7 · CTA → `CTAScene` (00:55–01:00 · frames 1650–1800)

- **On-screen text**
  - Headline: `Automated, not unattended.`
  - Sub: `That's the honest version.`
  - CTA: `Follow for run #42 →`
  - Lockup: `COGNITIA REPUBLIC`
- **Voiceover:** "Automated, not unattended. That's the honest version. Follow for the next run."
- **Visual proof required:** clean brand lockup; no fake subscribe-count, no fake metrics.
- **Motion:** everything fades to lockup; wordmark tracking-in (letter-spacing 0.3em→0.08em); CTA arrow nudges right ×2 on loop.
- **Assets needed:** wordmark lockup (procedural) · HeyGen `avatar.mp4` (corner PiP).

---

## Asset summary (what must exist before any render)

**Real artifacts (captured from one actual `hermes run`, "run41"):**
- `assets/run41/terminal_boot.txt` — boot scrollback (S1)
- `assets/run41/run.log` + `manifest.json` — durations, file sizes, exit codes (S4)
- `assets/run41/qc_fail.json` + `qc_pass.json` — real vision-skill output (S5)
- `assets/run41/vo.mp3` — ElevenLabs master VO (whole clip)
- `assets/run41/captions.json` — word-timed transcript (whole clip)
- `assets/run41/avatar.mp4` — HeyGen avatar, chest-up, QC-safe crop (S1,S6,S7)

**Procedural (Remotion-generated, no static PNG mockups):** backdrop grid,
kickers, two-column block, pipeline graph, terminal, artifact chips, status
stamps, progress sweep, scorecard, wordmark lockup.

**Brand assets:** `assets/logos/{claude,elevenlabs,heygen,ffmpeg,telegram}.svg`
(mono, recolored to brand) · optional `assets/bed_minimal.mp3` (−24 LUFS bed).

> **Sourcing rule:** if an artifact can't be produced by a real run, it does not
> go on screen. The vision QC gate's `fake_ai_risk_score` is the referee.
