#!/usr/bin/env python3
"""
Episode 002 — 8-12s animated PREVIEW (1080x1920, 30fps).
Approval stage: builds a preview MP4 + contact sheet only. NO full 60s render.

Motion: particle drift, glow sweep, spine line-trace, node/card reveals,
terminal typing, QC scan beam, subtle parallax. Real-looking proof artifacts
(waveform / filmstrip / portrait frame / script lines / message bubble) replace
letter-monogram icons to reduce the AI-template feel.
"""
import os
os.environ.setdefault("COG_S", "1")  # native res for fast multi-frame render
import math, subprocess, sys
import render as R
from render import (W, H, C, S, base_field, glass, text, chip, glow_line, pulse,
                    measure, new_layer, comp, font)
from PIL import Image, ImageDraw, ImageFilter
import imageio_ffmpeg

FPS = 30
TMP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_pv")
OUT = os.path.dirname(os.path.abspath(__file__))
os.makedirs(TMP, exist_ok=True)

def ease(t):  # smoothstep
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)
def lerp(a, b, t): return a + (b - a) * t

# ---- background cache ----
_BG = {}
def bg(key, spec):
    if key not in _BG:
        _BG[key] = base_field(**spec)
    return _BG[key].copy()

# ---- animated ambient overlays (cheap, per-frame) ----
_SWEEP = None
def sweep_layer():
    global _SWEEP
    if _SWEEP is None:
        ly = new_layer(); d = ImageDraw.Draw(ly)
        cx = W * S * 0.5
        d.polygon([(cx - 60 * S, 0), (cx + 60 * S, 0), (cx + 200 * S, H * S),
                   (cx + 80 * S, H * S)], fill=(120, 210, 255, 26))
        _SWEEP = ly.filter(ImageFilter.GaussianBlur(40 * S))
    return _SWEEP

def ambient(base, gframe):
    # drifting sparkles
    ly = new_layer(); d = ImageDraw.Draw(ly)
    for i in range(46):
        x = (i * 173 + gframe * (1.2 + (i % 4))) % (W)
        y = (i * 271 - gframe * (0.6 + (i % 3) * 0.5)) % (H)
        r = (1 + (i % 3)) * S
        a = 60 + int(70 * (0.5 + 0.5 * math.sin(gframe * 0.06 + i)))
        col = [C["white"], C["cyan"], C["blue"]][i % 3]
        d.ellipse([x * S - r, y * S - r, x * S + r, y * S + r], fill=tuple(col) + (a,))
    out = comp(base, ly)
    # slow glow sweep crossing
    sw = sweep_layer()
    dx = int((((gframe * 3) % (W + 400)) - 200) * S)
    shifted = Image.new("RGBA", sw.size, (0, 0, 0, 0))
    shifted.paste(sw, (dx, 0))
    return comp(out, shifted)

# ---- real-looking proof artifacts -------------------------------------
def a_script(base, x, y, w, h, acc):
    out = glass(base, x, y, w, h, r=14, fill=(60, 90, 140), fa=30, border=acc, ba=120)
    ly = new_layer(); d = ImageDraw.Draw(ly)
    widths = [0.8, 0.62, 0.9, 0.5]
    for i, ww in enumerate(widths):
        yy = (y + 18 + i * 18)
        d.rounded_rectangle([(x + 16) * S, yy * S, (x + 16 + (w - 32) * ww) * S, (yy + 8) * S],
                            4 * S, fill=(190, 215, 245, 150 if i else 220))
    return comp(out, ly)

def a_wave(base, x, y, w, h, acc):
    out = glass(base, x, y, w, h, r=14, fill=(40, 80, 130), fa=30, border=acc, ba=130)
    ly = new_layer(); d = ImageDraw.Draw(ly)
    n = 16; bw = (w - 24) / n
    for i in range(n):
        bh = (0.2 + 0.8 * abs(math.sin(i * 0.9))) * (h - 30)
        bx = x + 12 + i * bw
        by = y + h / 2 - bh / 2
        d.rounded_rectangle([bx * S, by * S, (bx + bw * 0.55) * S, (by + bh) * S], 3 * S,
                            fill=tuple(acc) + (210,))
    return comp(out, ly)

