#!/usr/bin/env python3
"""Build the 5 Episode-002 approval style frames (1080x1920 PNG)."""
import os, sys
from render import (W, H, C, base_field, glass, text, chip, glow_line, pulse,
                    icon_token, measure, save, new_layer, comp, font)
from PIL import ImageDraw, ImageFilter

OUT = os.path.dirname(os.path.abspath(__file__))

# ---- shared bits --------------------------------------------------------
def kicker(base, x, y, label):
    out, w, h = chip(base, x, y, label, kind="bold", size=24, fg=C["cyan"],
                     border=C["cyan"], dot=C["cyan"])
    return out

def caption(base, words, active, y=1640):
    # phrase-chunked karaoke sample (active word in cyan), shadowed for legibility
    size = 52
    gap = 18
    widths = [measure(w, "bold", size)[0] for w in words]
    total = sum(widths) + gap * (len(words) - 1)
    x = (W - total) / 2
    out = base
    for i, wd in enumerate(words):
        col = C["cyan"] if i == active else C["white"]
        a = 255 if i <= active else 140
        out = text(out, x, y, wd, kind="bold", size=size, fill=col, a=a,
                   anchor="lm", shadow=True, glow=(C["cyan"] if i == active else None), glow_r=10, ga=150)
        x += widths[i] + gap
    return out

def avatar_bubble(base, cx, cy, r, label="operator · live cam"):
    out = glass(base, cx - r, cy - r, r * 2, r * 2, r=r, fill=(40, 70, 120), fa=70,
                border=C["cyan"], ba=200, glow=C["cyan"])
    # soft portrait silhouette
    ly = new_layer(); d = ImageDraw.Draw(ly)
    S = 2
    d.ellipse([(cx - r * 0.34) * S, (cy - r * 0.45) * S, (cx + r * 0.34) * S, (cy + r * 0.22) * S],
              fill=(150, 180, 220, 150))  # head
    d.ellipse([(cx - r * 0.62) * S, (cy + r * 0.18) * S, (cx + r * 0.62) * S, (cy + r * 1.1) * S],
              fill=(150, 180, 220, 150))  # shoulders
    ly = ly.filter(ImageFilter.GaussianBlur(4 * S))
    out = comp(out, ly)
    out, _, _ = chip(out, cx - 92, cy + r - 6, label, size=20, fg=C["ink"],
                     border=C["cyan"], fill=(8, 14, 26), fa=210)
    return out

def float_panel(base, x, y, w, h, lines, blur=5, accent=C["cyan"], alpha=140):
    """A dim, slightly-blurred proof panel floating in the background."""
    tile = new_layer()
    tile = glass(tile, x, y, w, h, r=16, fill=(120, 160, 220), fa=16, border=accent, ba=70, shadow=False, top_hi=False)
    yy = y + 20
    for ln, col in lines:
        tile = text(tile, x + 22, yy, ln, kind="mono", size=22, fill=col, a=200, anchor="la")
        yy += 32
    tile = tile.filter(ImageFilter.GaussianBlur(blur * 2))
    # fade
    from PIL import Image
    fade = Image.new("L", tile.size, alpha)
    tile.putalpha(Image.composite(tile.getchannel("A"), Image.new("L", tile.size, 0), fade))
    return comp(base, tile)

def window_titlebar(base, x, y, w, title):
    out = base
    S = 2
    ly = new_layer(); d = ImageDraw.Draw(ly)
    for i, col in enumerate([C["red"], C["amber"], C["green"]]):
        cxp = (x + 26 + i * 26)
        d.ellipse([cxp * S, (y + 22) * S, (cxp + 14) * S, (y + 36) * S], fill=col + (235,))
    out = comp(out, ly)
    out = text(out, x + w / 2, y + 29, title, kind="mono", size=22, fill=C["muted"], anchor="mm")
    return out

