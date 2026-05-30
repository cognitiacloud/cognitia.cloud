#!/usr/bin/env python3
"""
Episode 002 — V7 HERO style frame (approved high-energy reference).
Premium MrBeast-energy + pro tech: oversized gradient headline, cyan/blue/
magenta glow, glass cards, real Cognitia pipeline row, tagline bar, earth arc.
Approval still frame only — no MP4, no 60s render. Telegram block is a clearly
labeled placeholder until a real crop is supplied.
"""
import os, math
import render as R
from render import (W, H, C, S, base_field, glass, text, chip, glow_line, pulse,
                    icon_token, measure, save, new_layer, comp, font)
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.dirname(os.path.abspath(__file__))

def grad_text(base, x, y, s, size, top, bot, anchor="mm", glow=None, glow_r=24):
    """Oversized headline filled with a vertical gradient, optional glow."""
    f = font("bold", size)
    tmp = Image.new("RGBA", (10, 10))
    b = ImageDraw.Draw(tmp).textbbox((0, 0), s, font=f)
    tw, th = b[2] - b[0], b[3] - b[1]
    pad = int(glow_r * S * 1.5) if glow else 8 * S
    tile = Image.new("RGBA", (tw + pad * 2, th + pad * 2), (0, 0, 0, 0))
    td = ImageDraw.Draw(tile)
    td.text((pad - b[0], pad - b[1]), s, font=f, fill=(255, 255, 255, 255))
    alpha = tile.getchannel("A")
    grad = Image.new("RGBA", tile.size, (0, 0, 0, 0))
    ga = ImageDraw.Draw(grad)
    for row in range(tile.size[1]):
        t = row / max(1, tile.size[1] - 1)
        col = tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3))
        ga.line([(0, row), (tile.size[0], row)], fill=col + (255,))
    grad.putalpha(alpha)
    out = base
    if glow:
        gl = Image.new("RGBA", tile.size, (0, 0, 0, 0))
        gld = ImageDraw.Draw(gl)
        gld.text((pad - b[0], pad - b[1]), s, font=f, fill=glow + (210,))
        gl = gl.filter(ImageFilter.GaussianBlur(glow_r * S))
        out = _paste(out, gl, x, y, anchor, tw, th, pad)
    return _paste(out, grad, x, y, anchor, tw, th, pad)