def a_portrait(base, x, y, w, h, acc):
    out = glass(base, x, y, w, h, r=14, fill=(50, 80, 120), fa=40, border=acc, ba=140)
    ly = new_layer(); d = ImageDraw.Draw(ly)
    cx = x + w / 2
    d.ellipse([(cx - w * 0.16) * S, (y + h * 0.18) * S, (cx + w * 0.16) * S, (y + h * 0.52) * S],
              fill=(180, 205, 235, 180))
    d.ellipse([(cx - w * 0.3) * S, (y + h * 0.48) * S, (cx + w * 0.3) * S, (y + h * 1.05) * S],
              fill=(180, 205, 235, 180))
    ly = ly.filter(ImageFilter.GaussianBlur(2 * S))
    out = comp(out, ly)
    p = new_layer(); dp = ImageDraw.Draw(p)
    dp.polygon([((cx - 8) * S, (y + h - 22) * S), ((cx - 8) * S, (y + h - 6) * S),
                ((cx + 8) * S, (y + h - 14) * S)], fill=tuple(C["cyan"]) + (230,))
    return comp(out, p)

def a_film(base, x, y, w, h, acc):
    out = glass(base, x, y, w, h, r=14, fill=(45, 70, 110), fa=30, border=acc, ba=130)
    ly = new_layer(); d = ImageDraw.Draw(ly)
    for sx in range(0, int(w - 10), 16):
        d.rectangle([(x + 8 + sx) * S, (y + 8) * S, (x + 14 + sx) * S, (y + 14) * S], fill=(20, 30, 45, 220))
        d.rectangle([(x + 8 + sx) * S, (y + h - 14) * S, (x + 14 + sx) * S, (y + h - 8) * S], fill=(20, 30, 45, 220))
    for c in range(3):
        cxp = x + 14 + c * ((w - 24) / 3)
        d.rounded_rectangle([cxp * S, (y + 22) * S, (cxp + (w - 40) / 3) * S, (y + h - 22) * S], 4 * S,
                            fill=tuple(acc) + (90,), outline=tuple(acc) + (160,), width=S)
    return comp(out, ly)

def a_check(base, x, y, w, h, acc):
    out = glass(base, x, y, w, h, r=14, fill=(30, 60, 45), fa=40, border=acc, ba=150)
    yy = y + 16
    for i in range(3):
        out = text(out, x + 16, yy, "✓", kind="monob", size=18, fill=C["green"], anchor="lm")
        ly = new_layer(); d = ImageDraw.Draw(ly)
        d.rounded_rectangle([(x + 40) * S, (yy - 4) * S, (x + 40 + (w - 60) * (0.7 - i * 0.12)) * S, (yy + 4) * S],
                            3 * S, fill=(170, 220, 190, 160))
        out = comp(out, ly); yy += 24
    return out

def a_bubble(base, x, y, w, h, acc):
    out = glass(base, x, y, w, h, r=14, fill=(40, 75, 120), fa=35, border=acc, ba=130)
    ly = new_layer(); d = ImageDraw.Draw(ly)
    d.rounded_rectangle([(x + 14) * S, (y + 16) * S, (x + w - 24) * S, (y + h - 26) * S], 10 * S,
                        fill=tuple(acc) + (60,), outline=tuple(acc) + (170,), width=S)
    d.polygon([((x + 26) * S, (y + h - 26) * S), ((x + 26) * S, (y + h - 12) * S), ((x + 42) * S, (y + h - 26) * S)],
              fill=tuple(acc) + (170,))
    return comp(out, ly)

ART = {"script": a_script, "wave": a_wave, "portrait": a_portrait,
       "film": a_film, "check": a_check, "bubble": a_bubble}

# ---- beats -------------------------------------------------------------
HOOK_BG = dict(glows=[(150, 280, 430, C["cyan"], 0.55), (940, 1560, 520, C["violet"], 0.5),
                      (560, 880, 560, C["blue"], 0.16)], sweeps=[(118, 0.34, 70, 0.10)], particles=120)