# =========================================================================
def frame_A():
    base = base_field(
        glows=[(150, 280, 430, C["cyan"], 0.55), (940, 1560, 520, C["violet"], 0.5),
               (560, 880, 560, C["blue"], 0.16), (820, 380, 300, C["white"], 0.06)],
        sweeps=[(118, 0.34, 70, 0.12)], particles=210)
    # floating proof behind headline
    base = float_panel(base, 690, 250, 360, 150,
                       [("$ hermes run --ep 002", C["cyan"]),
                        ("✓ script.md   1.4kB", C["green"]),
                        ("✓ vo.mp3   00:58", C["green"]),
                        ("✓ avatar.mp4  ok", C["green"])], blur=4, alpha=120)
    base = float_panel(base, -40, 1180, 360, 160,
                       [("ffmpeg -i ... -1pass", C["blue"]),
                        ("frames 1800/1800", C["muted"]),
                        ("qc: PASS  0.91", C["green"])], blur=5, alpha=110)

    base = kicker(base, 80, 210, "COGNITIA REPUBLIC · EP 002")
    base = text(base, 80, 560, "I automated", kind="bold", size=94, fill=C["white"], anchor="lm", shadow=True)
    base = text(base, 80, 670, "my entire", kind="bold", size=94, fill=C["white"], anchor="lm", shadow=True)
    base = text(base, 80, 786, "AI video pipeline.", kind="bold", size=94, fill=(210, 248, 255),
                anchor="lm", glow=C["cyan"], glow_r=20, ga=200, shadow=True)
    base = text(base, 82, 906, "One prompt in. Finished video out.", kind="sans", size=40,
                fill=C["ink"], anchor="lm", shadow=True)
    base = text(base, 82, 958, "(In theory.)", kind="bold", size=40, fill=C["cyan"], anchor="lm",
                glow=C["cyan"], glow_r=10)
    base, _, _ = chip(base, 690, 420, "real run, not a mockup", size=22, fg=C["ink"],
                      border=C["cyan"], dot=C["cyan"], fill=(8, 14, 26), fa=210)
    base = avatar_bubble(base, 880, 1330, 120)
    base = caption(base, ["here's", "what", "actually", "worked"], 2)
    save(base, os.path.join(OUT, "A_hook.png"))

def frame_B():
    base = base_field(
        glows=[(120, 360, 380, C["cyan"], 0.4), (980, 1500, 460, C["violet"], 0.42),
               (560, 950, 600, C["blue"], 0.14)],
        sweeps=[(120, 0.5, 90, 0.07)], particles=150)
    base = kicker(base, 80, 200, "SIX STAGES · ONE GATE")
    base = text(base, 80, 280, "The engine", kind="bold", size=72, fill=C["white"], anchor="lm",
                glow=C["cyan"], glow_r=16, ga=150, shadow=True)
    base, mw, mh = chip(base, 720, 268, "~78s end-to-end", size=26, fg=C["cyan"], border=C["cyan"],
                        dot=C["green"])

    nodes = [
        ("01", "CLAUDE", "writes the script", "script.md · 1.4 kB", C["cyan"], "C"),
        ("02", "ELEVENLABS", "voices it", "vo.mp3 · 00:58", C["blue"], "11"),
        ("03", "HEYGEN", "drives the avatar", "avatar.mp4 · chest-up", C["violet"], "HG"),
        ("04", "FFMPEG", "composites, 1 pass", "compose.mp4 · 22.6 MB", C["blue"], "FF"),
        ("05", "VISION QC", "the gate", "brand 0.91 · risk 0.07", C["amber"], "QC"),
        ("06", "TELEGRAM", "delivers", "ep002.mp4 · sent", C["cyan"], "TG"),
    ]
    x0, w, h, gap = 196, 812, 138, 34
    y = 372
    spine_x = 150
    base = glow_line(base, (spine_x, y + h / 2), (spine_x, y + (h + gap) * (len(nodes) - 1) + h / 2),
                     C["cyan"], width=4, ga=120, glow_r=12)
    for i, (num, tool, fn, fname, acc, ic) in enumerate(nodes):
        cy = y + i * (h + gap)
        gate = tool == "VISION QC"
        base = glow_line(base, (spine_x, cy + h / 2), (x0, cy + h / 2), acc, width=3, ga=110, glow_r=8)
        base = glass(base, x0, cy, w, h, r=20, fill=(70, 100, 150), fa=24,
                     border=(acc if gate else C["cyan"]), ba=(200 if gate else 90),
                     glow=(acc if gate else None))
        base = icon_token(base, x0 + 24, cy + 19, 100, ic, acc)
        base = text(base, x0 + 150, cy + 40, f"{num}", kind="monob", size=24, fill=C["faint"], anchor="lm")
        base = text(base, x0 + 198, cy + 40, tool, kind="bold", size=40, fill=acc, anchor="lm",
                    glow=(acc if gate else None), glow_r=8)
        base = text(base, x0 + 198, cy + 86, fn, kind="sans", size=28, fill=C["ink"], anchor="lm")
        base, cw, ch = chip(base, x0 + w - 320, cy + h / 2 - 22, fname, size=24, fg=C["muted"],
                            border=(acc if gate else C["blue"]), fill=(10, 18, 32), fa=200)
        base = pulse(base, spine_x, cy + h / 2, acc, r=8)
        if gate:
            base, _, _ = chip(base, x0 + w - 96, cy - 14, "GATE", size=20, fg=C["amber"],
                              border=C["amber"], fill=(28, 18, 6), fa=220)
    save(base, os.path.join(OUT, "B_pipeline.png"))

