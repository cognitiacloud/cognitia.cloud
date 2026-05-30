#!/usr/bin/env bash
# =====================================================================
# Cognitia Republic — Episode 002 LOCAL RUNNER (WSL / Linux)
# Real pipeline orchestrator. Runs on YOUR machine (local file access).
#
# Stages: gather real assets -> derive crops -> privacy/QC -> render all-real
#         V7 preview -> STOP for approval -> (after approval) render final
#         -> optional Telegram delivery.
#
# Safety: never fabricates proof. Never spends HeyGen/ElevenLabs credits
# unless ALLOW_CREDIT_CALLS=true. Telegram only sends if SEND_TELEGRAM=true.
# Run from the repo:  bash hermes/episodes/ep002/tools/run_local_ep002.sh
# =====================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EP_DIR="$(dirname "$SCRIPT_DIR")"                       # hermes/episodes/ep002
REPO_ROOT="$(cd "$EP_DIR" && git rev-parse --show-toplevel 2>/dev/null || (cd "$EP_DIR/../../.." && pwd))"
SF="$EP_DIR/style_frames"
RUN="$EP_DIR/assets/run41"
SHOTS="$RUN/shots"
OUTDIR="$EP_DIR/out"
VISION="$REPO_ROOT/hermes/skills/vision-skill/vision_skill.py"
mkdir -p "$SHOTS" "$OUTDIR"

# ---- load .env if present -------------------------------------------
[ -f "$SCRIPT_DIR/.env" ] && set -a && . "$SCRIPT_DIR/.env" && set +a

# ---- config (env-overridable) ---------------------------------------
: "${ALLOW_CREDIT_CALLS:=false}"
: "${SEND_TELEGRAM:=false}"
: "${APPROVE:=false}"
: "${COG_FINAL_SCALE:=2}"
: "${ELEVENLABS_VOICE_ID:=}"
SEARCH_DIRS_DEFAULT="$HOME/Downloads $HOME/Desktop $HOME/Pictures /mnt/c/Users/$USER/Downloads /mnt/c/Users/$USER/Desktop /mnt/c/Users/$USER/Pictures /mnt/c/Users/$USER/Pictures/Screenshots $HOME/cognitia-run"
: "${SEARCH_DIRS:=$SEARCH_DIRS_DEFAULT}"

log(){ printf '\033[36m[runner]\033[0m %s\n' "$*"; }
warn(){ printf '\033[33m[warn]\033[0m %s\n' "$*"; }
die(){ printf '\033[31m[abort]\033[0m %s\n' "$*"; exit 1; }

find_first(){ # find_first <regex>
  local rx="$1" d
  for d in $SEARCH_DIRS; do
    [ -d "$d" ] || continue
    find "$d" -type f -iregex ".*\($rx\).*" -printf '%T@ %p\n' 2>/dev/null
  done | sort -rn | head -1 | cut -d' ' -f2-
}

# ---- 0. python env + ffmpeg -----------------------------------------
log "setting up python env…"
PY="$EP_DIR/.venv/bin/python"
if [ ! -x "$PY" ]; then python3 -m venv "$EP_DIR/.venv" >/dev/null 2>&1 || die "python3 venv failed"; fi
"$PY" -m pip install -q --upgrade pip >/dev/null 2>&1
"$PY" -m pip install -q pillow numpy imageio-ffmpeg >/dev/null 2>&1 || die "pip install failed"
FFMPEG="$("$PY" -c 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())')"
log "ffmpeg: $FFMPEG"
command -v tesseract >/dev/null 2>&1 || warn "tesseract not installed — privacy OCR limited (sudo apt-get install -y tesseract-ocr)"

