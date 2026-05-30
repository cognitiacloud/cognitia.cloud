#!/usr/bin/env bash
# =====================================================================
# Cognitia EP002 — reference frame-extraction pipeline
# Run AFTER dropping reference recordings into this folder as:
#   references/instagram_ref_01.mp4
#   references/instagram_ref_02.mp4
#   references/mitmonk_sample_01.mp4   (or .mov)
#
# Extracts: every 0.5s, dense first 3s (10fps), final CTA frame.
# Builds:   references/reference_contact_sheet.png
# Read-only on sources (copies/derives only). No network, no credits.
# =====================================================================
set -uo pipefail
REF="$(cd "$(dirname "$0")" && pwd)"
FRAMES="$REF/frames"; mkdir -p "$FRAMES"

FFMPEG="$(python3 -c 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())' 2>/dev/null || command -v ffmpeg || true)"
[ -n "$FFMPEG" ] || { echo "[refs] ffmpeg not found (pip install imageio-ffmpeg)"; exit 1; }

shopt -s nullglob nocaseglob
vids=("$REF"/*.mp4 "$REF"/*.mov "$REF"/*.webm)
shopt -u nocaseglob
if [ ${#vids[@]} -eq 0 ]; then
  echo "[refs] no reference videos found in $REF"
  echo "[refs] drop instagram_ref_01.mp4 / instagram_ref_02.mp4 / mitmonk_sample_01.mp4 here, then re-run."
  exit 0
fi

for v in "${vids[@]}"; do
  [ -f "$v" ] || continue
  name="$(basename "$v")"; name="${name%.*}"
  od="$FRAMES/$name"; mkdir -p "$od"
  echo "[refs] $name : every-0.5s + dense-hook + CTA"
  "$FFMPEG" -y -i "$v" -vf "fps=2,scale=540:-1" "$od/every_%04d.jpg" >/dev/null 2>&1 || true
  "$FFMPEG" -y -ss 0 -t 3 -i "$v" -vf "fps=10,scale=540:-1" "$od/hook_%04d.jpg" >/dev/null 2>&1 || true
  "$FFMPEG" -y -sseof -0.3 -i "$v" -update 1 -frames:v 1 -vf "scale=540:-1" "$od/cta_final.jpg" >/dev/null 2>&1 || true
  echo "[refs]   -> $(ls "$od" | wc -l) frames in $od"
done

echo "[refs] building contact sheet…"
python3 - "$FRAMES" "$REF/reference_contact_sheet.png" <<'PY'
import sys, os, glob
from PIL import Image, ImageDraw, ImageFont
frames_dir, out = sys.argv[1], sys.argv[2]
subdirs = sorted([d for d in glob.glob(os.path.join(frames_dir, "*")) if os.path.isdir(d)])
if not subdirs:
    print("[refs] no frames yet"); sys.exit(0)
cols, tw, th, pad, lab = 8, 240, 426, 10, 28
rows_imgs = []
for d in subdirs:
    name = os.path.basename(d)
    # sample: first 3 hook frames + evenly-spaced everies + cta
    hook = sorted(glob.glob(os.path.join(d, "hook_*.jpg")))[:3]
    evr = sorted(glob.glob(os.path.join(d, "every_*.jpg")))
    cta = glob.glob(os.path.join(d, "cta_final.jpg"))
    pick = hook + (evr[:: max(1, len(evr)//(cols-len(hook)-1))][:cols-len(hook)-1] if evr else []) + cta
    rows_imgs.append((name, pick[:cols]))
W = cols*tw + (cols+1)*pad
H = sum(th+lab+pad for _ in rows_imgs) + pad
sheet = Image.new("RGB", (W, H), (6, 9, 16)); d = ImageDraw.Draw(sheet)
try: f = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", 20)
except Exception: f = ImageFont.load_default()
y = pad
for name, imgs in rows_imgs:
    d.text((pad, y), name, font=f, fill=(0, 229, 255)); y += lab
    x = pad
    for p in imgs:
        try:
            im = Image.open(p).convert("RGB").resize((tw, th), Image.LANCZOS)
            sheet.paste(im, (x, y))
        except Exception: pass
        x += tw + pad
    y += th + pad
sheet.save(out)
print("[refs] wrote", out)
PY
echo "[refs] done. Open references/reference_contact_sheet.png"