def frame_C():
    base = base_field(
        glows=[(180, 320, 380, C["cyan"], 0.42), (920, 1560, 480, C["violet"], 0.36),
               (560, 760, 560, C["blue"], 0.13)],
        sweeps=[(122, 0.3, 70, 0.08)], particles=140)
    base = kicker(base, 80, 200, "RUN #41 · LIVE LOG")
    base = text(base, 80, 282, "Real build proof", kind="bold", size=66, fill=C["white"], anchor="lm",
                glow=C["cyan"], glow_r=14, shadow=True)

    tx, ty, tw, th = 70, 384, 940, 700
    base = glass(base, tx, ty, tw, th, r=22, fill=(20, 34, 56), fa=140, border=C["cyan"], ba=120, glow=C["cyan"])
    base = window_titlebar(base, tx, ty, tw, "hermes@cognitia — run 41")
    rows = [
        ("$ hermes run --episode 002 --proof", C["white"], None),
        ("✓ claude   script.md              11.2s   1.4 kB", C["green"], None),
        ("✓ 11labs   vo.mp3      00:58       6.0s   1.1 MB", C["green"], None),
        ("✓ heygen   avatar.mp4  chest-up   41.7s  18.3 MB", C["green"], "ring"),
        ("✓ ffmpeg   compose.mp4 1 pass      9.4s  22.6 MB", C["green"], None),
        ("→ qc gate  scanning 1800 frames …", C["cyan"], None),
    ]
    ry = ty + 74
    base = text(base, tx + 40, ry + 4, ">", kind="monob", size=30, fill=C["cyan"], anchor="lm",
                glow=C["cyan"], glow_r=8)
    for i, (ln, col, mark) in enumerate(rows):
        yy = ry + i * 96
        if i == 0:
            # highlighted active command line
            base = glass(base, tx + 28, yy - 22, tw - 56, 64, r=12, fill=C["cyan"], fa=26,
                         border=C["cyan"], ba=120, shadow=False, top_hi=False)
        base = text(base, tx + 56, yy + 8, ln, kind=("monob" if i == 0 else "mono"), size=30,
                    fill=col, anchor="lm")
        if mark == "ring":
            ly = new_layer(); d = ImageDraw.Draw(ly); Sx = 2
            d.rounded_rectangle([(tx + 30) * Sx, (yy - 22) * Sx, (tx + tw - 30) * Sx, (yy + 40) * Sx],
                                12 * Sx, outline=C["cyan"] + (220,), width=3 * Sx)
            ly = ly.filter(ImageFilter.GaussianBlur(2))
            base = comp(base, ly)
            base, _, _ = chip(base, tx + tw - 360, yy - 70, "no crop · chest-up", size=22,
                              fg=C["cyan"], border=C["cyan"], dot=C["green"], fill=(8, 16, 28), fa=220)

    # floating artifact cards
    arts = [("script.md", "1.4 kB"), ("vo.mp3", "1.1 MB"), ("avatar.mp4", "18.3 MB"), ("ep002.mp4", "22.6 MB")]
    ax, ay, aw = 70, 1150, 226
    base = text(base, 70, 1118, "ARTIFACTS WRITTEN", kind="bold", size=22, fill=C["muted"], anchor="lm")
    for i, (name, sz) in enumerate(arts):
        x = ax + i * (aw + 12)
        base = glass(base, x, ay, aw, 150, r=16, fill=(60, 90, 140), fa=26, border=C["blue"], ba=110)
        base = text(base, x + aw / 2, ay + 52, name, kind="monob", size=28, fill=C["ink"], anchor="mm")
        base = text(base, x + aw / 2, ay + 96, sz, kind="mono", size=26, fill=C["green"], anchor="mm")
        ly = new_layer(); d = ImageDraw.Draw(ly); Sx = 2
        d.ellipse([(x + aw - 34) * Sx, (ay + 16) * Sx, (x + aw - 18) * Sx, (ay + 32) * Sx], fill=C["green"] + (255,))
        base = comp(base, ly)
    base = caption(base, ["script", "in", "eleven", "seconds"], 2, y=1640)
    save(base, os.path.join(OUT, "C_build.png"))

