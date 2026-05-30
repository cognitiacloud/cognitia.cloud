# Episode 002 — REAL CROPS NEEDED (60s blocker checklist)

Visual standard is **locked (V7)**. The 12s preview is approved as the motion
system. The **60s final is BLOCKED** until the real proof assets below replace
the labeled placeholders. No fabricated proof, no HeyGen/ElevenLabs calls, no
credit spend.

Drop files into `assets/run41/shots/` with the exact filenames (or upload to
chat and I'll place them). **Redact secrets first** — no API keys, emails,
tokens, phone numbers, or local file paths in frame (the privacy gate rejects them).

## Still needed (the blockers)
- [ ] **HeyGen avatar** → `heygen.png`
  - Clean **chest-up** frame: 8–12% headroom above the crown, cut mid-chest, face upper third, no chin clip.
  - Crop **4:5** (ideal source ≥ 1080×1350). Used in the pipeline node **and** the QC scan frame.
- [ ] **ElevenLabs voice/waveform** → `elevenlabs.png`
  - Generation view or a clean waveform of `vo.mp3`. Hide voice-clone names / account email.
  - Crop **3:2** (ideal source ≥ 1500×1000).
- [ ] **Telegram delivery** → `telegram.png`
  - Delivery message showing `ep002.mp4`, file size, timestamp, delivered ✓✓. Blur chat name / phone / other messages.
  - Crop **1:1–4:5** (ideal source ≥ 1080×1080).
- [ ] **True QC score values** → `qc.png` *(or set an LLM vision key)*
  - Real `vision_skill.py` scores: `brand_score`, `fake_ai_risk_score`, `face_box`.
  - These are `null` in this environment (no LLM vision key). To make them real either:
    (a) run QC with `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` set, or (b) upload a screenshot of a scored run.
  - Crop **3:2** (ideal source ≥ 1400×900).

## Optional (already real locally — upload only if you want your own UI)
- [ ] `claude_script.png` — script editor/terminal (4:5). *Real `script.md` already generated.*
- [ ] `ffmpeg.png` — compose/log terminal (16:9). *Real `ffmpeg.log` + true sizes already captured.*

## Already REAL (no action needed)
- ✅ Claude/Hermes script — `assets/run41/script.md`
- ✅ FFmpeg compose log + true file sizes — `assets/run41/ffmpeg.log`, `manifest.txt`
- ✅ Vision-QC **privacy/safety gate** — `assets/run41/privacy.json` (real OCR+regex, publish-safe)

## How to deliver
1. Run `tools/collect_crops.ps1` (Windows) or `tools/collect_crops.sh` (WSL) → upload the resulting ZIP, **or** drag the crops straight into chat.
2. I place them in `assets/run41/shots/`, run the real `vision_privacy_scan` on each, re-render the all-real 12s V7 preview, and deliver for sign-off.

## Gate
**No 60s final render until every box above is checked (real) and the Chief
approves the all-real preview.** Rendering 60s with placeholders is not allowed.
