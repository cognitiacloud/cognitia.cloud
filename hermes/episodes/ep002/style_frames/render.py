#!/usr/bin/env python3
"""
Cognitia Republic — Episode 002 style-frame renderer.
Premium AI-explainer approval frames (1080x1920), offline, deterministic.

Approval stage only: produces 5 PNG style frames. No MP4, no render pipeline.
Real proof text (terminal/manifest/QC JSON) is typeset crisply; premium look
comes from glows, glass cards, connection lines, particles, light sweeps.
Stylized tool thumbnails are placeholders to be swapped for real captured
screenshots at build time (kept honest — no fake app chrome / no fake metrics).
"""
import math, random, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1080, 1920
S = int(os.environ.get("COG_S", "2"))   # supersample factor (1 = fast, for video)
CW, CH = W * S, H * S
random.seed(2)
np.random.seed(2)

# ---- Cognitia palette (approved) ----
C = {
    "base":   (7, 11, 20),
    "base2":  (10, 16, 30),
    "cyan":   (0, 229, 255),     # primary signature
    "blue":   (88, 166, 255),    # supporting labels
    "violet": (124, 92, 247),    # energy glow
    "magenta":(224, 64, 251),    # high-energy accent / light streaks (V7)
    "white":  (255, 255, 255),
    "green":  (34, 197, 94),     # verified / pass only
    "red":    (255, 92, 114),    # blocked only
    "amber":  (240, 136, 62),
    "ink":    (230, 237, 243),
    "muted":  (139, 148, 158),
    "faint":  (86, 96, 112),
}

FONTS = {
    "sans":  "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "bold":  "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "mono":  "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
    "monob": "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf",
}
_fc = {}
def font(kind, size):
    key = (kind, int(size * S))
    if key not in _fc:
        _fc[key] = ImageFont.truetype(FONTS[kind], int(size * S))
    return _fc[key]

def new_layer():
    return Image.new("RGBA", (CW, CH), (0, 0, 0, 0))

def comp(base, layer):
    return Image.alpha_composite(base, layer)

# --------------------------------------------------------------------------
# Background field: gradient + radial glows + grid + particles + light sweep
# --------------------------------------------------------------------------
def base_field(glows, grid=True, particles=180, sweeps=None, vignette=0.55):
    yy, xx = np.ogrid[0:CH, 0:CW]
    t = yy / CH
    arr = np.zeros((CH, CW, 3), np.float32)
    top = np.array(C["base"], np.float32)
    bot = np.array(C["base2"], np.float32)
    arr += top[None, None, :] * (1 - t)[..., None] + bot[None, None, :] * t[..., None]

    for (cx, cy, sig, col, inten) in glows:
        cx, cy, sig = cx * S, cy * S, sig * S
        d2 = (xx - cx) ** 2 + (yy - cy) ** 2
        g = np.exp(-d2 / (2 * sig * sig)).astype(np.float32)
        arr += np.array(col, np.float32)[None, None, :] * g[..., None] * inten

    if sweeps:
        for (ang, pos, width, inten) in sweeps:
            a = math.radians(ang)
            proj = (xx * math.cos(a) + yy * math.sin(a))
            center = proj.min() + (proj.max() - proj.min()) * pos
            band = np.exp(-((proj - center) ** 2) / (2 * (width * S) ** 2)).astype(np.float32)
            arr += np.array(C["white"], np.float32)[None, None, :] * band[..., None] * inten

    if grid:
        step = 64 * S
        gl = np.zeros((CH, CW), np.float32)
        gl[::step, :] = 1.0
        gl[:, ::step] = 1.0
        arr += np.array((40, 70, 110), np.float32)[None, None, :] * gl[..., None] * 0.10

    # vignette
    cx, cy = CW / 2, CH / 2
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / math.sqrt(cx * cx + cy * cy)
    vig = (1 - vignette * np.clip(d - 0.25, 0, 1)).astype(np.float32)
    arr *= vig[..., None]

    arr = np.clip(arr, 0, 255).astype(np.uint8)
    img = Image.fromarray(arr, "RGB").convert("RGBA")

    if particles:
        pl = new_layer(); d = ImageDraw.Draw(pl)
        for _ in range(particles):
            x, y = random.randint(0, CW), random.randint(0, CH)
            r = random.choice([1, 1, 1, 2, 2, 3]) * S
            a = random.randint(20, 130)
            col = random.choice([C["white"], C["cyan"], C["blue"]])
            d.ellipse([x - r, y - r, x + r, y + r], fill=col + (a,))
        # a few bokeh glints
        gl = new_layer(); dg = ImageDraw.Draw(gl)
        for _ in range(10):
            x, y = random.randint(0, CW), random.randint(0, CH)
            r = random.randint(6, 16) * S
            dg.ellipse([x - r, y - r, x + r, y + r], fill=C["cyan"] + (60,))
        gl = gl.filter(ImageFilter.GaussianBlur(10 * S))
        img = comp(comp(img, gl), pl)
    return img