def frame_D():
    base = base_field(
        glows=[(560, 760, 520, C["green"], 0.18), (180, 340, 360, C["cyan"], 0.34),
               (900, 1560, 420, C["violet"], 0.3)],
        sweeps=[(0, 0.34, 36, 0.18)], particles=130)  # horizontal scan-ish sweep
    base = kicker(base, 80, 200, "QC GATE · PASS / FAIL")
    base = text(base, 80, 282, "The gate decides", kind="bold", size=66, fill=C["white"], anchor="lm",
                glow=C["cyan"], glow_r=14, shadow=True)

    # frame thumbnail with scan beam
    fx, fy, fw, fh = 300, 380, 480, 300
    base = glass(base, fx, fy, fw, fh, r=18, fill=(30, 46, 72), fa=120, border=C["cyan"], ba=140, glow=C["cyan"])
    base = text(base, fx + fw / 2, fy + fh / 2 - 20, "frame 0942 / 1800", kind="mono", size=26, fill=C["muted"], anchor="mm")
    base = text(base, fx + fw / 2, fy + fh / 2 + 24, "avatar · captions · PiP", kind="mono", size=24, fill=C["faint"], anchor="mm")
    # scan beam
    beamy = fy + 110
    base = glow_line(base, (fx + 8, beamy), (fx + fw - 8, beamy), C["cyan"], width=4, ga=200, glow_r=14)
    base, _, _ = chip(base, fx + fw - 150, fy + 14, "SCANNING", size=20, fg=C["cyan"], border=C["cyan"],
                      dot=C["cyan"], fill=(8, 16, 28), fa=220)

    # blocked -> passed
    cy = 740
    base = glass(base, 70, cy, 430, 320, r=20, fill=(60, 24, 34), fa=70, border=C["red"], ba=190, glow=C["red"])
    base, _, _ = chip(base, 96, cy + 22, "BLOCKED", size=26, fg=C["red"], border=C["red"], fill=(40, 12, 18), fa=230)
    base = text(base, 96, cy + 118, "✗ avatar crop", kind="mono", size=28, fill=C["red"], anchor="lm")
    base = text(base, 96, cy + 158, "  chin clipped 0.94", kind="mono", size=24, fill=(220, 150, 160), anchor="lm")
    base = text(base, 96, cy + 210, "✗ slide 2 ink 6%", kind="mono", size=28, fill=C["red"], anchor="lm")
    base = text(base, 96, cy + 250, "  < 12% minimum", kind="mono", size=24, fill=(220, 150, 160), anchor="lm")

    base = glow_line(base, (510, cy + 160), (566, cy + 160), C["cyan"], width=4, ga=150)
    ly = new_layer(); d = ImageDraw.Draw(ly); Sx = 2
    d.polygon([(566 * Sx, (cy + 160) * Sx), (552 * Sx, (cy + 148) * Sx), (552 * Sx, (cy + 172) * Sx)], fill=C["cyan"] + (255,))
    base = comp(base, ly)

    base = glass(base, 580, cy, 430, 320, r=20, fill=(20, 56, 36), fa=70, border=C["green"], ba=200, glow=C["green"])
    base, _, _ = chip(base, 606, cy + 22, "PASSED", size=26, fg=C["green"], border=C["green"], fill=(10, 36, 20), fa=230, dot=C["green"])
    for i, (k, v) in enumerate([("re-framed", "chest-up"), ("ink coverage", "38%"),
                                 ("fake-AI risk", "0.07"), ("brand score", "0.91")]):
        yy = cy + 110 + i * 50
        base = text(base, 606, yy, f"✓ {k}", kind="mono", size=26, fill=C["green"], anchor="lm")
        base = text(base, 980, yy, v, kind="monob", size=26, fill=C["ink"], anchor="rm")

    # checklist row
    checks = [("ink ≥ 12%", "38%"), ("face_box ≤ 0.90", "0.86"), ("fake-AI ≤ 0.15", "0.07"), ("brand ≥ 0.85", "0.91")]
    cxx, cyy, cw = 70, 1110, 226
    for i, (k, v) in enumerate(checks):
        x = cxx + i * (cw + 12)
        base = glass(base, x, cyy, cw, 130, r=16, fill=(20, 50, 34), fa=30, border=C["green"], ba=130)
        base = text(base, x + cw / 2, cyy + 44, v, kind="monob", size=34, fill=C["green"], anchor="mm", glow=C["green"], glow_r=8)
        base = text(base, x + cw / 2, cyy + 92, k, kind="mono", size=22, fill=C["muted"], anchor="mm")
    base = caption(base, ["blocked", "before", "telegram"], 0, y=1640)
    save(base, os.path.join(OUT, "D_qc.png"))

