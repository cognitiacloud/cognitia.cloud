# Cognitia Republic — ACCEPTANCE CHECKLIST (Episode 002 rebuild)

Binary ship gates. The episode does **not** go to Telegram unless every **MUST**
passes. Several gates map directly to the existing `hermes/skills/vision-skill`
scores (`quality_score`, `brand_score`, `fake_ai_risk_score`, `face_box`,
privacy scan). This checklist governs the FINAL render — it is not yet run; this
is the standard the blueprint commits to.

**Ship rule:** all of **A (no-fake/static)**, **C (proof)**, **E (technical)**
must pass (hard gate). ≥90% of **B (brand)** and **D (caption)** must pass.
Any hard-gate failure → automatic loop back to the relevant pipeline stage, no
manual override.

---

## A. Visual quality / no-fake / no-static-slide gates  *(MUST)*
- [ ] **No sparse dark slide:** ink coverage ≥ **12%** on every scene's key frame. *(vision-skill)*
- [ ] **Layer density ≥ 3** composed elements per scene (backdrop + structural + proof).
- [ ] **No fake UI:** every number/chip/log line on screen traces to the real `run41` manifest. No invented dashboard.
- [ ] `fake_ai_risk_score ≤ 0.15` on sampled frames. *(vision-skill)*
- [ ] `quality_score` above pipeline threshold on sampled frames. *(vision-skill)*
- [ ] No flat-black background anywhere (gradient canvas required).

## B. Brand gates  *(≥90%)*
- [ ] `brand_score ≥ 0.85` on sampled frames. *(vision-skill)*
- [ ] Single accent system (`#58A6FF` + green/amber states only); zero off-palette color.
- [ ] Typography limited to the two approved families (grotesk + mono).
- [ ] Wordmark appears ONLY in S1 + S7 (no persistent logo bug).
- [ ] No emoji, no fake "LIVE" badge, no random dashboard graphics.

## C. Proof-first gates  *(MUST)*
- [ ] Hook premise stated before 00:07.
- [ ] All real stages shown: Claude, ElevenLabs, HeyGen, FFmpeg, Vision QC, Telegram + the fail/fix loop.
- [ ] S4 numbers (durations/sizes/exit codes) all sourced from `run41/manifest.json`.
- [ ] S5 shows a REAL blocked→fixed transition from `qc_fail.json`/`qc_pass.json` (not staged).
- [ ] S6 scorecard admits ≥1 thing that did NOT work (anti-hype credibility).

## D. Caption readability gate  *(≥90%)*
- [ ] Captions present on every spoken beat.
- [ ] ≤4 words/line, ≤2 lines, phrase-chunked.
- [ ] Caption text contrast ≥ 4.5:1 against local backdrop.
- [ ] Captions sit above the PiP card and inside Shorts safe zones (DESIGN_SYSTEM §7); never clipped.
- [ ] VO and captions match exactly — no orphaned, missing, or duplicated words.
- [ ] No caption chunk on screen < 9 frames.

## E. Technical / no-watermark / delivery gates  *(MUST)*
- [ ] **No watermark:** no persistent logo, no third-party export stamp, no auto-added badge in any frame.
- [ ] Exactly **1800 frames @ 30fps**, **1080×1920**, h264, file ≤ ~30 MB.
- [ ] **No full-screen avatar** in any frame; PiP ≤ 28% / 40% width; crop safe (`face_box` height ratio ≤ 0.90, no chin clip). *(vision-skill)*
- [ ] VO loudness ≈ −16 LUFS integrated; bed ≤ −24 LUFS.
- [ ] `vision_privacy_scan` clean: no emails, API keys, tokens, or local paths visible in any frame. *(vision-skill)*
- [ ] First and last frame both screenshot-worthy (thumbnail test).
- [ ] **Re-renderable:** `npx remotion render Episode002` reproduces the master from config + assets with no manual steps.

---

### Failure → loop routing (which stage to re-run on a gate miss)
| Failed gate | Loops back to |
|---|---|
| A ink-coverage / density | Remotion scene composition |
| A/C fake-UI / proof | re-capture real run artifacts (Hermes) |
| B brand / palette / type | `tokens.ts` + scene styling |
| D caption | `captions.json` alignment + `Captions` component |
| E avatar crop / full-screen | HeyGen re-frame → re-render PiP |
| E privacy | redact source artifact → re-render |
| E frame count / loudness | Remotion config / FFmpeg loudnorm |