# ---- 1. avatar / facial video ---------------------------------------
AV="${AVATAR_VIDEO:-}"
[ -z "$AV" ] && AV="$(find_first 'avatar\|heygen\|talking\|facial\|\.mp4\|\.mov')"
if [ -n "$AV" ] && [ -f "$AV" ]; then
  cp -f "$AV" "$RUN/avatar.mp4"; log "avatar video: $AV"
  if [ ! -f "$SHOTS/heygen.png" ]; then
    log "deriving chest-up heygen.png from avatar.mp4 (top-anchored 4:5)…"
    "$FFMPEG" -y -ss 1 -i "$RUN/avatar.mp4" -frames:v 1 \
      -vf "crop='min(iw,ih*4/5)':'min(ih,iw*5/4)':(iw-ow)/2:0,scale=864:1080" \
      "$SHOTS/heygen.png" >/dev/null 2>&1 || warn "heygen frame extract failed"
  fi
else
  warn "no avatar/facial video found — heygen stays PLACEHOLDER (set AVATAR_VIDEO=/path)"
fi

# ---- 2. voice / audio -----------------------------------------------
VO="${VOICE_AUDIO:-}"
[ -z "$VO" ] && VO="$(find_first 'vo\|eleven\|voice\|narration\|\.mp3\|\.wav\|\.m4a')"
if [ -n "$VO" ] && [ -f "$VO" ]; then
  "$FFMPEG" -y -i "$VO" "$RUN/vo.mp3" >/dev/null 2>&1 && log "voice: $VO"
elif [ "$ALLOW_CREDIT_CALLS" = "true" ] && [ -n "${ELEVENLABS_API_KEY:-}" ] && [ -n "$ELEVENLABS_VOICE_ID" ]; then
  log "ALLOW_CREDIT_CALLS=true — generating VO via ElevenLabs (script.md)…"
  "$PY" - "$RUN/script.md" "$RUN/vo.mp3" "$ELEVENLABS_VOICE_ID" "$ELEVENLABS_API_KEY" <<'PYEOF'
import sys,re,json,urllib.request
md,out,vid,key=sys.argv[1:5]
t=open(md,encoding='utf-8').read()
t=re.sub(r'(?m)^\s*(#|>|\*\*\[).*$','',t); t=' '.join(t.split())[:2400]
req=urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{vid}",
  data=json.dumps({"text":t,"model_id":"eleven_multilingual_v2"}).encode(),
  headers={"xi-api-key":key,"Content-Type":"application/json","Accept":"audio/mpeg"})
open(out,'wb').write(urllib.request.urlopen(req,timeout=120).read())
print("vo.mp3 written")
PYEOF
  [ -f "$RUN/vo.mp3" ] && log "ElevenLabs VO generated" || warn "ElevenLabs call failed"
else
  warn "no voice audio found — elevenlabs stays PLACEHOLDER (set VOICE_AUDIO=/path, or ALLOW_CREDIT_CALLS=true + keys)"
fi
# waveform crop from real audio
if [ -f "$RUN/vo.mp3" ] && [ ! -f "$SHOTS/elevenlabs.png" ]; then
  "$FFMPEG" -y -i "$RUN/vo.mp3" -filter_complex "showwavespic=s=1200x400:colors=0x00E5FF|0x58A6FF" \
    -frames:v 1 "$SHOTS/elevenlabs.png" >/dev/null 2>&1 && log "elevenlabs.png waveform derived"
fi

# ---- 3. telegram delivery screenshot --------------------------------
TG="${TELEGRAM_SHOT:-}"
[ -z "$TG" ] && TG="$(find_first 'telegram\|delivery\|delivered')"
if [ -n "$TG" ] && [ -f "$TG" ]; then
  cp -f "$TG" "$SHOTS/telegram.png"; log "telegram shot: $TG"
else
  warn "no telegram delivery screenshot — telegram stays PLACEHOLDER (provided after real send, or set TELEGRAM_SHOT=/path)"
fi
# optional QC scores screenshot
[ -n "${QC_SHOT:-}" ] && [ -f "$QC_SHOT" ] && cp -f "$QC_SHOT" "$SHOTS/qc.png" && log "qc shot: $QC_SHOT"