PIPE_BG = dict(glows=[(120, 360, 380, C["cyan"], 0.4), (980, 1500, 460, C["violet"], 0.42),
                      (560, 950, 600, C["blue"], 0.14)], sweeps=[(120, 0.5, 90, 0.06)], particles=110)
BUILD_BG = dict(glows=[(180, 320, 380, C["cyan"], 0.42), (920, 1560, 480, C["violet"], 0.36),
                       (560, 760, 560, C["blue"], 0.13)], sweeps=[(122, 0.3, 70, 0.07)], particles=100)
QC_BG = dict(glows=[(560, 760, 520, C["green"], 0.16), (180, 340, 360, C["cyan"], 0.34),
                    (900, 1560, 420, C["violet"], 0.3)], sweeps=None, particles=100)

def beat_hook(p, g):
    base = ambient(bg("hook", HOOK_BG), g)
    par = math.sin(g * 0.05) * 4  # parallax bob
    ka = ease(p / 0.2)
    base = chip(base, 80, 210 + par, "COGNITIA REPUBLIC · EP 002", kind="bold", size=24,
                fg=C["cyan"], border=C["cyan"], dot=C["cyan"])[0] if ka > 0.05 else base
    lines = [("I automated", 0.05), ("my entire", 0.13), ("AI video pipeline.", 0.22)]
    ys = [560, 670, 786]
    for (s, dly), yb in zip(lines, ys):
        e = ease((p - dly) / 0.28)
        if e <= 0.01: continue
        yy = yb + (1 - e) * 46 + par
        glow = C["cyan"] if "pipeline" in s else None
        fill = (210, 248, 255) if glow else C["white"]
        base = text(base, 80, yy, s, kind="bold", size=94, fill=fill,
                    a=int(255 * e), anchor="lm", glow=glow, glow_r=20, ga=int(200 * e), shadow=True)
    if p > 0.55:
        e = ease((p - 0.55) / 0.3)
        base = text(base, 82, 906 + par, "One prompt in. Finished video out.", kind="sans",
                    size=40, fill=C["ink"], a=int(255 * e), anchor="lm", shadow=True)
        base = text(base, 82, 958 + par, "(In theory.)", kind="bold", size=40, fill=C["cyan"],
                    a=int(255 * e), anchor="lm", glow=C["cyan"], glow_r=10, ga=int(180 * e))
    return base

PIPE_NODES = [("01", "CLAUDE", "writes the script", "script.md · 1.4 kB", C["cyan"], "script"),
              ("02", "ELEVENLABS", "voices it", "vo.mp3 · 00:58", C["blue"], "wave"),
              ("03", "HEYGEN", "drives the avatar", "avatar.mp4 · chest-up", C["violet"], "portrait"),
              ("04", "FFMPEG", "composites, 1 pass", "compose.mp4 · 22.6 MB", C["blue"], "film"),
              ("05", "VISION QC", "the gate", "brand 0.91 · risk 0.07", C["amber"], "check"),
              ("06", "TELEGRAM", "delivers", "ep002.mp4 · sent", C["cyan"], "bubble")]

