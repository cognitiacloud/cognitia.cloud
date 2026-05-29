#!/usr/bin/env bash
# Cognitia Republic - EP002 local crop collector (WSL / Linux)
# ------------------------------------------------------------
# READ-ONLY. Copies candidate screenshots/media into one folder, writes a
# manifest, and zips it for upload. Never moves/deletes source files. Makes
# NO network/AI/MCP calls. Does not render anything.
#
# Run:   bash collect_crops.sh
# Env:   OUT=<folder>  SHOT_DAYS=60  MAX_MB=40  bash collect_crops.sh
set -u

OUT="${OUT:-/mnt/c/Users/smrai/Desktop/cognitia_real_crops_candidates}"
SHOT_DAYS="${SHOT_DAYS:-60}"
MAX_MB="${MAX_MB:-40}"
CAND="$OUT/candidates"
mkdir -p "$CAND"

dirs=(
  "/mnt/c/Users/smrai/Downloads"
  "/mnt/c/Users/smrai/Pictures"
  "/mnt/c/Users/smrai/Pictures/Screenshots"
  "/mnt/c/Users/smrai/Desktop"
  "/mnt/c/Users/smrai/OneDrive"
  "/home/smrai/cognitia-run"
  "$HOME/cognitia-run"
)

terms='cognitia|ep002|episode|run41|hermes|heygen|elevenlabs|telegram|ffmpeg|qc|preview|avatar|voice|delivery|screenshot'

guess_slot() {
  local n; n=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')
  case "$n" in
    *heygen*|*avatar*)                                   echo heygen.png ;;
    *eleven*|*11labs*|*voice*|*tts*|*audio*)             echo elevenlabs.png ;;
    *telegram*|*delivery*|*deliver*|*sent*)              echo telegram.png ;;
    *qc*|*quality*|*gate*|*vision*|*scan*|*audit*|*privacy*) echo qc.png ;;
    *claude*|*script*|*hermes*)                          echo claude_script.png ;;
    *ffmpeg*|*compose*|*encode*|*render*|*terminal*|*log*|*build*) echo ffmpeg.png ;;
    *) echo "" ;;
  esac
}

res_of() {
  local p="$1" e="$2"
  if command -v identify >/dev/null 2>&1 && [[ "$e" =~ ^(png|jpg|jpeg|webp|gif|bmp)$ ]]; then
    identify -format '%wx%h' "$p" 2>/dev/null | head -n1; return
  fi
  if command -v ffprobe >/dev/null 2>&1 && [[ "$e" =~ ^(mp4|mov|mkv|webm)$ ]]; then
    ffprobe -v error -select_streams v:0 -show_entries stream=width,height \
      -of csv=s=x:p=0 "$p" 2>/dev/null | tr -d '[:space:]'; return
  fi
  echo ""
}

esc() { printf '"%s"' "$(printf '%s' "$1" | sed 's/"/""/g')"; }

MAN="$OUT/manifest.csv"
echo "candidate_file,original_name,source_path,modified,size_bytes,resolution,reason,likely_slot" > "$MAN"

idx=0
cutoff=$(date -d "-${SHOT_DAYS} days" +%s 2>/dev/null || echo 0)
maxbytes=$((MAX_MB * 1024 * 1024))

for d in "${dirs[@]}"; do
  [ -d "$d" ] || continue
  while IFS= read -r -d '' f; do
    base=$(basename "$f")
    low=$(printf '%s' "$base" | tr '[:upper:]' '[:lower:]')
    ext="${low##*.}"
    byterm=0; [[ "$low" =~ ($terms) ]] && byterm=1
    byshot=0
    if [[ "$ext" =~ ^(png|jpg|jpeg|webp|gif|bmp)$ ]] && [[ "$f" == *[Ss]creenshot* ]]; then
      mt=$(stat -c %Y "$f" 2>/dev/null || echo 0)
      [ "$mt" -ge "$cutoff" ] && byshot=1
    fi
    { [ "$byterm" -eq 1 ] || [ "$byshot" -eq 1 ]; } || continue

    idx=$((idx + 1))
    sz=$(stat -c %s "$f" 2>/dev/null || echo 0)
    mod=$(date -d "@$(stat -c %Y "$f" 2>/dev/null || echo 0)" +%Y-%m-%dT%H:%M:%S 2>/dev/null || echo "")
    res=$(res_of "$f" "$ext")
    if [ "$byterm" -eq 1 ]; then reason=name-match; else reason=recent-screenshot; fi
    slot=$(guess_slot "$base")
    cf=$(printf '%03d_%s' "$idx" "$base")
    if [ "$sz" -le "$maxbytes" ]; then
      cp -n "$f" "$CAND/$cf" 2>/dev/null
    else
      cf="(too large >${MAX_MB}MB - not copied)"
    fi
    echo "$(esc "$cf"),$(esc "$base"),$(esc "$f"),$(esc "$mod"),$sz,$(esc "$res"),$reason,$(esc "$slot")" >> "$MAN"
  done < <(find "$d" -type f -iregex '.*\.\(png\|jpg\|jpeg\|webp\|gif\|bmp\|mp4\|mov\|mkv\|webm\)' -print0 2>/dev/null)
done

cat > "$OUT/README_NEXT_STEPS.txt" <<EOF
Cognitia Republic - EP002 candidate crops
==========================================
$idx candidate file(s) were COPIED into ./candidates/  (your originals were not touched).

NEXT STEPS
1. Open manifest.csv. Look at the 'likely_slot' column.
2. Choose ONE best file for each slot:
     heygen.png        - clean chest-up avatar frame (no chin clip)
     elevenlabs.png    - voice/waveform generation screenshot
     telegram.png      - delivery message screenshot
     qc.png            - QC result / scores screenshot
     claude_script.png - (optional) script editor/terminal
     ffmpeg.png        - (optional) compose/log terminal
3. PRIVACY: open each chosen file and confirm NO secrets are visible -
   no API keys, emails, tokens, phone numbers, or local file paths.
   Crop or blur anything sensitive before uploading.
4. Upload cognitia_real_crops_candidates.zip back into the chat
   (or just drag the chosen image files directly).

Do NOT rename the files - I will map them to the exact slot names after you approve.
EOF

cd "$OUT" || exit 1
rm -f cognitia_real_crops_candidates.zip cognitia_real_crops_candidates.tar.gz
if command -v zip >/dev/null 2>&1; then
  zip -r -q cognitia_real_crops_candidates.zip candidates manifest.csv README_NEXT_STEPS.txt
  ARCH="$OUT/cognitia_real_crops_candidates.zip"
else
  tar -czf cognitia_real_crops_candidates.tar.gz candidates manifest.csv README_NEXT_STEPS.txt
  ARCH="$OUT/cognitia_real_crops_candidates.tar.gz  (zip not installed; sent .tar.gz instead)"
fi

echo ""
echo "Done. $idx candidate(s) collected."
echo "Folder: $OUT"
echo "Upload this archive back to the chat: $ARCH"