# --------------------------------------------------------------------------
# Primitives (logical coordinates; scaled internally)
# --------------------------------------------------------------------------
def glass(base, x, y, w, h, r=22, fill=(150, 185, 235), fa=20,
          border=(0, 229, 255), ba=95, shadow=True, top_hi=True, glow=None):
    x, y, w, h, r = x * S, y * S, w * S, h * S, r * S
    out = base
    if glow:
        gl = new_layer(); dg = ImageDraw.Draw(gl)
        dg.rounded_rectangle([x, y, x + w, y + h], r + 6 * S, outline=glow + (160,), width=6 * S)
        gl = gl.filter(ImageFilter.GaussianBlur(14 * S))
        out = comp(out, gl)
    if shadow:
        sh = new_layer(); ds = ImageDraw.Draw(sh)
        ds.rounded_rectangle([x, y + 8 * S, x + w, y + h + 14 * S], r, fill=(0, 0, 0, 150))
        sh = sh.filter(ImageFilter.GaussianBlur(20 * S))
        out = comp(out, sh)
    ly = new_layer(); d = ImageDraw.Draw(ly)
    d.rounded_rectangle([x, y, x + w, y + h], r, fill=fill + (fa,))
    d.rounded_rectangle([x, y, x + w, y + h], r, outline=border + (ba,), width=max(1, int(1.5 * S)))
    if top_hi:
        d.line([x + r, y + 1 * S, x + w - r, y + 1 * S], fill=(255, 255, 255, 60), width=max(1, int(1 * S)))
    return comp(out, ly)

def text(base, x, y, s, kind="bold", size=40, fill=(255, 255, 255), a=255,
         anchor="la", glow=None, glow_r=14, ga=180, shadow=False, spacing=4):
    f = font(kind, size)
    out = base
    px, py = x * S, y * S
    if glow:
        gl = new_layer(); dg = ImageDraw.Draw(gl)
        dg.text((px, py), s, font=f, fill=glow + (ga,), anchor=anchor, spacing=spacing * S)
        gl = gl.filter(ImageFilter.GaussianBlur(glow_r * S))
        out = comp(out, gl)
    if shadow:
        sl = new_layer(); dsd = ImageDraw.Draw(sl)
        dsd.text((px + 2 * S, py + 3 * S), s, font=f, fill=(0, 0, 0, 170), anchor=anchor, spacing=spacing * S)
        sl = sl.filter(ImageFilter.GaussianBlur(3 * S))
        out = comp(out, sl)
    ly = new_layer(); d = ImageDraw.Draw(ly)
    d.text((px, py), s, font=f, fill=fill + (a,), anchor=anchor, spacing=spacing * S)
    return comp(out, ly)

def measure(s, kind, size, spacing=4):
    f = font(kind, size)
    img = Image.new("RGBA", (10, 10))
    d = ImageDraw.Draw(img)
    b = d.textbbox((0, 0), s, font=f, spacing=spacing * S)
    return (b[2] - b[0]) / S, (b[3] - b[1]) / S

def chip(base, x, y, label, kind="bold", size=24, fg=(0, 229, 255), border=(0, 229, 255),
         padx=18, pady=10, dot=None, fill=(12, 22, 38), fa=170):
    tw, th = measure(label, kind, size)
    w, h = tw + padx * 2 + (28 if dot else 0), th + pady * 2
    out = glass(base, x, y, w, h, r=h / 2, fill=fill, fa=fa, border=border, ba=150, shadow=False, top_hi=False)
    tx = x + padx
    if dot:
        cy = y + h / 2
        ly = new_layer(); d = ImageDraw.Draw(ly)
        d.ellipse([(x + padx) * S, (cy - 6) * S, (x + padx + 12) * S, (cy + 6) * S], fill=dot + (255,))
        out = comp(out, ly)
        tx = x + padx + 22
    out = text(out, tx, y + h / 2, label, kind=kind, size=size, fill=fg, anchor="lm")
    return out, w, h

def glow_line(base, p1, p2, color, width=3, ga=150, glow_r=10):
    (x1, y1), (x2, y2) = p1, p2
    gl = new_layer(); d = ImageDraw.Draw(gl)
    d.line([x1 * S, y1 * S, x2 * S, y2 * S], fill=color + (ga,), width=int((width + 6) * S))
    gl = gl.filter(ImageFilter.GaussianBlur(glow_r * S))
    out = comp(base, gl)
    ly = new_layer(); d2 = ImageDraw.Draw(ly)
    d2.line([x1 * S, y1 * S, x2 * S, y2 * S], fill=color + (235,), width=int(width * S))
    return comp(out, ly)

def pulse(base, x, y, color, r=7):
    gl = new_layer(); d = ImageDraw.Draw(gl)
    d.ellipse([(x - r * 2) * S, (y - r * 2) * S, (x + r * 2) * S, (y + r * 2) * S], fill=color + (160,))
    gl = gl.filter(ImageFilter.GaussianBlur(8 * S))
    out = comp(base, gl)
    ly = new_layer(); d2 = ImageDraw.Draw(ly)
    d2.ellipse([(x - r) * S, (y - r) * S, (x + r) * S, (y + r) * S], fill=C["white"] + (255,))
    d2.ellipse([(x - r * 0.5) * S, (y - r * 0.5) * S, (x + r * 0.5) * S, (y + r * 0.5) * S], fill=color + (255,))
    return comp(out, ly)

def icon_token(base, x, y, sz, label, accent):
    out = glass(base, x, y, sz, sz, r=sz * 0.28, fill=accent, fa=42, border=accent, ba=200, shadow=True, glow=accent)
    out = text(out, x + sz / 2, y + sz / 2, label, kind="bold", size=sz * 0.42, fill=C["white"], anchor="mm", glow=accent, glow_r=8)
    return out

def save(img, path):
    img.convert("RGB").resize((W, H), Image.LANCZOS).save(path, "PNG")
    print("wrote", path)