def beat_pipe(p, g):
    base = ambient(bg("pipe", PIPE_BG), g)
    base = text(base, 80, 280, "The engine", kind="bold", size=72, fill=C["white"], anchor="lm",
                glow=C["cyan"], glow_r=16, ga=150, shadow=True)
    x0, w, h, gap = 196, 812, 138, 34
    y = 372; spine_x = 150
    top = y + h / 2; bottom = y + (h + gap) * 5 + h / 2
    tip = lerp(top, bottom, ease(p / 0.85))
    base = glow_line(base, (spine_x, top), (spine_x, tip), C["cyan"], width=4, ga=130, glow_r=12)
    base = pulse(base, spine_x, tip, C["cyan"], r=9)
    for i, (num, tool, fn, fname, acc, art) in enumerate(PIPE_NODES):
        cy = y + i * (h + gap)
        thresh = (i + 0.4) / 6
        e = ease((ease(p / 0.85) - thresh) / 0.12)
        if e <= 0.02: continue
        gate = tool == "VISION QC"
        xo = x0 + (1 - e) * 30
        base = glow_line(base, (spine_x, cy + h / 2), (xo, cy + h / 2), acc, width=3, ga=int(110 * e), glow_r=8)
        base = glass(base, xo, cy, w, h, r=20, fill=(70, 100, 150), fa=int(24 * e),
                     border=(acc if gate else C["cyan"]), ba=int((200 if gate else 90) * e),
                     glow=(acc if gate and e > 0.8 else None))
        base = ART[art](base, xo + 24, cy + 24, 110, 90, acc)
        base = text(base, xo + 150, cy + 40, num, kind="monob", size=24, fill=C["faint"], a=int(255 * e), anchor="lm")
        base = text(base, xo + 198, cy + 40, tool, kind="bold", size=40, fill=acc, a=int(255 * e), anchor="lm")
        base = text(base, xo + 198, cy + 86, fn, kind="sans", size=28, fill=C["ink"], a=int(255 * e), anchor="lm")
        base = pulse(base, spine_x, cy + h / 2, acc, r=7)
    return base

TERM_ROWS = [("$ hermes run --episode 002 --proof", C["white"]),
             ("✓ claude   script.md              11.2s   1.4 kB", C["green"]),
             ("✓ 11labs   vo.mp3      00:58       6.0s   1.1 MB", C["green"]),
             ("✓ heygen   avatar.mp4  chest-up   41.7s  18.3 MB", C["green"]),
             ("✓ ffmpeg   compose.mp4 1 pass      9.4s  22.6 MB", C["green"]),
             ("→ qc gate  scanning 1800 frames …", C["cyan"])]

