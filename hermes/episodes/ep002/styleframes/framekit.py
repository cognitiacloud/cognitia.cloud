"""
framekit.py — tiny offline 2D renderer for Cognitia style frames.

No third-party deps. Uses libfreetype (via ctypes) to rasterize the real
system TTFs, composites into an RGB framebuffer, and encodes PNG with stdlib
zlib. Built because the sandbox has no network (no Pillow/cairo/rsvg).
"""
import ctypes as C
import math
import struct
import zlib

_FT = "/usr/lib/x86_64-linux-gnu/libfreetype.so.6"

# ---- FreeType struct definitions (x86-64, modern FreeType 2.10+) ----------
FT_Pos = C.c_long


class FT_Generic(C.Structure):
    _fields_ = [("data", C.c_void_p), ("finalizer", C.c_void_p)]


class FT_BBox(C.Structure):
    _fields_ = [("xMin", C.c_long), ("yMin", C.c_long),
                ("xMax", C.c_long), ("yMax", C.c_long)]


class FT_Vector(C.Structure):
    _fields_ = [("x", C.c_long), ("y", C.c_long)]


class FT_Glyph_Metrics(C.Structure):
    _fields_ = [(n, C.c_long) for n in (
        "width", "height", "horiBearingX", "horiBearingY", "horiAdvance",
        "vertBearingX", "vertBearingY", "vertAdvance")]


class FT_Bitmap(C.Structure):
    _fields_ = [("rows", C.c_uint), ("width", C.c_uint), ("pitch", C.c_int),
                ("buffer", C.POINTER(C.c_ubyte)), ("num_grays", C.c_ushort),
                ("pixel_mode", C.c_ubyte), ("palette_mode", C.c_ubyte),
                ("palette", C.c_void_p)]


class FT_GlyphSlotRec(C.Structure):
    _fields_ = [
        ("library", C.c_void_p), ("face", C.c_void_p), ("next", C.c_void_p),
        ("glyph_index", C.c_uint), ("generic", FT_Generic),
        ("metrics", FT_Glyph_Metrics),
        ("linearHoriAdvance", C.c_long), ("linearVertAdvance", C.c_long),
        ("advance", FT_Vector), ("format", C.c_uint),
        ("bitmap", FT_Bitmap), ("bitmap_left", C.c_int), ("bitmap_top", C.c_int),
    ]


class FT_FaceRec(C.Structure):
    _fields_ = [
        ("num_faces", C.c_long), ("face_index", C.c_long),
        ("face_flags", C.c_long), ("style_flags", C.c_long),
        ("num_glyphs", C.c_long), ("family_name", C.c_char_p),
        ("style_name", C.c_char_p), ("num_fixed_sizes", C.c_int),
        ("available_sizes", C.c_void_p), ("num_charmaps", C.c_int),
        ("charmaps", C.c_void_p), ("generic", FT_Generic), ("bbox", FT_BBox),
        ("units_per_EM", C.c_ushort), ("ascender", C.c_short),
        ("descender", C.c_short), ("height", C.c_short),
        ("max_advance_width", C.c_short), ("max_advance_height", C.c_short),
        ("underline_position", C.c_short), ("underline_thickness", C.c_short),
        ("glyph", C.POINTER(FT_GlyphSlotRec)), ("size", C.c_void_p),
        ("charmap", C.c_void_p),
    ]


FT_LOAD_RENDER = 0x4

_lib = C.CDLL(_FT)
_lib.FT_Init_FreeType.argtypes = [C.POINTER(C.c_void_p)]
_lib.FT_New_Face.argtypes = [C.c_void_p, C.c_char_p, C.c_long, C.POINTER(C.c_void_p)]
_lib.FT_Set_Pixel_Sizes.argtypes = [C.c_void_p, C.c_uint, C.c_uint]
_lib.FT_Load_Char.argtypes = [C.c_void_p, C.c_ulong, C.c_int]

