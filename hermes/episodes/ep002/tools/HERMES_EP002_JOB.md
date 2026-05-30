# Episode 002 — HERMES JOB (local execution layer)

This lets **Hermes** (your local agent: ChatGPT/local skills/vector/repo access)
do the remaining work — find the real assets, reason about which file fills each
slot, QC them, compose into the locked V7 system, render the all-real preview,
and stop for approval — **without you sorting files by hand.**

If a Hermes CLI is present, the wrapper hands the job to it. If not, it falls
back to the deterministic runner that does the same steps mechanically.

> Cloud status: a Hermes/local execution bridge is **NOT reachable from the
> cloud container** (no shell/filesystem/agent MCP). This package is the handoff
> so Hermes can run on your machine. **State C.**

---

## Files
| File | Purpose |
|---|---|
| `hermes_ep002_job.json` | Declarative job Hermes consumes: slots, search locations, vector hints, QC gates, steps, guards, result states |
| `run_hermes_ep002.sh` | WSL wrapper → runs Hermes if found, else deterministic runner |
| `run_hermes_ep002.ps1` | Windows wrapper → same |
| `run_local_ep002.{sh,ps1}` | deterministic engine (resolve → derive → QC → render → approval → final → Telegram) |
| `_eleven_tts.py` | guarded ElevenLabs TTS helper (only if `ALLOW_CREDIT_CALLS=true`) |
| `.env.example` | optional paths / keys / guards / `HERMES_BIN` / vector index |
| `final_ep002.py` (in `style_frames/`) | full 60s V7 timeline used on approval |

## What Hermes does (from `hermes_ep002_job.json`)
1. **Resolve assets** — for `avatar`, `voice`, `telegram`, `qc`: use an explicit
   env path if set, else reason over the search locations + repo docs + your
   vector index to pick the best candidate, and copy it into the slot.
2. **Derive shots** — chest-up 4:5 `heygen.png` from the avatar video; waveform
   `elevenlabs.png` from the voice.
3. **Privacy/QC** — `vision_skill.py privacy` on every crop; abort if any
   email/key/token/path is visible. Enforce Shorts safe zones, no clipped face,
   readable captions, no watermark, no fake metrics.
4. **Render preview** — all-real V7 10–12s → `out/preview_real.mp4`. Missing
   assets stay clearly labeled PLACEHOLDER (never fabricated).
5. **STOP for approval.**
6. **On approval** (`APPROVE=true`) — render the 60s `final_ep002.py` →
   `out/ep002_final.mp4`, then optional Telegram delivery.

## Guards (same as the runner)
- Never fabricates proof.
- No HeyGen/ElevenLabs credit unless `ALLOW_CREDIT_CALLS=true` (+ keys). HeyGen is never auto-generated.
- Telegram only sends if `SEND_TELEGRAM=true` + `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`, and only after `APPROVE`.
- Existing-media retrieval is read-only and free.

---

## Exact commands you run

### WSL / Linux
```bash
cd <repo>
cp hermes/episodes/ep002/tools/.env.example hermes/episodes/ep002/tools/.env   # optional: set HERMES_BIN, paths, keys
bash hermes/episodes/ep002/tools/run_hermes_ep002.sh           # → all-real preview, then STOPS
APPROVE=true bash hermes/episodes/ep002/tools/run_hermes_ep002.sh   # → 60s final (+ optional Telegram)
```

### Windows (PowerShell)
```powershell
cd <repo>
Copy-Item hermes\episodes\ep002\tools\.env.example hermes\episodes\ep002\tools\.env   # optional
powershell -ExecutionPolicy Bypass -File .\hermes\episodes\ep002\tools\run_hermes_ep002.ps1
powershell -ExecutionPolicy Bypass -File .\hermes\episodes\ep002\tools\run_hermes_ep002.ps1 -Approve
```

To point Hermes at your CLI explicitly, set `HERMES_BIN` in `.env` (or PATH). To
let Hermes use your vector index for asset inference, set `COGNITIA_VECTOR_INDEX`.

## The three result states the run reports
- **A** — all-real (or mostly-real) 10–12s preview rendered; awaiting approval for 60s.
- **B** — candidates found but one human decision needed (ambiguous slot, or the required avatar video is missing everywhere reachable).
- **C** — no Hermes/local bridge; deterministic runner used. *(This is what the cloud session is right now; running the wrapper on your PC moves you to A or B.)*
