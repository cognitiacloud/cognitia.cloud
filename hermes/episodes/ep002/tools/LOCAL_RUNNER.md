# Episode 002 — LOCAL RUNNER (the automation bridge)

The cloud container **cannot** reach your PC, HeyGen/ElevenLabs media, or
Telegram — so the real pipeline runs **locally**. This runner orchestrates it on
your machine using the V7 renderer already committed in this repo.

It never fabricates proof, and never spends HeyGen/ElevenLabs credits unless you
explicitly set `ALLOW_CREDIT_CALLS=true`.

---

## What it does (in order)
1. **Avatar/facial video** — uses `AVATAR_VIDEO`, else auto-searches your folders
   for `*avatar*/*heygen*/*talking*/*.mp4`. Copies to `assets/run41/avatar.mp4`
   and extracts a chest-up, top-anchored **4:5** `shots/heygen.png`.
2. **Voice/audio** — uses `VOICE_AUDIO`, else auto-searches `*vo*/*eleven*/*.mp3`.
   Converts to `assets/run41/vo.mp3` and renders a `shots/elevenlabs.png`
   waveform. *(Optional: if `ALLOW_CREDIT_CALLS=true` + ElevenLabs keys, generates
   VO from `script.md` — spends credits.)*
3. **Telegram proof** — uses `TELEGRAM_SHOT`, else searches `*telegram*/*delivery*`
   → `shots/telegram.png`. *(Optional real send after approval — see step 8.)*
4. **Places** everything into `assets/run41/` + `assets/run41/shots/`.
5. **Privacy/QC** — runs the repo's `vision_skill.py privacy` on every crop;
   **aborts** if any email/API key/token/path is visible. No fake proof.
6. **Renders the all-real V7 preview** (12s) → `out/preview_real.mp4`
   (muxes `vo.mp3` if present). Missing assets stay labeled PLACEHOLDER.
7. **STOPS for your approval.**
8. **Only after approval** (`APPROVE=true` / `-Approve`): renders the final and,
   if `SEND_TELEGRAM=true` (+ token + chat id), delivers it to Telegram.

---

## One-time setup
- Install **Python 3** (3.9+). The runner makes its own venv and installs
  `pillow numpy imageio-ffmpeg` (ffmpeg is bundled — no separate install).
- *(Optional, better privacy OCR)* install Tesseract:
  Windows → `winget install tesseract-ocr` · WSL → `sudo apt-get install -y tesseract-ocr`.
- Clone/pull this branch locally so the runner + renderer are present:
  `git clone <repo> && git checkout claude/cognitia-episode-002-rebuild-5ffai`
- Copy env template: `cp hermes/episodes/ep002/tools/.env.example hermes/episodes/ep002/tools/.env`
  and fill in any paths/keys you want (all optional).

---

## Exact commands you run

### WSL / Linux
```bash
cd <repo>
# (optional) edit hermes/episodes/ep002/tools/.env
bash hermes/episodes/ep002/tools/run_local_ep002.sh
#   -> renders out/preview_real.mp4 and STOPS for review
# after you approve the preview:
APPROVE=true bash hermes/episodes/ep002/tools/run_local_ep002.sh
```
One-liners to point at specific files instead of auto-search:
```bash
AVATAR_VIDEO=~/Desktop/ep002_avatar.mp4 VOICE_AUDIO=~/Desktop/vo.mp3 \
TELEGRAM_SHOT=~/Desktop/telegram.png \
bash hermes/episodes/ep002/tools/run_local_ep002.sh
```

### Windows (PowerShell)
```powershell
cd <repo>
# (optional) edit hermes\episodes\ep002\tools\.env
powershell -ExecutionPolicy Bypass -File .\hermes\episodes\ep002\tools\run_local_ep002.ps1
#   -> renders out\preview_real.mp4 and STOPS for review
# after you approve:
powershell -ExecutionPolicy Bypass -File .\hermes\episodes\ep002\tools\run_local_ep002.ps1 -Approve
```
Point at specific files:
```powershell
.\...\run_local_ep002.ps1 -AvatarVideo C:\Users\smrai\Desktop\ep002_avatar.mp4 `
  -VoiceAudio C:\Users\smrai\Desktop\vo.mp3 -TelegramShot C:\Users\smrai\Desktop\telegram.png
```

---

## Asset folder structure (created/used locally)
```
hermes/episodes/ep002/
├─ assets/run41/
│  ├─ avatar.mp4          (your real HeyGen/facial video)        [input]
│  ├─ vo.mp3              (your ElevenLabs voice)         [input or generated]
│  ├─ script.md           (already real, committed)
│  └─ shots/
│     ├─ heygen.png       (auto-extracted chest-up 4:5 from avatar.mp4)
│     ├─ elevenlabs.png   (auto waveform from vo.mp3)
│     ├─ telegram.png     (your delivery screenshot)             [input]
│     └─ qc.png           (optional real QC scores screenshot)   [input]
├─ style_frames/          (committed V7 renderer: animate.py, render.py, make_hero.py)
└─ out/
   ├─ preview_real.mp4     (12s all-real V7 preview)
   ├─ preview_contact.png
   └─ ep002_final.mp4      (after approval)
```

---

## Credit / safety guards
| Action | Gate | Default |
|---|---|---|
| Render preview/final (local PIL+ffmpeg) | always allowed | ✅ free |
| Use existing avatar/voice/telegram files | always allowed | ✅ free |
| **Generate VO via ElevenLabs** | `ALLOW_CREDIT_CALLS=true` + keys | ❌ off |
| **Send to Telegram** | `SEND_TELEGRAM=true` + token + chat, *after* `APPROVE` | ❌ off |
| HeyGen generation | **never auto** — supply `AVATAR_VIDEO` | ❌ off |
| Render with a placeholder presented as real | **never** (privacy/QC + PLACEHOLDER tags) | ❌ off |

---

## Cloud vs local — the split
- **Cloud container stays BLOCKED** for the real/final video: it has no PC,
  HeyGen/ElevenLabs media, Telegram, or credit permission, and won't fabricate
  proof. It owns the **locked V7 visual system + renderer** (committed).
- **This local runner closes the automation gap**: it feeds your real local
  assets into that same committed renderer, QCs them, makes the all-real
  preview, and — on your approval — the final + delivery. No manual
  drag-into-chat loop required once your files are on disk.

## 60s final — IMPLEMENTED
The full 60s timeline now exists: `style_frames/final_ep002.py` (1800 frames @
30fps, all 7 scenes: Hook → Problem → Pipeline → Real proof → QC → Lesson →
CTA), reusing the locked V7 system and the same `shots/` slot-loader (real crops
auto-replace placeholders). On the approval path (`APPROVE=true` / `-Approve`)
the runner detects `final_ep002.py`, renders `final.mp4`, muxes your `vo.mp3`,
and writes `out/ep002_final.mp4`. The 60s is rendered **on your PC**, never in
the cloud. Tune quality with `COG_FINAL_SCALE` (1 fast / 2 crisp).
