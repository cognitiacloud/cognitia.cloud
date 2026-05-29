#!/usr/bin/env python3
"""
Cognitia Republic — Episode 002 style frames (A–E).
Static 1080x1920 PNG comps for approval. NOT a render, NOT animated.
Rendered with Pillow at 2x supersample for crisp anti-aliasing.
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, S = 1080, 1920, 2
OUT = "."

# ---- palette (locked) ----
BG_TOP, BG_BOT = "#0C1426", "#05080F"
PANEL = "#0E1626"
PANEL2 = "#101D31"
PANEL_HI = "#16243B"
TERM_BG = "#080E1A"
HAIR = "#1B2942"
HAIR2 = "#243450"
CYAN = "#00E5FF"
CYAN_DK = "#0A95A8"
BLUE = "#58A6FF"
GREEN = "#22C55E"
AMBER = "#F2A24B"
RED = "#FF6B6B"
TEXT = "#EAF0F8"
MUTED = "#94A3B8"
FAINT = "#56657E"
GHOST = "#16263F"  # dim terminal scrollback

LSANS = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
LSANS_R = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
MONO = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
MONO_B = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"

M = 64  # outer safe margin


def hx(c):
    c = c.lstrip("#")
    return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))


class G:
    def __init__(self):
        self.im = Image.new("RGBA", (W * S, H * S), (*hx(BG_TOP), 255))
        self.d = ImageDraw.Draw(self.im)
        self._f = {}
        self._bg_gradient()

    def _bg_gradient(self):
        top, bot = hx(BG_TOP), hx(BG_BOT)
        grad = Image.new("RGB", (1, H), 0)
        for y in range(H):
            t = (y / (H - 1)) ** 1.05
            grad.putpixel((0, y), tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
        grad = grad.resize((W * S, H * S))
        self.im.paste(grad, (0, 0))

    def font(self, path, size):
        k = (path, size)
        if k not in self._f:
            self._f[k] = ImageFont.truetype(path, size * S)
        return self._f[k]

    # primitives (1x coords in, scaled internally)
    def rrect(self, x, y, w, h, r, fill=None, outline=None, ow=0):
        self.d.rounded_rectangle(
            [x * S, y * S, (x + w) * S - 1, (y + h) * S - 1], radius=r * S,
            fill=hx(fill) if fill else None,
            outline=hx(outline) if outline else None, width=ow * S)

    def rect(self, x, y, w, h, fill):
        self.d.rectangle([x * S, y * S, (x + w) * S - 1, (y + h) * S - 1], fill=hx(fill))

    def line(self, x0, y0, x1, y1, color, t=2):
        self.d.line([x0 * S, y0 * S, x1 * S, y1 * S], fill=hx(color), width=t * S)

    def dot(self, cx, cy, r, color):
        self.d.ellipse([(cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S], fill=hx(color))

    def ring(self, cx, cy, r, color, t=2):
        self.d.ellipse([(cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S],
                       outline=hx(color), width=t * S)

    def poly(self, pts, color):
        self.d.polygon([(x * S, y * S) for x, y in pts], fill=hx(color))

    def text(self, x, y, t, path, size, color, anchor="la"):
        self.d.text((x * S, y * S), t, font=self.font(path, size), fill=hx(color), anchor=anchor)

    def measure(self, t, path, size):
        return self.d.textlength(t, font=self.font(path, size)) / S

    def spaced(self, x, y, t, path, size, color, track):
        """left-anchored uppercase with letter spacing; returns end x."""
        f = self.font(path, size)
        cx = x
        for ch in t:
            self.d.text((cx * S, y * S), ch, font=f, fill=hx(color), anchor="la")
            cx += self.d.textlength(ch, font=f) / S + track
        return cx

    def glow(self, x, y, w, h, color, blur=40, alpha=70):
        ov = Image.new("RGBA", self.im.size, (0, 0, 0, 0))
        ImageDraw.Draw(ov).rounded_rectangle(
            [x * S, y * S, (x + w) * S, (y + h) * S], radius=24 * S,
            fill=(*hx(color), alpha))
        ov = ov.filter(ImageFilter.GaussianBlur(blur * S / 4))
        self.im = Image.alpha_composite(self.im, ov)
        self.d = ImageDraw.Draw(self.im)

    def grid(self, alpha=22, step=54):
        ov = Image.new("RGBA", self.im.size, (0, 0, 0, 0))
        dd = ImageDraw.Draw(ov)
        col = (*hx(CYAN), alpha)
        for gx in range(0, W + 1, step):
            dd.line([gx * S, 0, gx * S, H * S], fill=(*hx("#22324C"), alpha), width=1)
        for gy in range(0, H + 1, step):
            dd.line([0, gy * S, W * S, gy * S], fill=(*hx("#22324C"), alpha), width=1)
        self.im = Image.alpha_composite(self.im, ov)
        self.d = ImageDraw.Draw(self.im)

    def save(self, name):
        self.im.convert("RGB").resize((W, H), Image.LANCZOS).save(f"{OUT}/{name}")
        print("wrote", name)


# ---- shared building blocks ----
def kicker(g, x, y, text):
    g.dot(x + 4, y + 9, 4, CYAN)
    g.spaced(x + 18, y, text.upper(), LSANS, 24, CYAN, 3)


def chip(g, x, y, text, fg, border, fill=PANEL2, font=MONO, size=26, padx=18, h=46):
    w = g.measure(text, font, size) + padx * 2
    g.rrect(x, y, w, h, h // 2, fill=fill, outline=border, ow=2)
    g.text(x + padx, y + h / 2, text, font, size, fg, anchor="lm")
    return w


def avatar_pip(g, x, y, w, side_label="OPERATOR"):
    h = int(w * 1.28)
    g.glow(x - 6, y - 6, w + 12, h + 12, CYAN, blur=30, alpha=40)
    g.rrect(x, y, w, h, 22, fill=PANEL, outline=CYAN, ow=2)
    # simple chest-up silhouette (placeholder for HeyGen frame)
    cx = x + w // 2
    g.rrect(x + 6, y + 6, w - 12, h - 12, 18, fill="#0B1322")
    g.dot(cx, y + int(h * 0.42), int(w * 0.20), "#26354F")          # head
    g.rrect(cx - int(w * 0.30), y + int(h * 0.62), int(w * 0.60),
            int(h * 0.40), 26, fill="#26354F")                       # shoulders
    g.rect(x + 6, y + h - 46, w - 12, 40, PANEL)
    g.text(cx, y + h - 26, side_label + " · CHEST-UP", MONO, 18, MUTED, anchor="mm")


def panel(g, x, y, w, h, title=None, accent=HAIR2):
    g.rrect(x, y, w, h, 18, fill=PANEL, outline=accent, ow=2)
    if title:
        g.text(x + 24, y + 22, title, LSANS, 26, TEXT)
        g.line(x + 24, y + 60, x + w - 24, y + 60, HAIR, 1)


def arrow(g, x0, y0, x1, y1, color, t=3, head=12):
    import math
    g.line(x0, y0, x1, y1, color, t)
    ang = math.atan2(y1 - y0, x1 - x0)
    for da in (2.5, -2.5):
        hx_ = x1 - head * math.cos(ang + da)
        hy_ = y1 - head * math.sin(ang + da)
        g.line(x1, y1, hx_, hy_, color, t)


# =========================================================================
# FRAME A — HOOK
# =========================================================================
def frame_a():
    g = G()
    g.grid()
    # dim real terminal scrollback behind lower half
    lines = [
        "$ hermes run --episode 002 --vertical",
        "▸ loading pipeline: claude · 11labs · heygen · ffmpeg · qc · telegram",
        "▸ stage 01/06  claude        drafting script.md ...",
        "  ok  script.md            11.2s   1.4 kB",
        "▸ stage 02/06  elevenlabs    synthesizing vo.mp3 ...",
        "  ok  vo.mp3      00:58     6.0s    1.1 MB",
        "▸ stage 03/06  heygen        rendering avatar (chest-up) ...",
        "  ok  avatar.mp4            41.7s   18.3 MB",
        "▸ stage 04/06  ffmpeg        composite + burn captions ...",
    ]
    yy = 1020
    for ln in lines:
        while g.measure(ln, MONO, 26) > W - 2 * M and len(ln) > 4:
            ln = ln[:-2]
        g.text(M, yy, ln, MONO, 26, GHOST)
        yy += 50

    kicker(g, M, 196, "Cognitia Republic · EP 002")
    chip(g, W - M - 150, 184, "60s · 9:16", FAINT, HAIR2, size=24, h=44)

    g.text(M, 470, "I automated", LSANS, 92, TEXT)
    g.text(M, 470, "I ", LSANS, 92, TEXT)  # keep baseline
    # second + third lines
    g.text(M, 580, "my entire", LSANS, 92, TEXT)
    g.text(M, 690, "AI video pipeline.", LSANS, 92, TEXT)
    # cyan underline under "automated"
    aw = g.measure("I automated", LSANS, 92)
    g.rect(M + g.measure("I ", LSANS, 92), 672, aw - g.measure("I ", LSANS, 92), 6, CYAN)

    g.text(M, 826, "One prompt in. Finished video out.", LSANS_R, 40, MUTED)
    g.text(M, 878, "(In theory.)", LSANS_R, 40, BLUE)

    # annotation: arrow from headline to terminal + chip
    arrow(g, M + 60, 952, M + 60, 1006, CYAN, t=3, head=14)
    chip(g, M + 88, 960, "real run — not a mockup", CYAN, CYAN, fill="#07121C", size=24, h=44)

    avatar_pip(g, W - M - 300, 1180, 300)
    g.save("A_hook.png")


# =========================================================================
# FRAME B — PIPELINE / TOOL STACK
# =========================================================================
def frame_b():
    g = G()
    g.grid()
    kicker(g, M, 196, "The Engine")
    g.text(M, 246, "Six stages. One command.", LSANS, 60, TEXT)
    g.text(M, 322, "One gate that can say no.", LSANS, 60, CYAN)

    nodes = [
        ("01", "CLAUDE", "writes the script", "script.md", GREEN),
        ("02", "ELEVENLABS", "voices it", "vo.mp3", GREEN),
        ("03", "HEYGEN", "drives the avatar", "avatar.mp4", GREEN),
        ("04", "FFMPEG", "composites + captions", "compose.mp4", GREEN),
        ("05", "VISION QC", "gate — ships or blocks", "qc.json", AMBER),
        ("06", "TELEGRAM", "delivers the file", "sent ✓", BLUE),
    ]
    x, w = M, W - 2 * M - 150
    y = 440
    ch = 168
    gap = 24
    for i, (num, tool, fn, art, accent) in enumerate(nodes):
        border = AMBER if tool == "VISION QC" else HAIR2
        if tool == "VISION QC":
            g.glow(x, y, w, ch, AMBER, blur=26, alpha=34)
        panel(g, x, y, w, ch, accent=border)
        g.text(x + 28, y + 30, num, MONO_B, 44, FAINT)
        g.text(x + 120, y + 26, tool, LSANS, 44, CYAN if accent != AMBER else AMBER)
        g.text(x + 120, y + 92, fn, LSANS_R, 32, MUTED)
        # artifact tag on right
        tagw = g.measure(art, MONO, 26) + 32
        g.rrect(x + w - tagw - 28, y + ch / 2 - 24, tagw, 48, 12,
                fill=PANEL2, outline=HAIR2, ow=2)
        g.text(x + w - tagw - 12, y + ch / 2, art, MONO, 26,
               GREEN if accent == GREEN else (AMBER if accent == AMBER else BLUE), anchor="lm")
        g.dot(x + 28, y + ch - 40, 7, accent)
        # connector
        if i < len(nodes) - 1:
            cxp = x + 70
            g.line(cxp, y + ch, cxp, y + ch + gap, HAIR2, 3)
            g.poly([(cxp - 8, y + ch + gap - 8), (cxp + 8, y + ch + gap - 8),
                    (cxp, y + ch + gap + 2)], HAIR2)
        y += ch + gap

    # right brackets
    bx = W - M - 132
    g.line(bx, 440, bx, 440 + 4 * (ch + gap) - gap, CYAN, 3)
    g.line(bx, 440, bx + 14, 440, CYAN, 3)
    g.line(bx, 440 + 4 * (ch + gap) - gap, bx + 14, 440 + 4 * (ch + gap) - gap, CYAN, 3)
    g.text(bx + 26, 440 + (4 * (ch + gap) - gap) / 2, "GENERATE", MONO, 24, CYAN, anchor="lm")
    y2 = 440 + 4 * (ch + gap)
    g.line(bx, y2, bx, y2 + 2 * ch + gap, BLUE, 3)
    g.line(bx, y2, bx + 14, y2, BLUE, 3)
    g.line(bx, y2 + 2 * ch + gap, bx + 14, y2 + 2 * ch + gap, BLUE, 3)
    g.text(bx + 26, y2 + (2 * ch + gap) / 2, "GATE +", MONO, 24, BLUE, anchor="lm")
    g.text(bx + 26, y2 + (2 * ch + gap) / 2 + 30, "DELIVER", MONO, 24, BLUE, anchor="lm")

    chip(g, M, 1700, "~78s end-to-end", CYAN, CYAN, fill="#07121C")
    chip(g, M + 320, 1700, "1 command", MUTED, HAIR2)
    g.text(M, 1786, "one command · six stages · one gate", MONO, 28, FAINT)
    g.save("B_pipeline.png")


# =========================================================================
# FRAME C — TERMINAL / BUILD PROOF
# =========================================================================
def frame_c():
    g = G()
    g.grid()
    kicker(g, M, 196, "Run #41 · Live Log")
    g.text(M, 244, "This actually ran.", LSANS, 60, TEXT)

    # terminal window
    tx, ty, tw, th = M, 360, W - 2 * M, 720
    g.glow(tx, ty, tw, th, CYAN, blur=30, alpha=26)
    g.rrect(tx, ty, tw, th, 16, fill=TERM_BG, outline=HAIR2, ow=2)
    g.rect(tx + 2, ty + 2, tw - 4, 56, PANEL)
    for i, c in enumerate((RED, AMBER, GREEN)):
        g.dot(tx + 34 + i * 30, ty + 30, 8, c)
    g.text(tx + tw / 2, ty + 30, "hermes@cognitia: ~/ep002", MONO, 26, MUTED, anchor="mm")
    rows = [
        ("$", "hermes run --episode 002", TEXT),
        ("▸", "stage 01  claude      drafting script.md", BLUE),
        ("ok", "claude      script.md            11.2s   1.4 kB", GREEN),
        ("▸", "stage 02  elevenlabs  synth vo.mp3", BLUE),
        ("ok", "11labs      vo.mp3      00:58     6.0s   1.1 MB", GREEN),
        ("▸", "stage 03  heygen      avatar (chest-up)", BLUE),
        ("ok", "heygen      avatar.mp4  safe-crop 41.7s  18.3 MB", GREEN),
        ("▸", "stage 04  ffmpeg      composite + captions", BLUE),
        ("ok", "ffmpeg      compose.mp4 1 pass   9.4s   22.6 MB", GREEN),
        ("✓", "manifest -> run41/manifest.json", CYAN),
    ]
    ry = ty + 92
    for mark, txt, col in rows:
        mc = {"$": MUTED, "▸": BLUE, "ok": GREEN, "✓": CYAN}.get(mark, TEXT)
        g.text(tx + 30, ry, "✓" if mark == "ok" else mark, MONO_B, 28, mc)
        g.text(tx + 86, ry, txt, MONO, 28, col)
        ry += 60
    # highlight box around compose line
    g.rrect(tx + 78, ty + 92 + 8 * 60 - 6, tw - 104, 52, 8, outline=CYAN, ow=2)
    arrow(g, tx + tw - 60, ty + 92 + 8 * 60 + 20, tx + tw - 60, ty + th + 24, CYAN, t=3, head=12)

    # manifest panel
    mx, my, mw, mh = M, 1140, (W - 2 * M - 24) // 2, 520
    panel(g, mx, my, mw, mh, "manifest", accent=HAIR2)
    tree = [
        ("run41/", FAINT),
        (" ├─ script.md        1.4 kB", TEXT),
        (" ├─ vo.mp3           1.1 MB", TEXT),
        (" ├─ avatar.mp4      18.3 MB", TEXT),
        (" ├─ compose.mp4     22.6 MB", CYAN),
        (" └─ manifest.json    0.9 kB", TEXT),
    ]
    yy = my + 92
    for t, c in tree:
        g.text(mx + 28, yy, t, MONO, 28, c)
        yy += 56
    g.dot(mx + 28, my + mh - 56, 6, GREEN)
    g.text(mx + 48, my + mh - 70, "5 artifacts written", MONO, 24, MUTED)

    # metrics panel
    qx = mx + mw + 24
    panel(g, qx, my, mw, mh, "build metrics", accent=HAIR2)
    metrics = [("78.3s", "total build", GREEN), ("4 / 4", "stages ok", GREEN),
               ("0", "retries", CYAN), ("22.6 MB", "output", TEXT)]
    yy = my + 96
    for big, lab, c in metrics:
        g.text(qx + 28, yy, big, LSANS, 48, c)
        g.text(qx + 28 + g.measure(big, LSANS, 48) + 18, yy + 18, lab, LSANS_R, 28, MUTED)
        yy += 100
    g.save("C_terminal.png")


# =========================================================================
# FRAME D — QC / PASS-FAIL GATE
# =========================================================================
def frame_d():
    g = G()
    g.grid()
    kicker(g, M, 196, "Vision QC · Gate")
    g.text(M, 244, "It blocks before it ships.", LSANS, 56, TEXT)

    # JSON panel (left)
    jx, jy, jw, jh = M, 360, (W - 2 * M - 24) * 0.52, 560
    jw = int(jw)
    panel(g, jx, jy, jw, jh, "vision_skill → qc.json", accent=HAIR2)
    json_rows = [
        ('{', TEXT, None),
        ('  "brand_score":', TEXT, ("0.91", GREEN)),
        ('  "fake_ai_risk":', TEXT, ("0.07", GREEN)),
        ('  "face_box":', TEXT, ("0.86", GREEN)),
        ('  "ink_coverage":', TEXT, ("0.41", GREEN)),
        ('  "privacy":', TEXT, ('"clean"', GREEN)),
        ('  "verdict":', TEXT, ('"PASS"', CYAN)),
        ('}', TEXT, None),
    ]
    yy = jy + 96
    for left, lc, val in json_rows:
        g.text(jx + 28, yy, left, MONO, 30, lc if val is None else BLUE)
        if val:
            g.text(jx + 28 + g.measure(left + " ", MONO, 30), yy, val[0], MONO, 30, val[1])
        yy += 58

    # gate checklist (right)
    cx, cy, cw, chh = jx + jw + 24, 360, W - M - (jx + jw + 24), 560
    panel(g, cx, cy, cw, chh, "ship gates", accent=HAIR2)
    gates = [
        ("brand ≥ 0.85", "0.91", True),
        ("fake-AI ≤ 0.15", "0.07", True),
        ("avatar crop ≤ 0.90", "0.86", True),
        ("ink ≥ 0.12", "0.41", True),
        ("privacy scan", "clean", True),
        ("no watermark", "ok", True),
    ]
    yy = cy + 96
    for lab, val, ok in gates:
        g.dot(cx + 36, yy + 14, 12, GREEN if ok else RED)
        g.text(cx + 36, yy + 8, "✓" if ok else "✗", MONO_B, 22, "#05080F", anchor="mm")
        g.text(cx + 66, yy, lab, LSANS_R, 30, TEXT)
        g.text(cx + cw - 28, yy, val, MONO, 30, GREEN if ok else RED, anchor="ra")
        yy += 70

    # first-pass BLOCKED -> fix -> PASSED loop
    fy = 980
    fpw = int((W - 2 * M - 24) * 0.52)
    g.rrect(M, fy, fpw, 230, 16, fill=PANEL, outline=AMBER, ow=2)
    g.text(M + 24, fy + 22, "1st pass · BLOCKED", LSANS, 30, AMBER)
    g.text(M + 24, fy + 78, "✗ avatar chin clipped  (0.94)", MONO, 26, RED)
    g.text(M + 24, fy + 122, "✗ slide 2 empty  (ink 6%)", MONO, 26, RED)
    g.text(M + 24, fy + 172, "→ re-frame · rebuild · recheck", MONO, 24, MUTED)

    arrow(g, M + fpw + 14, fy + 115, M + fpw + 60, fy + 115, CYAN, t=4, head=16)

    # PASSED stamp
    px = M + fpw + 80
    pw = W - M - px
    g.glow(px, fy, pw, 230, GREEN, blur=30, alpha=40)
    g.rrect(px, fy, pw, 230, 16, fill="#0A1A12", outline=GREEN, ow=3)
    g.ring(px + pw / 2, fy + 86, 40, GREEN, 5)
    g.line(px + pw / 2 - 18, fy + 86, px + pw / 2 - 4, fy + 102, GREEN, 6)
    g.line(px + pw / 2 - 4, fy + 102, px + pw / 2 + 22, fy + 68, GREEN, 6)
    g.text(px + pw / 2, fy + 168, "PASSED", LSANS, 46, GREEN, anchor="ma")

    # contact sheet strip
    sy = 1290
    g.text(M, sy, "QC ran on every frame — contact sheet", MONO, 26, MUTED)
    tw = (W - 2 * M - 5 * 18) // 6
    thh = int(tw * 1.5)
    labels = ["S1", "S2", "S3", "S4", "S5", "S6"]
    for i in range(6):
        x = M + i * (tw + 18)
        g.rrect(x, sy + 46, tw, thh, 12, fill=PANEL2, outline=HAIR2, ow=2)
        g.rect(x + 10, sy + 60, tw - 20, 20, "#1A2C46")
        g.rect(x + 10, sy + 90, tw - 30, 12, "#16263F")
        g.dot(x + tw - 22, sy + 46 + thh - 22, 9, GREEN)
        g.text(x + 12, sy + 46 + thh - 34, labels[i], MONO, 22, MUTED)
    g.save("D_qc.png")


# =========================================================================
# FRAME E — RESULT / CTA
# =========================================================================
def frame_e():
    g = G()
    g.grid()
    kicker(g, M, 196, "Shipped · Run #41")

    # player mock (final vertical frame inside a player)
    pw, ph = 420, 740
    pxp, pyp = M, 320
    g.glow(pxp, pyp, pw, ph, CYAN, blur=34, alpha=34)
    g.rrect(pxp, pyp, pw, ph, 22, fill="#070D18", outline=CYAN, ow=2)
    # mini composed frame inside
    ix, iy, iw, ih = pxp + 16, pyp + 16, pw - 32, ph - 120
    g.rrect(ix, iy, iw, ih, 14, fill=PANEL)
    g.text(ix + 24, iy + 40, "EP 002", MONO, 22, CYAN)
    g.text(ix + 24, iy + 90, "what", LSANS, 52, TEXT)
    g.text(ix + 24, iy + 150, "actually", LSANS, 52, TEXT)
    g.text(ix + 24, iy + 210, "worked", LSANS, 52, CYAN)
    # mini caption
    g.rrect(ix + 24, iy + ih - 150, iw - 48, 64, 12, fill="#0B1626")
    g.text(ix + iw / 2, iy + ih - 118, "every artifact logged", LSANS, 28, TEXT, anchor="mm")
    # mini avatar pip
    g.rrect(ix + iw - 120, iy + ih - 230, 96, 120, 12, fill="#0B1322", outline=CYAN, ow=2)
    g.dot(ix + iw - 72, iy + ih - 188, 22, "#26354F")
    g.rrect(ix + iw - 108, iy + ih - 156, 72, 56, 14, fill="#26354F")
    # transport bar
    by = pyp + ph - 78
    g.dot(pxp + 44, by + 18, 18, CYAN)
    g.poly([(pxp + 38, by + 8), (pxp + 38, by + 28), (pxp + 54, by + 18)], "#05080F")
    g.line(pxp + 84, by + 18, pxp + pw - 120, by + 18, HAIR2, 4)
    g.line(pxp + 84, by + 18, pxp + 84 + int((pw - 204) * 0.78), by + 18, CYAN, 4)
    g.dot(pxp + 84 + int((pw - 204) * 0.78), by + 18, 8, CYAN)
    g.text(pxp + pw - 96, by + 18, "0:47/1:00", MONO, 22, MUTED, anchor="lm")

    # right column: delivery + metrics + CTA
    rx = pxp + pw + 48
    rw = W - M - rx
    # telegram delivery card
    g.rrect(rx, 330, rw, 200, 16, fill=PANEL, outline=HAIR2, ow=2)
    g.dot(rx + 40, 372, 18, BLUE)
    g.text(rx + 40, 372, "✈", LSANS, 22, "#05080F", anchor="mm")
    g.text(rx + 74, 354, "Telegram · Cognitia Republic", LSANS, 28, TEXT)
    g.text(rx + 74, 396, "delivered automatically", LSANS_R, 24, MUTED)
    g.rrect(rx + 24, 440, rw - 48, 64, 12, fill=PANEL2)
    g.text(rx + 40, 472, "ep002.mp4", MONO, 28, TEXT, anchor="lm")
    g.text(rx + rw - 40, 472, "22.6 MB  ✓", MONO, 26, GREEN, anchor="rm")

    # metric chips
    chip(g, rx, 556, "1080×1920 · 30fps", TEXT, HAIR2, size=24, h=52)
    chip(g, rx, 624, "60s · 22.6 MB", TEXT, HAIR2, size=24, h=52)
    chip(g, rx, 692, "QC: brand 0.91 · fake 0.07", GREEN, GREEN, fill="#0A1A12", size=24, h=52)
    chip(g, rx, 760, "human review: 1 frame", AMBER, AMBER, fill="#1A140A", size=24, h=52)

    # headline + CTA bottom band
    g.text(M, 1180, "Automated,", LSANS, 84, TEXT)
    g.text(M, 1276, "not unattended.", LSANS, 84, CYAN)
    g.text(M, 1392, "That's the honest version.", LSANS_R, 40, MUTED)

    g.rrect(M, 1480, 520, 96, 48, fill="#07121C", outline=CYAN, ow=2)
    g.text(M + 36, 1528, "Follow for run #42", LSANS, 38, CYAN, anchor="lm")
    arrow(g, M + 410, 1528, M + 470, 1528, CYAN, t=4, head=16)

    g.line(M, 1660, W - M, 1660, HAIR, 1)
    g.spaced(M, 1696, "COGNITIA REPUBLIC", LSANS, 34, TEXT, 6)
    g.text(W - M, 1700, "anti-hype · proof-first", MONO, 24, FAINT, anchor="ra")
    g.save("E_result.png")


if __name__ == "__main__":
    frame_a()
    frame_b()
    frame_c()
    frame_d()
    frame_e()
    print("done")