def beat_build(p, g):
    base = ambient(bg("build", BUILD_BG), g)
    base = text(base, 80, 282, "Real build proof", kind="bold", size=66, fill=C["white"], anchor="lm",
                glow=C["cyan"], glow_r=14, shadow=True)
    tx, ty, tw, th = 70, 384, 940, 620
    base = glass(base, tx, ty, tw, th, r=22, fill=(20, 34, 56), fa=150, border=C["cyan"], ba=120, glow=C["cyan"])
    # titlebar
    ly = new_layer(); d = ImageDraw.Draw(ly)
    for i, col in enumerate([C["red"], C["amber"], C["green"]]):
        cxp = tx + 26 + i * 26
        d.ellipse([cxp * S, (ty + 22) * S, (cxp + 14) * S, (ty + 36) * S], fill=tuple(col) + (235,))
    base = comp(base, ly)
    base = text(base, tx + tw / 2, ty + 29, "hermes@cognitia — run 41", kind="mono", size=22, fill=C["muted"], anchor="mm")
    # typing
    full = [s for s, _ in TERM_ROWS]
    total = sum(len(s) for s in full)
    typed = int(ease(min(1, p / 0.72)) * total)
    ry = ty + 86; acc = 0
    for i, (s, col) in enumerate(TERM_ROWS):
        if acc >= typed: break
        show = s[:max(0, typed - acc)]
        yy = ry + i * 86
        if i == 0:
            base = glass(base, tx + 28, yy - 26, tw - 56, 60, r=12, fill=C["cyan"], fa=26,
                         border=C["cyan"], ba=110, shadow=False, top_hi=False)
        base = text(base, tx + 40, yy + 4, show, kind=("monob" if i == 0 else "mono"), size=30, fill=col, anchor="lm")
        # blinking cursor at the typing head
        if acc <= typed < acc + len(s) and (g // 8) % 2 == 0:
            cw_, _ = measure(show, ("monob" if i == 0 else "mono"), 30)
            base = text(base, tx + 40 + cw_ + 4, yy + 4, "▌", kind="mono", size=30, fill=C["cyan"], anchor="lm")
        acc += len(s)
    # artifact cards slide up after typing
    if p > 0.7:
        arts = [("script.md", "1.4 kB", "script", C["cyan"]), ("vo.mp3", "1.1 MB", "wave", C["blue"]),
                ("avatar.mp4", "18.3 MB", "portrait", C["violet"]), ("ep002.mp4", "22.6 MB", "film", C["cyan"])]
        ax, ayb, aw = 70, 1090, 226
        for i, (name, sz, art, acc2) in enumerate(arts):
            e = ease((p - 0.7 - i * 0.06) / 0.2)
            if e <= 0.02: continue
            yy = ayb + (1 - e) * 40
            base = glass(base, ax + i * (aw + 12), yy, aw, 150, r=16, fill=(60, 90, 140), fa=int(26 * e), border=acc2, ba=int(120 * e))
            base = ART[art](base, ax + i * (aw + 12) + (aw - 90) / 2, yy + 14, 90, 64, acc2)
            base = text(base, ax + i * (aw + 12) + aw / 2, yy + 96, name, kind="monob", size=26, fill=C["ink"], a=int(255 * e), anchor="mm")
            base = text(base, ax + i * (aw + 12) + aw / 2, yy + 128, sz, kind="mono", size=24, fill=C["green"], a=int(255 * e), anchor="mm")
    return base

def beat_qc(p, g):
    base = ambient(bg("qc", QC_BG), g)
    base = text(base, 80, 282, "The gate decides", kind="bold", size=66, fill=C["white"], anchor="lm",
                glow=C["cyan"], glow_r=14, shadow=True)
    fx, fy, fw, fh = 300, 400, 480, 300
    base = glass(base, fx, fy, fw, fh, r=18, fill=(30, 46, 72), fa=120, border=C["cyan"], ba=140, glow=C["cyan"])
    base = a_portrait(base, fx + fw / 2 - 70, fy + 60, 140, 170, C["cyan"])
    # scan beam sweeps down during first half
    sp = ease(min(1, p / 0.45))
    beamy = lerp(fy + 12, fy + fh - 12, sp)
    base = glow_line(base, (fx + 8, beamy), (fx + fw - 8, beamy), C["cyan"], width=4, ga=210, glow_r=14)
    base = chip(base, fx + fw - 150, fy + 14, "SCANNING" if p < 0.5 else "SCANNED",
                size=20, fg=C["cyan"], border=C["cyan"], dot=C["cyan"], fill=(8, 16, 28), fa=220)[0]
    cy = 760
    if p < 0.55:
        e = ease(min(1, (p - 0.1) / 0.2))
        shake = math.sin(g * 1.5) * 3 * (1 if 0.3 < p < 0.5 else 0)
        base = glass(base, 70 + shake, cy, 940, 250, r=20, fill=(60, 24, 34), fa=int(70 * e), border=C["red"], ba=int(200 * e), glow=C["red"])
        base = chip(base, 96 + shake, cy + 22, "BLOCKED", size=28, fg=C["red"], border=C["red"], fill=(40, 12, 18), fa=230)[0]
        base = text(base, 96 + shake, cy + 110, "✗ avatar crop — chin clipped 0.94", kind="mono", size=30, fill=C["red"], a=int(255 * e), anchor="lm")
        base = text(base, 96 + shake, cy + 160, "✗ slide 2 — ink coverage 6% (< 12%)", kind="mono", size=30, fill=C["red"], a=int(255 * e), anchor="lm")
        base = text(base, 96 + shake, cy + 210, "blocked before Telegram. not after.", kind="sans", size=28, fill=(220, 150, 160), a=int(255 * e), anchor="lm")
    else:
        e = ease((p - 0.55) / 0.25)
        # green burst
        bl = new_layer(); d = ImageDraw.Draw(bl)
        rr = 200 + 200 * e
        d.ellipse([(540 - rr) * S, (cy + 125 - rr) * S, (540 + rr) * S, (cy + 125 + rr) * S], fill=tuple(C["green"]) + (int(60 * (1 - e)),))
        base = comp(base, bl.filter(ImageFilter.GaussianBlur(30 * S)))
        base = glass(base, 70, cy, 940, 250, r=20, fill=(20, 56, 36), fa=70, border=C["green"], ba=200, glow=C["green"])
        base = chip(base, 96, cy + 22, "PASSED", size=28, fg=C["green"], border=C["green"], fill=(10, 36, 20), fa=230, dot=C["green"])[0]
        checks = [("avatar re-framed", "chest-up"), ("ink coverage", "38%"),
                  ("fake-AI risk", "0.07"), ("brand score", "0.91")]
        for i, (k, v) in enumerate(checks):
            ce = ease((p - 0.6 - i * 0.04) / 0.15)
            if ce <= 0.02: continue
            row = cy + 96 + i * 38
            base = text(base, 110, row, f"✓ {k}", kind="mono", size=26, fill=C["green"], a=int(255 * ce), anchor="lm")
            base = text(base, 980, row, v, kind="monob", size=26, fill=C["ink"], a=int(255 * ce), anchor="rm")
    return base

# ---- caption track (continuous, karaoke) ------------------------------
CAPS = [(0, 75, ["here's", "what", "actually", "worked"]),
        (75, 135, ["six", "stages,", "one", "gate"]),
        (135, 225, ["script", "in", "eleven", "seconds"]),
        (225, 300, ["blocked", "before", "telegram"])]
def caption(base, gframe):
    seg = next((c for c in CAPS if c[0] <= gframe < c[1]), None)
    if not seg: return base
    a0, a1, words = seg
    active = int((gframe - a0) / (a1 - a0) * len(words))
    active = min(active, len(words) - 1)
    size = 52; gap = 18
    widths = [measure(w, "bold", size)[0] for w in words]
    total = sum(widths) + gap * (len(words) - 1)
    x = (W - total) / 2; y = 1660
    for i, wd in enumerate(words):
        col = C["cyan"] if i == active else C["white"]
        a = 255 if i <= active else 140
        base = text(base, x, y, wd, kind="bold", size=size, fill=col, a=a, anchor="lm",
                    shadow=True, glow=(C["cyan"] if i == active else None), glow_r=10, ga=150)
        x += widths[i] + gap
    return base

# ---- timeline ----------------------------------------------------------
BEATS = [(0, 75, beat_hook), (75, 135, beat_pipe), (135, 225, beat_build), (225, 300, beat_qc)]
TOTAL = 300  # 10.0s @ 30fps

def render_frame(g):
    a, b, fn = next(x for x in BEATS if x[0] <= g < x[1])
    p = (g - a) / (b - a)
    img = fn(p, g)
    img = caption(img, g)
    # beat-entry cyan flash
    for (sa, _, _) in BEATS:
        if 0 <= g - sa < 4 and sa != 0:
            fl = new_layer(); ImageDraw.Draw(fl).rectangle([0, 0, W * S, H * S], fill=tuple(C["cyan"]) + (int(70 * (1 - (g - sa) / 4)),))
            img = comp(img, fl)
    return img.convert("RGB")

def main():
    n = TOTAL
    for g in range(n):
        render_frame(g).save(os.path.join(TMP, f"f{g:04d}.png"))
        if g % 30 == 0:
            print(f"  frame {g}/{n}", flush=True)
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    out = os.path.join(OUT, "preview.mp4")
    cmd = [ff, "-y", "-framerate", str(FPS), "-i", os.path.join(TMP, "f%04d.png"),
           "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium",
           "-movflags", "+faststart", out]
    subprocess.run(cmd, check=True, capture_output=True)
    print("wrote", out)
    # contact sheet from sampled frames
    samples = [10, 55, 100, 175, 245, 290]
    th = 360; tw = 203; pad = 16
    sheet = Image.new("RGB", (len(samples) * tw + (len(samples) + 1) * pad, th + pad * 2), (6, 9, 16))
    for i, s in enumerate(samples):
        im = Image.open(os.path.join(TMP, f"f{s:04d}.png")).resize((tw, th), Image.LANCZOS)
        sheet.paste(im, (pad + i * (tw + pad), pad))
    sheet.save(os.path.join(OUT, "preview_contact.png"))
    print("wrote preview_contact.png")

if __name__ == "__main__":
    main()
