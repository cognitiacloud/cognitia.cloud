#!/usr/bin/env python3
"""Generate synthetic test images for the Hermes vision skill.

Run from the test_assets/ directory:
    python3 generate_test_assets.py

This produces:
  portrait.jpg         -- simple synthetic portrait (gradient + circular face)
  screenshot.jpg       -- screenshot-like image with readable text, no secrets
  screenshot_secret.jpg-- screenshot with a fake email + fake API key + path
  ref1.jpg, ref2.jpg   -- two more synthetic portraits for compare tests
  candidate.jpg        -- candidate portrait for compare tests

Synthetic, no real people, no real secrets — the "API key" is a pattern-only
string for regex testing.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


HERE = Path(__file__).resolve().parent


def _font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for candidate in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/Library/Fonts/Arial.ttf",
    ):
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def _portrait(path: Path, face_color: tuple[int, int, int], bg: tuple[int, int, int]) -> None:
    img = Image.new("RGB", (512, 640), bg)
    d = ImageDraw.Draw(img)
    for y in range(640):
        shade = int(bg[0] * (1 - y / 1280) + 20)
        d.line([(0, y), (512, y)], fill=(shade, shade, shade + 10))
    d.ellipse((156, 100, 356, 300), fill=face_color, outline=(0, 0, 0), width=3)
    d.ellipse((200, 170, 240, 210), fill=(0, 0, 0))
    d.ellipse((272, 170, 312, 210), fill=(0, 0, 0))
    d.arc((216, 220, 296, 280), 0, 180, fill=(0, 0, 0), width=4)
    d.rectangle((176, 300, 336, 600), fill=(40, 40, 80))
    img.save(path, "JPEG", quality=85)


def _screenshot_clean(path: Path) -> None:
    img = Image.new("RGB", (900, 600), (245, 245, 248))
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, 900, 60), fill=(30, 30, 40))
    d.text((20, 18), "Cognitia Studio  |  Episode planner", fill=(255, 255, 255), font=_font(22))
    d.text((40, 100), "Welcome back, creator.", fill=(20, 20, 30), font=_font(28))
    d.text((40, 160), "Next episode: 002 - Hermes Vision Funnel", fill=(40, 40, 50), font=_font(22))
    d.text((40, 220), "Status: ready to render", fill=(20, 80, 20), font=_font(20))
    d.text((40, 260), "Render target: 9:16, 1080x1920, 30fps", fill=(60, 60, 80), font=_font(20))
    d.text((40, 320), "No private information visible on this screen.", fill=(60, 60, 80), font=_font(20))
    img.save(path, "JPEG", quality=85)


def _screenshot_secret(path: Path) -> None:
    img = Image.new("RGB", (900, 600), (250, 250, 252))
    d = ImageDraw.Draw(img)
    d.rectangle((0, 0, 900, 60), fill=(30, 30, 40))
    d.text((20, 18), "Local terminal -- DO NOT POST", fill=(255, 230, 230), font=_font(22))
    d.text((40, 100), "email: jane.doe@example.com", fill=(20, 20, 30), font=_font(22))
    d.text((40, 140), "phone: +1 555 123 4567", fill=(20, 20, 30), font=_font(22))
    d.text((40, 180), "API_KEY=sk-TESTONLYxxxxxxxxxxxxxxxxxxxxxxxxxx", fill=(120, 0, 0), font=_font(22))
    d.text((40, 220), "JWT eyJabcdefghijk.lmnopqrstuv.wxyz0123456", fill=(120, 0, 0), font=_font(22))
    d.text((40, 260), "/home/jane/projects/secret-leak/notes.md", fill=(0, 0, 120), font=_font(22))
    d.text((40, 300), "card 4242 4242 4242 4242  exp 12/29", fill=(120, 0, 0), font=_font(22))
    d.text((40, 340), "@janedoe_handle  ghp_TESTONLYabcdefghijklmnop123456", fill=(120, 0, 0), font=_font(22))
    img.save(path, "JPEG", quality=85)


def main() -> None:
    HERE.mkdir(parents=True, exist_ok=True)
    _portrait(HERE / "portrait.jpg", face_color=(245, 215, 180), bg=(60, 60, 90))
    _portrait(HERE / "ref1.jpg",     face_color=(245, 215, 180), bg=(70, 70, 110))
    _portrait(HERE / "ref2.jpg",     face_color=(240, 210, 175), bg=(80, 80, 120))
    _portrait(HERE / "candidate.jpg",face_color=(244, 213, 178), bg=(75, 75, 115))
    _screenshot_clean(HERE / "screenshot.jpg")
    _screenshot_secret(HERE / "screenshot_secret.jpg")
    for name in ("portrait.jpg", "ref1.jpg", "ref2.jpg", "candidate.jpg",
                 "screenshot.jpg", "screenshot_secret.jpg"):
        p = HERE / name
        print(f"wrote {p} ({p.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
