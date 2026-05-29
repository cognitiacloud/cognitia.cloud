# Episode 002 — FINAL HANDOFF

**Status: BLOCKED — waiting on real, user-provided proof crops.** Nothing else
blocks progress. No further work will happen until those files are uploaded.

> ⛔ **No 60s render until the Chief explicitly approves.** No HeyGen/ElevenLabs
> calls, no MCP generation, no credit spend, no fabricated assets.

---

## 1. Current status
- Visual system + motion language: **approved as base** (V5/V6 — cyan/navy/violet, glass, glows, particles, light sweeps, line-trace, terminal typing, QC scan beam).
- Rough 10s preview with **clearly-labeled placeholders**: delivered + committed to PR #1.
- Real-crop pipeline: **fully primed** (slot-loader, `assets/run41/shots/`, privacy gate, 10–12s preview renderer).
- Blocker: this is a cloud container with **no access to the local PC/WSL**, and Drive/Slack searches found nothing. Real crops must be uploaded by a human.

## 2. Real vs placeholder
| Asset | State | Source |
|---|---|---|
| Claude script | ✅ real | `assets/run41/script.md` (authored locally) |
| FFmpeg log + file sizes | ✅ real | `assets/run41/ffmpeg.log`, `manifest.txt` (real ffmpeg run) |
| Vision-QC **privacy/safety gate** | ✅ real | `assets/run41/privacy.json` (real `vision_skill.py`, OCR+regex) |
| Vision-QC **scores** (brand / fake-AI / face_box) | ❌ placeholder | needs an LLM vision key or a real scored-run screenshot |
| ElevenLabs voice/waveform | ❌ placeholder | needs `elevenlabs.png` |
| HeyGen avatar | ❌ placeholder | needs `heygen.png` |
| Telegram delivery | ❌ placeholder | needs `telegram.png` |
| Terminal sizes (avatar 18.3MB, vo 1.1MB, etc.) | ❌ placeholder | needs real run values |

## 3. Exact files I need uploaded
Drop these into the chat (or a ZIP from the collector). Map to slot → filename:

| Filename | Slot | Ideal crop | Aspect |
|---|---|---|---|
| `heygen.png` | HeyGen avatar (priority) | chest-up, 8–12% headroom, no chin clip | 4:5 |
| `elevenlabs.png` | ElevenLabs voice/waveform | gen view or waveform | 3:2 |
| `telegram.png` | Telegram delivery message | shows `ep002.mp4`, size, ✓✓ | 1:1–4:5 |
| `qc.png` | QC result / scores | brand / fake-AI / face_box visible | 3:2 |
| `claude_script.png` *(optional)* | Script editor/terminal | ~6–10 lines of `script.md` | 4:5 |
| `ffmpeg.png` *(optional)* | Compose/log terminal | real compose output | 16:9 |

**Privacy:** before capturing, ensure NO API keys, emails, tokens, phone numbers, or local file paths are visible — the privacy gate will reject them.

## 4. Exact command — Windows (PowerShell)
```powershell
# from the folder containing the script (hermes/episodes/ep002/tools/)
powershell -ExecutionPolicy Bypass -File .\collect_crops.ps1
# output: %USERPROFILE%\Desktop\cognitia_real_crops_candidates\cognitia_real_crops_candidates.zip
```

## 5. Exact command — WSL / Linux (bash)
```bash
# from hermes/episodes/ep002/tools/
bash collect_crops.sh
# output: /mnt/c/Users/smrai/Desktop/cognitia_real_crops_candidates/cognitia_real_crops_candidates.zip
```
Both are read-only (copy, never move/delete), make no network/AI/MCP calls, and
render nothing. They produce `candidates/`, `manifest.csv`, `README_NEXT_STEPS.txt`, and the ZIP.

## 6. What I will do after you upload the ZIP (or the crops)
1. Unzip and read `manifest.csv`.
2. Build a **candidate contact sheet** (thumbnail · filename · path · modified · resolution · likely slot) and ask you to approve which file maps to each slot.
3. On approval: copy approved files into `assets/run41/shots/` with the exact names.
4. Run the real `vision_privacy_scan` on each crop — reject anything exposing secrets.
5. **Re-render only the 10–12s preview + contact sheet** (placeholders auto-replaced; `telegram.png` unlocks the +2s S7 delivery beat).
6. Deliver the all-real preview + updated real-vs-placeholder table for final sign-off.

## 7. Warning
**No 60s final render happens until the Chief explicitly approves the all-real
10–12s preview.** Until real crops are uploaded, the project stays BLOCKED and
no further work will be done.

---

### Reference
- Collectors: `hermes/episodes/ep002/tools/collect_crops.ps1`, `collect_crops.sh`
- Capture spec: `hermes/episodes/ep002/ASSET_REQUEST.md`
- Storyboard / design / checklist: `STORYBOARD.md`, `DESIGN_SYSTEM.md`, `ACCEPTANCE_CHECKLIST.md`
- Renderer + slot-loader: `hermes/episodes/ep002/style_frames/animate.py`
- PR #1: branch `claude/cognitia-episode-002-rebuild-5ffai`