def frame_E():
    base = base_field(
        glows=[(560, 820, 620, C["cyan"], 0.34), (300, 1500, 460, C["green"], 0.2),
               (900, 360, 380, C["violet"], 0.34)],
        sweeps=[(118, 0.5, 90, 0.12)], particles=200)
    base = kicker(base, 80, 200, "COGNITIA REPUBLIC · EP 002")

    # delivery card (telegram-style)
    dx, dy, dw, dh = 180, 320, 720, 250
    base = glass(base, dx, dy, dw, dh, r=24, fill=(30, 70, 110), fa=40, border=C["cyan"], ba=150, glow=C["cyan"])
    base = icon_token(base, dx + 28, dy + 28, 96, "TG", C["cyan"])
    base = text(base, dx + 150, dy + 56, "Cognitia  ›  delivery", kind="bold", size=34, fill=C["ink"], anchor="lm")
    base = text(base, dx + 150, dy + 110, "ep002.mp4  ·  22.6 MB", kind="monob", size=32, fill=C["white"], anchor="lm")
    base = text(base, dx + 150, dy + 162, "1080×1920 · 60s · delivered 11:48", kind="mono", size=26, fill=C["muted"], anchor="lm")
    base = text(base, dx + dw - 40, dy + dh - 40, "✓✓", kind="monob", size=40, fill=C["green"], anchor="rm", glow=C["green"], glow_r=10)

    # CTA headline
    base = text(base, W / 2, 760, "Automated,", kind="bold", size=96, fill=C["white"], anchor="mm", shadow=True)
    base = text(base, W / 2, 880, "not unattended.", kind="bold", size=96, fill=(210, 248, 255), anchor="mm",
                glow=C["cyan"], glow_r=22, ga=200, shadow=True)
    base = text(base, W / 2, 1000, "That's the honest version.", kind="sans", size=42, fill=C["muted"], anchor="mm")

    cta = "Follow for run #42  →"
    tw, _ = measure(cta, "bold", 34)
    cw, ch = tw + 68, 76
    cx = (W - cw) / 2
    base = glass(base, cx, 1090, cw, ch, r=ch / 2, fill=C["cyan"], fa=255, border=C["cyan"], ba=255, glow=C["cyan"])
    base = text(base, W / 2, 1090 + ch / 2, cta, kind="bold", size=34, fill=C["base"], anchor="mm")

    base = avatar_bubble(base, 880, 1380, 120, label="operator")
    base = text(base, W / 2, 1560, "COGNITIA REPUBLIC", kind="bold", size=34, fill=C["white"], anchor="mm",
                glow=C["cyan"], glow_r=12, spacing=8)
    save(base, os.path.join(OUT, "E_result.png"))

FRAMES = {"A": frame_A, "B": frame_B, "C": frame_C, "D": frame_D, "E": frame_E}

if __name__ == "__main__":
    which = sys.argv[1:] or list(FRAMES)
    for k in which:
        FRAMES[k.upper()]()
