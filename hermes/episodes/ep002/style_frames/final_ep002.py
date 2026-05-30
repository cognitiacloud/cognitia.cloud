#!/usr/bin/env python3
"""
Episode 002 — FULL 60s V7 timeline (1800 frames @ 30fps).
Run by the LOCAL RUNNER's approval path; writes final.mp4 (+ final_contact.png).
Reuses the locked V7 beats from animate.py and adds the two scenes the 12s cut
compressed out: PROBLEM (S2) and LESSON (S6). Real crops in assets/run41/shots/
auto-replace placeholders (via animate.place_shot). Never fabricates proof.

NOTE: this builds/encodes the 60s locally on the operator's PC. It is NOT run
from the cloud container.
"""
import os
os.environ.setdefault("COG_S", "2")          # crisp final; runner can override
import math, subprocess
import animate as A
from animate import (ease, bg, ambient, beat_hook, beat_pipe, beat_build,
                     beat_qc, beat_result)
from render import (W, H, C, S, glass, text, chip, new_layer, comp)
from make_hero import grad_text
from PIL import Image, ImageDraw
import imageio_ffmpeg

FPS = 30
SF = os.path.dirname(os.path.abspath(__file__))
TMP = os.path.join(SF, "_final")
os.makedirs(TMP, exist_ok=True)

# ---- S2 PROBLEM --------------------------------------------------------
PROBLEM_BG = dict(glows=[(150, 300, 440, C["magenta"], 0.4), (940, 1520, 520, C["cyan"], 0.46),
                         (560, 950, 600, C["blue"], 0.15)], sweeps=[(118, 0.34, 70, 0.10)], particles=120)

def beat_problem(p, g):
    base = ambient(bg("problem", PROBLEM_BG), g)
    base = chip(base, 80, 210, "THE PITCH  vs  THE TRUTH", kind="bold", size=24,
                fg=C["cyan"], border=C["cyan"], dot=C["magenta"])[0]
    cw, ch, cy = 400, 470, 470
    e1 = ease(min(1, p / 0.32)); e2 = ease(min(1, (p - 0.18) / 0.32))
    if e1 > 0.02:
        x = 80
        base = glass(base, x, cy, cw, ch, r=22, fill=(50, 80, 140), fa=int(28 * e1), border=C["cyan"], ba=int(120 * e1))
        base = text(base, x + 30, cy + 44, "THE PITCH", kind="bold", size=34, fill=C["cyan"], a=int(255 * e1), anchor="lm")
        for i, s in enumerate(["script", "→ voice", "→ avatar", "→ edit", "→ done"]):
            base = text(base, x + 30, cy + 130 + i * 64, s, kind="bold", size=42, fill=C["ink"], a=int(255 * e1), anchor="lm")
    if e2 > 0.02:
        x = 520
        base = glass(base, x, cy, cw, ch, r=22, fill=(70, 40, 90), fa=int(30 * e2), border=C["magenta"], ba=int(150 * e2),
                     glow=(C["magenta"] if e2 > 0.8 else None))
        base = text(base, x + 30, cy + 44, "THE REALITY", kind="bold", size=34, fill=C["magenta"], a=int(255 * e2), anchor="lm")
        base = grad_text(base, x + 30, cy + 180, "7 TOOLS.", 64, (255, 255, 255), (220, 232, 245), anchor="lm", a=int(255 * e2))
        base = grad_text(base, x + 30, cy + 270, "7 WAYS", 64, (255, 255, 255), (220, 232, 245), anchor="lm", a=int(255 * e2))
        base = grad_text(base, x + 30, cy + 358, "TO FAIL.", 64, (180, 235, 255), (40, 150, 255), anchor="lm", glow=C["cyan"], glow_r=18, a=int(255 * e2))
    e3 = ease(min(1, (p - 0.6) / 0.3))
    if e3 > 0.02:
        base, _, _ = chip(base, 80, cy + ch + 40, "so I instrumented every stage", size=28,
                          fg=C["ink"], border=C["cyan"], dot=C["cyan"], fill=(10, 18, 32), fa=int(210 * e3))
    return base

# ---- S6 LESSON (honest scorecard) -------------------------------------
LESSON_BG = dict(glows=[(160, 320, 440, C["cyan"], 0.42), (940, 1520, 520, C["magenta"], 0.32),
                        (300, 1500, 420, C["green"], 0.18)], sweeps=[(118, 0.34, 70, 0.10)], particles=120)

