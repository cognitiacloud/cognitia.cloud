# Episode 002 — Real Asset Capture Spec (preview → final)

You provide the real crops; I composite them — **no MCP calls, no credits.**
Drop files into `assets/run41/shots/` using the exact **filename** below, then I
re-render the preview (the renderer auto-detects real crops and replaces the
labeled placeholder).

Display canvas is 1080×1920. "Box" = where the asset sits in the preview, in
canvas px. Always provide source crops **2–3× the box size** for crispness, and
**redact secrets before capturing** (no API keys, tokens, emails, file paths,
phone numbers in frame — the privacy gate will reject them).

| # | Asset | Filename | Source crop (ideal) | Aspect | Appears in preview | Box (px) |
|---|---|---|---|---|---|---|
| 1 | Claude/Hermes script | `claude_script.png` | ≥ 1200×1500 | 4:5 | S3 node 01 thumb + (S4 hero option) | 110×90 thumb |
| 2 | ElevenLabs voice/waveform | `elevenlabs.png` | ≥ 1500×1000 | 3:2 | S3 node 02 thumb | 110×90 |
| 3 | HeyGen avatar (chest-up) | `heygen.png` | 1080×1350 | 4:5 | S3 node 03 thumb **+ S5 QC frame** | 140×170 (QC) |
| 4 | FFmpeg terminal/compose | `ffmpeg.png` | ≥ 1600×900 | 16:9 | S3 node 04 thumb + S4 terminal | full-width panel |
| 5 | Vision-QC result | `qc.png` | ≥ 1400×900 | 3:2 | S3 node 05 thumb + S5 QC card | 940×250 card |
| 6 | Telegram delivery | `telegram.png` | ≥ 1080×1080 | 1:1–4:5 | **Result beat (S7)** — see note | 720×250 card |

### Per-asset content requirements

**1. `claude_script.png` — Claude/Hermes script**
Clean crop of your editor/terminal showing the real `script.md` (the Ep-002
script). Monospace, dark theme preferred. Show ~6–10 lines incl. a scene
heading. *No* file paths/usernames in the gutter.
→ *Status: I already generated a real `script.md` (`assets/run41/script.md`). If
you want, I can render it as the panel — but a screenshot of YOUR editor reads
more "operator."*

**2. `elevenlabs.png` — ElevenLabs**
The generation view or a waveform of `vo.mp3`. Either the ElevenLabs UI after a
generation, or a clean waveform render. Avoid showing voice-clone names or
account email.

**3. `heygen.png` — HeyGen avatar (most important)**
One clean **chest-up** frame: 8–12% headroom above the crown, cut mid-chest,
face in the upper third, eyes level. This is the exact crop that failed in v1 —
no chin clip, no full-bleed. Neutral/confident expression. This same crop feeds
both the pipeline node and the QC scan frame.

**4. `ffmpeg.png` — FFmpeg compose/log**
Terminal crop of the real compose command + output (frames, fps, time, size).
→ *Status: I captured a **real local ffmpeg log** (`assets/run41/ffmpeg.log`,
real x264 stats) + real sizes (`manifest.txt`). Usable now; swap for your
pipeline's actual compose log if you want it 1:1.*

**5. `qc.png` — Vision-QC result**
Crop of the QC report. → *Status: I ran the **real** `vision_skill.py`. The
**privacy/safety gate is genuinely real** (OCR+regex: 0 emails/keys/paths →
publish-safe; `assets/run41/privacy.json`). The **score values** (brand,
fake-AI, face_box) come back `null` here because there's **no LLM vision key**
in this environment — so those numbers are still placeholders until you run QC
with an `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` set, or send me a screenshot of a
real scored run.*

**6. `telegram.png` — Telegram delivery**
Screenshot of the delivery message: file name `ep002.mp4`, size, timestamp,
delivered ✓✓. **Blur the chat name / phone / other messages.**
→ *Note: the current 10s preview ends at the QC beat (S1–S5). Telegram lives in
the Result beat (S7). If you want it in the preview, I'll extend to ~12s with a
short delivery beat; otherwise it's needed for the 60s final.*

### Real vs placeholder — current state
| Asset | Real now? | Source |
|---|---|---|
| Claude script | ✅ real text | I authored `script.md` (free) |
| FFmpeg log + sizes | ✅ real | local ffmpeg run (`ffmpeg.log`, `manifest.txt`) |
| Vision-QC **privacy gate** | ✅ real | `vision_skill.py privacy` (OCR+regex) |
| Vision-QC **scores** (brand/fake-AI/face_box) | ❌ placeholder | needs LLM key or your screenshot |
| ElevenLabs waveform | ❌ placeholder | needs `elevenlabs.png` |
| HeyGen avatar | ❌ placeholder | needs `heygen.png` |
| Telegram delivery | ❌ placeholder | needs `telegram.png` |
| Terminal sizes (avatar 18.3MB, vo 1.1MB, etc.) | ❌ placeholder | needs real run values |

### Drop-in workflow
1. Save crops to `assets/run41/shots/` with the filenames above.
2. Tell me "crops are in" → I re-render the 10–12s preview (placeholders auto-replaced) + contact sheet.
3. We review real-vs-placeholder again; when all 6 are real → approve 60s.