_FTLIB = C.c_void_p()
if _lib.FT_Init_FreeType(C.byref(_FTLIB)) != 0:
    raise RuntimeError("FT_Init_FreeType failed")

_FACE_CACHE = {}


def _face(path):
    if path not in _FACE_CACHE:
        h = C.c_void_p()
        if _lib.FT_New_Face(_FTLIB, path.encode(), 0, C.byref(h)) != 0:
            raise RuntimeError("FT_New_Face failed: " + path)
        _FACE_CACHE[path] = h
    return _FACE_CACHE[path]


def hx(c):
    """'#RRGGBB' -> (r,g,b)."""
    c = c.lstrip("#")
    return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16))


class Canvas:
    def __init__(self, w, h, bg=(7, 11, 20)):
        self.w, self.h = w, h
        self.buf = bytearray(bg * (w * h))

    # ---- low level ----
    def _blend(self, x, y, color, a):
        if a <= 0 or x < 0 or y < 0 or x >= self.w or y >= self.h:
            return
        i = (y * self.w + x) * 3
        b = self.buf
        if a >= 1.0:
            b[i], b[i + 1], b[i + 2] = color
            return
        ia = 1.0 - a
        b[i] = int(b[i] * ia + color[0] * a)
        b[i + 1] = int(b[i + 1] * ia + color[1] * a)
        b[i + 2] = int(b[i + 2] * ia + color[2] * a)

    def fill(self, x, y, w, h, color, a=1.0):
        x0, y0 = max(0, x), max(0, y)
        x1, y1 = min(self.w, x + w), min(self.h, y + h)
        if x1 <= x0 or y1 <= y0:
            return
        if a >= 1.0:
            row = bytes(color) * (x1 - x0)
            for yy in range(y0, y1):
                o = (yy * self.w + x0) * 3
                self.buf[o:o + len(row)] = row
        else:
            for yy in range(y0, y1):
                for xx in range(x0, x1):
                    self._blend(xx, yy, color, a)

    def vgradient(self, top, bottom):
        for y in range(self.h):
            t = y / (self.h - 1)
            col = (int(top[0] + (bottom[0] - top[0]) * t),
                   int(top[1] + (bottom[1] - top[1]) * t),
                   int(top[2] + (bottom[2] - top[2]) * t))
            row = bytes(col) * self.w
            o = y * self.w * 3
            self.buf[o:o + len(row)] = row

    def _rr_spans(self, x, y, w, h, r):
        """yield (row_y, x_start, x_end) spans for a rounded rect."""
        r = min(r, w // 2, h // 2)
        for yy in range(y, y + h):
            dy = 0
            if yy < y + r:
                dy = r - (yy - y) - 1
            elif yy >= y + h - r:
                dy = (yy - (y + h - r))
            if dy > 0:
                inset = r - int(round(math.sqrt(max(0, r * r - (r - dy) * (r - dy)))))
            else:
                inset = 0
            yield yy, x + inset, x + w - inset

    def round_rect(self, x, y, w, h, r, fill=None, border=None, bw=2):
        if border is not None:
            for yy, xs, xe in self._rr_spans(x, y, w, h, r):
                self.fill(xs, yy, xe - xs, 1, border)
            ix, iy, iw, ih = x + bw, y + bw, w - 2 * bw, h - 2 * bw
            if fill is not None and iw > 0 and ih > 0:
                for yy, xs, xe in self._rr_spans(ix, iy, iw, ih, max(0, r - bw)):
                    self.fill(xs, yy, xe - xs, 1, fill)
        elif fill is not None:
            for yy, xs, xe in self._rr_spans(x, y, w, h, r):
                self.fill(xs, yy, xe - xs, 1, fill)

    def hline(self, x, y, w, color, a=1.0, t=1):
        self.fill(x, y, w, t, color, a)

    def vline(self, x, y, h, color, a=1.0, t=1):
        self.fill(x, y, t, h, color, a)

    def circle(self, cx, cy, r, color, a=1.0):
        for yy in range(cy - r, cy + r + 1):
            for xx in range(cx - r, cx + r + 1):
                d = math.hypot(xx - cx, yy - cy)
                if d <= r:
                    self._blend(xx, yy, color, a * min(1.0, r - d + 0.5))

    def line(self, x0, y0, x1, y1, color, t=2, a=1.0):
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for i in range(n + 1):
            xx = x0 + (x1 - x0) * i / n
            yy = y0 + (y1 - y0) * i / n
            self.fill(int(xx) - t // 2, int(yy) - t // 2, t, t, color, a)

    def tri(self, pts, color, a=1.0):
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        for yy in range(int(min(ys)), int(max(ys)) + 1):
            xints = []
            for i in range(3):
                x1, y1 = pts[i]
                x2, y2 = pts[(i + 1) % 3]
                if (y1 <= yy < y2) or (y2 <= yy < y1):
                    xints.append(x1 + (x2 - x1) * (yy - y1) / (y2 - y1))
            if len(xints) >= 2:
                xa, xb = int(min(xints)), int(max(xints))
                self.fill(xa, yy, xb - xa + 1, 1, color, a)

    # ---- text ----
    def _glyph(self, face_h, ch, size):
        _lib.FT_Set_Pixel_Sizes(face_h, 0, size)
        if _lib.FT_Load_Char(face_h, ord(ch), FT_LOAD_RENDER) != 0:
            return None
        rec = C.cast(face_h, C.POINTER(FT_FaceRec)).contents
        slot = rec.glyph.contents
        bm = slot.bitmap
        rows, width, pitch = bm.rows, bm.width, bm.pitch
        data = b""
        if rows and width:
            n = abs(pitch) * rows
            data = bytes(C.cast(bm.buffer, C.POINTER(C.c_ubyte * n)).contents)
        return {
            "w": width, "rows": rows, "pitch": pitch, "data": data,
            "left": slot.bitmap_left, "top": slot.bitmap_top,
            "adv": slot.advance.x / 64.0,
        }

    def measure(self, text, font, size):
        face_h = _face(font)
        total = 0.0
        for ch in text:
            g = self._glyph(face_h, ch, size)
            if g:
                total += g["adv"]
        return int(round(total))

    def text(self, x, y, text, font, size, color, align="left", a=1.0, ls=0):
        """y is the baseline. ls = extra letter spacing px."""
        if align != "left":
            wpx = self.measure(text, font, size) + ls * max(0, len(text) - 1)
            x = x - wpx if align == "right" else x - wpx // 2
        face_h = _face(font)
        pen = float(x)
        for ch in text:
            g = self._glyph(face_h, ch, size)
            if not g:
                continue
            if g["data"]:
                gx = int(round(pen)) + g["left"]
                gy = y - g["top"]
                pitch, w = g["pitch"], g["w"]
                d = g["data"]
                for ry in range(g["rows"]):
                    base = ry * pitch
                    for rx in range(w):
                        v = d[base + rx]
                        if v:
                            self._blend(gx + rx, gy + ry, color, (v / 255.0) * a)
            pen += g["adv"] + ls
        return int(round(pen))

    def save(self, path):
        w, h = self.w, self.h
        stride = w * 3
        raw = bytearray()
        mv = memoryview(self.buf)
        for y in range(h):
            raw.append(0)
            raw += mv[y * stride:(y + 1) * stride]
        comp = zlib.compress(bytes(raw), 6)

        def chunk(typ, data):
            return (struct.pack(">I", len(data)) + typ + data
                    + struct.pack(">I", zlib.crc32(typ + data) & 0xffffffff))

        with open(path, "wb") as f:
            f.write(b"\x89PNG\r\n\x1a\n")
            f.write(chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)))
            f.write(chunk(b"IDAT", comp))
            f.write(chunk(b"IEND", b""))