def _paste(base, tile, x, y, anchor, tw, th, pad):
    px, py = int(x * S), int(y * S)
    ox = px - (tile.size[0] // 2 if "m" in anchor else pad)
    oy = py - (tile.size[1] // 2 if "m" in anchor else pad)
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    layer.paste(tile, (ox, oy), tile)
    return comp(base, layer)

def streaks(base):
    ly = new_layer(); d = ImageDraw.Draw(ly)
    d.polygon([(0, 0), (260 * S, 0), (60 * S, H * S), (0, H * S)], fill=C["magenta"] + (40,))
    d.line([(W * S, 60 * S), (W * 0.5 * S, 0)], fill=C["cyan"] + (120,), width=3 * S)
    d.line([(W * S, 180 * S), (W * 0.62 * S, 0)], fill=C["blue"] + (90,), width=2 * S)
    ly = ly.filter(ImageFilter.GaussianBlur(6 * S))
    return comp(base, ly)

def earth_arc(base):
    ly = new_layer(); d = ImageDraw.Draw(ly)
    cx, cy, r = W / 2, H + 360, 760
    d.ellipse([(cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S],
              outline=C["cyan"] + (200,), width=5 * S)
    ly = ly.filter(ImageFilter.GaussianBlur(7 * S))
    out = comp(base, ly)
    gl = new_layer(); dg = ImageDraw.Draw(gl)
    dg.ellipse([(cx - r - 30) * S, (cy - r - 30) * S, (cx + r + 30) * S, (cy + r + 30) * S],
               outline=C["blue"] + (120,), width=40 * S)
    return comp(out, gl.filter(ImageFilter.GaussianBlur(40 * S)))

def bolt(base, x, y, acc):
    ly = new_layer(); d = ImageDraw.Draw(ly)
    pts = [(x, y - 22), (x - 12, y + 4), (x - 1, y + 4), (x - 8, y + 24),
           (x + 14, y - 6), (x + 2, y - 6)]
    d.polygon([(p[0] * S, p[1] * S) for p in pts], fill=acc + (255,))
    out = comp(base, ly.filter(ImageFilter.GaussianBlur(0)))
    gl = new_layer(); dg = ImageDraw.Draw(gl)
    dg.polygon([(p[0] * S, p[1] * S) for p in pts], fill=acc + (180,))
    return comp(out, gl.filter(ImageFilter.GaussianBlur(8 * S)))

# real Cognitia pipeline stages (NOT the generic monitor/download/process row)
STAGES = [("SCRIPT", "Claude", C["cyan"], "C"), ("VOICE", "ElevenLabs", C["blue"], "11"),
          ("AVATAR", "HeyGen", C["magenta"], "HG"), ("COMPOSE", "FFmpeg", C["blue"], "FF"),
          ("DELIVER", "Telegram", C["cyan"], "TG")]

def hero():
    base = base_field(
        glows=[(160, 300, 460, C["magenta"], 0.42), (940, 1500, 520, C["cyan"], 0.5),
               (560, 980, 620, C["blue"], 0.16), (840, 360, 320, C["violet"], 0.3)],
        sweeps=[(118, 0.32, 70, 0.10)], particles=200, vignette=0.62)
    base = streaks(base)
    base = earth_arc(base)

    # delivery card (Telegram = labeled placeholder)
    dx, dy, dw, dh = 150, 150, 780, 250
    base = glass(base, dx, dy, dw, dh, r=26, fill=(30, 60, 110), fa=40, border=C["cyan"], ba=170, glow=C["cyan"])
    base = icon_token(base, dx + 30, dy + 60, 120, " ", C["cyan"])
    # play-triangle badge over the token (drawn, no glyph dependency)
    _pl = new_layer(); _pd = ImageDraw.Draw(_pl)
    _cx, _cy = dx + 30 + 60, dy + 60 + 60
    _pd.polygon([((_cx - 16) * S, (_cy - 22) * S), ((_cx - 16) * S, (_cy + 22) * S), ((_cx + 22) * S, _cy * S)],
                fill=C["white"] + (235,))
    base = comp(base, _pl)
    base, _, _ = chip(base, dx + 30, dy + 22, "PLACEHOLDER", size=18, fg=C["magenta"],
                      border=C["magenta"], fill=(40, 10, 40), fa=220)
    base = text(base, dx + 190, dy + 78, "Telegram · delivery", kind="bold", size=38, fill=C["ink"], anchor="lm")
    base = text(base, dx + 190, dy + 134, "ep002.mp4 · 22.6 MB", kind="monob", size=38, fill=C["white"], anchor="lm")
    base = text(base, dx + 190, dy + 186, "delivered ✓✓  (placeholder)", kind="mono", size=28, fill=C["green"], anchor="lm")

    # OVERSIZED headline
    base = grad_text(base, W / 2, 560, "AUTOMATED,", 150, (255, 255, 255), (225, 235, 245), glow=C["magenta"], glow_r=20)
    base = grad_text(base, W / 2, 720, "NOT", 150, (255, 255, 255), (225, 235, 245), glow=C["cyan"], glow_r=18)
    base = grad_text(base, W / 2, 900, "UNATTENDED.", 142, (180, 235, 255), (40, 150, 255), glow=C["cyan"], glow_r=26)

    # brand divider
    base = glow_line(base, (W / 2 - 320, 1018), (W / 2 - 130, 1018), C["cyan"], width=3, ga=150)
    base = glow_line(base, (W / 2 + 130, 1018), (W / 2 + 320, 1018), C["cyan"], width=3, ga=150)
    base = text(base, W / 2, 1018, "C O G N I T I A   R E P U B L I C", kind="bold", size=30,
                fill=C["white"], anchor="mm", glow=C["cyan"], glow_r=8)
    base = text(base, W / 2, 1066, "AI-POWERED VIDEO PIPELINE AUTOMATION", kind="bold", size=24,
                fill=C["blue"], anchor="mm", spacing=6)

    # real pipeline row (glass cards + connectors)
    n = len(STAGES); cw, gap = 168, 18
    total = n * cw + (n - 1) * gap
    x0 = (W - total) / 2; cy = 1130; ch = 250
    for i, (label, tool, acc, ic) in enumerate(STAGES):
        x = x0 + i * (cw + gap)
        if i < n - 1:
            base = glow_line(base, (x + cw, cy + ch / 2), (x + cw + gap, cy + ch / 2), C["cyan"], width=3, ga=140)
        base = glass(base, x, cy, cw, ch, r=20, fill=(50, 80, 140), fa=26, border=acc, ba=150,
                     glow=(acc if i == n - 1 else None))
        base = text(base, x + cw / 2, cy + 36, label, kind="bold", size=26, fill=acc, anchor="mm", glow=acc, glow_r=6)
        base = icon_token(base, x + cw / 2 - 44, cy + 66, 88, ic, acc)
        base = text(base, x + cw / 2, cy + 196, tool, kind="sans", size=24, fill=C["ink"], anchor="mm")

    # tagline strip
    base = text(base, W / 2, 1452, "AUTOMATED FLOW   ·   REAL RESULTS   ·   ZERO MANUAL DRAG",
                kind="bold", size=24, fill=C["blue"], anchor="mm", spacing=2)
    # CTA bar
    bx, by, bw, bh = 150, 1510, 780, 92
    base = glass(base, bx, by, bw, bh, r=bh / 2, fill=(20, 30, 50), fa=120, border=C["magenta"], ba=160, glow=C["magenta"])
    base = bolt(base, bx + 60, by + bh / 2, C["magenta"])
    base = text(base, bx + 120, by + bh / 2, "YOUR CONTENT.  DELIVERED.  EVERY TIME.",
                kind="bold", size=30, fill=C["white"], anchor="lm")

    # footer wordmark
    base = text(base, W / 2, 1700, "·  ·  ·", kind="bold", size=24, fill=C["cyan"], anchor="mm")
    base = text(base, W / 2, 1748, "C O G N I T I A   R E P U B L I C", kind="bold", size=30, fill=C["white"],
                anchor="mm", glow=C["cyan"], glow_r=8)
    base = text(base, W / 2, 1792, "Automate with Intelligence.", kind="sans", size=26, fill=C["muted"], anchor="mm")
    save(base, os.path.join(OUT, "HERO_v7.png"))

if __name__ == "__main__":
    hero()