def beat_lesson(p, g):
    base = ambient(bg("lesson", LESSON_BG), g)
    base = chip(base, 80, 210, "THE HONEST SCORECARD", kind="bold", size=24,
                fg=C["cyan"], border=C["cyan"], dot=C["green"])[0]
    e1 = ease(min(1, p / 0.35))
    if e1 > 0.02:
        base = glass(base, 80, 380, 920, 180, r=22, fill=(20, 56, 36), fa=int(34 * e1), border=C["green"], ba=int(160 * e1))
        base = text(base, 112, 430, "✓  WORKED", kind="monob", size=34, fill=C["green"], a=int(255 * e1), anchor="lm")
        base = text(base, 112, 500, "scripting · voice · composition · delivery", kind="bold", size=38, fill=C["ink"], a=int(255 * e1), anchor="lm")
    e2 = ease(min(1, (p - 0.3) / 0.35))
    if e2 > 0.02:
        base = glass(base, 80, 600, 920, 180, r=22, fill=(60, 40, 16), fa=int(34 * e2), border=C["amber"], ba=int(160 * e2))
        base = text(base, 112, 650, "•  DIDN'T, YET", kind="monob", size=34, fill=C["amber"], a=int(255 * e2), anchor="lm")
        base = text(base, 112, 720, "fully hands-off QC — I still review one frame", kind="bold", size=36, fill=C["ink"], a=int(255 * e2), anchor="lm")
    e3 = ease(min(1, (p - 0.6) / 0.35))
    if e3 > 0.02:
        base = grad_text(base, W / 2, 980, "1 FRAME", 132, (255, 255, 255), (40, 150, 255), anchor="mm",
                         glow=C["cyan"], glow_r=24, a=int(255 * e3))
        base = text(base, W / 2, 1090, "still reviewed by a human", kind="sans", size=36, fill=C["muted"], a=int(255 * e3), anchor="mm")
    return base

# ---- 60s timeline (1800 frames) ---------------------------------------
BEATS = [(0, 210, beat_hook), (210, 450, beat_problem), (450, 720, beat_pipe),
         (720, 1140, beat_build), (1140, 1440, beat_qc), (1440, 1650, beat_lesson),
         (1650, 1800, beat_result)]
TOTAL = 1800
DISSOLVE = 10

A.CAPS = [(0, 210, ["here's", "what", "actually", "worked"]),
          (210, 450, ["seven", "tools,", "seven", "failures"]),
          (450, 720, ["six", "stages,", "one", "gate"]),
          (720, 1140, ["a", "real", "logged", "run"]),
          (1140, 1440, ["blocked", "before", "telegram"]),
          (1440, 1650, ["automated,", "not", "autonomous"]),
          (1650, 1800, ["automated,", "not", "unattended"])]

def render_frame(g):
    idx = next(i for i, x in enumerate(BEATS) if x[0] <= g < x[1])
    a, b, fn = BEATS[idx]
    p = (g - a) / (b - a)
    img = fn(p, g)
    if idx > 0 and (g - a) < DISSOLVE:
        prev = BEATS[idx - 1][2](1.0, g)
        img = Image.blend(prev, img, (g - a) / DISSOLVE)
    img = A.caption(img, g)
    return img.convert("RGB")

def main():
    for g in range(TOTAL):
        render_frame(g).save(os.path.join(TMP, f"f{g:04d}.png"))
        if g % 60 == 0:
            print(f"  frame {g}/{TOTAL}", flush=True)
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    out = os.path.join(SF, "final.mp4")
    subprocess.run([ff, "-y", "-framerate", str(FPS), "-i", os.path.join(TMP, "f%04d.png"),
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium",
                    "-movflags", "+faststart", out], check=True, capture_output=True)
    print("wrote", out)
    samples = [60, 320, 580, 900, 1280, 1540, 1740]
    th, tw, pad = 360, 203, 14
    sheet = Image.new("RGB", (len(samples) * tw + (len(samples) + 1) * pad, th + pad * 2), (6, 9, 16))
    for i, s in enumerate(samples):
        sheet.paste(Image.open(os.path.join(TMP, f"f{s:04d}.png")).resize((tw, th), Image.LANCZOS), (pad + i * (tw + pad), pad))
    sheet.save(os.path.join(SF, "final_contact.png"))
    print("wrote final_contact.png")

if __name__ == "__main__":
    main()
