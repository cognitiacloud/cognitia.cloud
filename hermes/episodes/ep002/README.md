# Cognitia Republic — Episode 002 (Rebuild)

> "I tried to automate my entire AI video pipeline. Here's what actually worked."
> 60s vertical · 1080×1920 · 30fps · anti-hype, proof-first.

**Status: BLUEPRINT.** This is the visual production blueprint + clean scaffold.
It is **not** rendered, **not** publish-ready. No final render until human
approval of the Hermes preview.

## Contents
| File | What it is |
|---|---|
| `STORYBOARD.md` | 7 scenes — timestamps, on-screen text, VO line, required proof, motion, assets |
| `DESIGN_SYSTEM.md` | colors · fonts · spacing · captions · PiP · logo · Shorts safe zones |
| `ACCEPTANCE_CHECKLIST.md` | ship gates: visual quality · brand · proof-first · captions · no-watermark · no-fake-slide |
| `HERMES_HANDOFF.md` | preview-only brief: 3 style frames + contact sheet + 8–12s preview, then STOP |
| `remotion/` | component scaffold (HookScene…CTAScene + shared tokens/components) |

## Why a rebuild
v1 looked low quality: sparse dark slides, bad avatar crop, weak visual density,
fake-looking process cards. Every rule in these docs maps to one of those four
failures (see `STORYBOARD.md` → "Why we are rebuilding").

## Pipeline shown (all real)
Claude scripting → ElevenLabs voice → HeyGen avatar → FFmpeg composition →
Vision QC gate (`hermes/skills/vision-skill`) → Telegram delivery, plus the
failure/fix loop.