# ---- 5. privacy / QC gate -------------------------------------------
log "privacy scan on supplied crops…"
for f in heygen elevenlabs telegram qc; do
  img="$SHOTS/$f.png"; [ -f "$img" ] || continue
  safe="$("$PY" "$VISION" privacy --image "$img" 2>/dev/null | "$PY" -c 'import sys,json;print(json.load(sys.stdin).get("publish_safe"))' 2>/dev/null)"
  if [ "$safe" = "False" ]; then die "PRIVACY FAIL on $f.png — secrets visible. Redact and re-run."; fi
  log "  $f.png privacy: ${safe:-n/a}"
done

# ---- 6. render all-real V7 preview ----------------------------------
log "rendering all-real V7 preview (12s)…"
( cd "$SF" && COG_S=1 "$PY" animate.py ) || die "preview render failed"
if [ -f "$RUN/vo.mp3" ]; then
  "$FFMPEG" -y -i "$SF/preview.mp4" -i "$RUN/vo.mp3" -map 0:v -map 1:a -c:v copy -c:a aac -shortest \
    "$OUTDIR/preview_real.mp4" >/dev/null 2>&1 || cp -f "$SF/preview.mp4" "$OUTDIR/preview_real.mp4"
else
  cp -f "$SF/preview.mp4" "$OUTDIR/preview_real.mp4"
fi
cp -f "$SF/preview_contact.png" "$OUTDIR/preview_contact.png" 2>/dev/null || true
log "preview -> $OUTDIR/preview_real.mp4"

# ---- 7. STOP for approval -------------------------------------------
if [ "$APPROVE" != "true" ]; then
  echo
  log "REVIEW: $OUTDIR/preview_real.mp4 (+ preview_contact.png)"
  log "Real assets used:"; for f in heygen elevenlabs telegram qc; do [ -f "$SHOTS/$f.png" ] && echo "   ✓ $f.png" || echo "   · $f.png  (PLACEHOLDER)"; done
  [ -f "$RUN/vo.mp3" ] && echo "   ✓ vo.mp3 (audio)" || echo "   · vo.mp3  (silent)"
  echo
  log "If approved, render final:   APPROVE=true bash $0"
  exit 0
fi

# ---- 8. FINAL render (only after approval) --------------------------
log "APPROVE=true — rendering final at scale=$COG_FINAL_SCALE…"
if [ -f "$SF/final_ep002.py" ]; then
  ( cd "$SF" && COG_S="$COG_FINAL_SCALE" "$PY" final_ep002.py ) || die "final render failed"
  FINAL_SRC="$SF/final.mp4"
else
  warn "no extended 60s timeline (final_ep002.py) yet — rendering current V7 cut at high quality as the ship candidate."
  ( cd "$SF" && COG_S="$COG_FINAL_SCALE" "$PY" animate.py ) || die "final render failed"
  FINAL_SRC="$SF/preview.mp4"
fi
if [ -f "$RUN/vo.mp3" ]; then
  "$FFMPEG" -y -i "$FINAL_SRC" -i "$RUN/vo.mp3" -map 0:v -map 1:a -c:v copy -c:a aac -shortest \
    "$OUTDIR/ep002_final.mp4" >/dev/null 2>&1 || cp -f "$FINAL_SRC" "$OUTDIR/ep002_final.mp4"
else
  cp -f "$FINAL_SRC" "$OUTDIR/ep002_final.mp4"
fi
log "final -> $OUTDIR/ep002_final.mp4"

# ---- 9. optional Telegram delivery ----------------------------------
if [ "$SEND_TELEGRAM" = "true" ] && [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
  log "sending final to Telegram…"
  resp="$(curl -sS -F document=@"$OUTDIR/ep002_final.mp4" -F chat_id="$TELEGRAM_CHAT_ID" \
        -F caption="Cognitia Republic — EP002" \
        "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendDocument")"
  echo "$resp" | grep -q '"ok":true' && log "Telegram delivery OK" || warn "Telegram send failed: $resp"
else
  log "Telegram send skipped (set SEND_TELEGRAM=true + TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID)"
fi
log "DONE."
