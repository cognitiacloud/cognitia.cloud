# Cognitia Republic — DESIGN SYSTEM (Episode 002 rebuild)

Single source of visual truth. Code mirror lives in `remotion/src/tokens.ts`.
Aesthetic: **premium dark tech — operator's console, not guru promo.**

---

## 1. Color

Disciplined palette: one neutral ramp + one accent + two state colors. Off-palette color is a ship-blocker.

### Neutrals (the canvas)
| Token | Hex | Use |
|---|---|---|
| `bg.base` | `#0A0E14` | deepest background |
| `bg.raised` | `#0D1117` | gradient top / raised panels |
| `surface` | `#11161F` | cards, terminal body |
| `surface.alt` | `#161C26` | chips, secondary panels |
| `hairline` | `rgba(255,255,255,0.10)` | 1px borders, grid lines |
| `text.primary` | `#E6EDF3` | headlines, captions |
| `text.muted` | `#8B949E` | sub-text, labels |
| `text.faint` | `#566070` | dim terminal scrollback |

### Accent + states
| Token | Hex | Use |
|---|---|---|
| `accent` | `#58A6FF` | brand accent, active caption word, primary highlights |
| `accent.dim` | `#1F6FEB` | edges, underlines, secondary accent |
| `state.pass` | `#3FB950` | success / "worked" / passed QC |
| `state.warn` | `#F0883E` | failure / "didn't yet" / blocked QC |

Rules:
- Background is a vertical gradient `bg.raised → bg.base`, never flat black (flat black = the v1 sparse-slide look).
- Exactly **one** accent (`#58A6FF`). Green/amber are reserved for pass/fail semantics only — never decoration.
- No gradients on text. No neon glows. No emoji color.

---

## 2. Typography

| Role | Family | Weight | Size (px @1080w) | Tracking | Case |
|---|---|---|---|---|---|
| Headline | Inter / Geist | 800 | 96–120 | −0.02em | Sentence |
| Sub-headline | Inter / Geist | 600 | 48 | −0.01em | Sentence |
| Kicker / eyebrow | Inter / Geist | 700 | 30 | 0.18em | UPPERCASE |
| Caption | Inter / Geist | 700 | 58 | −0.01em | Sentence |
| Body / labels | Inter / Geist | 500 | 36 | 0 | Sentence |
| Terminal / data | JetBrains Mono / Geist Mono | 500 | 34 | 0 | as-is |

- Two families only: one grotesk (UI/headline), one mono (data/terminal). The mono family is what signals "real engine."
- Line-height: 1.05 headlines, 1.15 captions/body, 1.4 terminal.
- ALL-CAPS is allowed ONLY for kickers and the wordmark. Headlines/captions stay sentence-case (no shouting = anti-hype).

---

## 3. Spacing & layout

- **Base unit:** 8px. All spacing is a multiple (8 / 16 / 24 / 32 / 48 / 64 / 96).
- **Outer safe margin:** 64px left/right (see §7 safe zones).
- **Grid:** 6-column logical grid for content blocks; gutters 24px.
- **Card radius:** 24px (large), 16px (chips), 12px (terminal). Border 1px `hairline`.
- **Shadows:** `0 20px 60px rgba(0,0,0,0.55)` for floating cards (PiP, stamps). One shadow recipe only.
- **Density floor:** every scene composes ≥3 layers — `Backdrop` grid + a structural element + a foreground proof element. Prevents the v1 empty-slide failure.

---

## 4. Caption style

Mandatory (sound-off viewing); part of the brand.

- **Position:** baseline at **78% of height**, always above the PiP card and inside the 64px safe margin.
- **Layout:** max **4 words/line**, max **2 lines**, phrase-chunked (not a rolling transcript).
- **Type:** Caption role above — Inter/Geist 700, ~58px, sentence-case.
- **Karaoke highlight:** active spoken word → `accent`; past words → `text.primary`; upcoming words → 55% opacity. Drives the eye, no bounce.
- **Backing:** NO solid box. Soft radial scrim `rgba(7,10,15,0)→rgba(7,10,15,0.7)` behind the text band only.
- **Timing:** word timings from `assets/run41/captions.json`; min 9 frames per chunk; no flashing chunks.
- **State tint:** in S5, active word may tint `state.warn`/`state.pass` to match on-screen status.
- **Never:** emoji, ALL-CAPS captions, hyphenation across lines, heavy black bar.

---

## 5. PiP / avatar rules

The avatar is presence, not the canvas. Directly fixes the v1 crop failure.

1. **Never full-screen.** HeyGen avatar appears ONLY inside the `AvatarPiP` card. Max footprint **28%** frame-width (corner) / **40%** (S6 to-camera). Never bleeds to an edge.
2. **Framing:** chest-up; 8–12% head-room above the crown, cut at mid-chest. QC rejects any frame with detected `face_box` height ratio > 0.90.
3. **Card:** 24px radius, 1px `hairline` border, shadow `0 20px 60px rgba(0,0,0,0.55)`, subtle inner vignette. Reads as a device, not a sticker.
4. **Placement:** bottom-right default; **bottom-left in S5** (so it never covers failing QC lines). 64px from any edge; always above the caption band.
5. **Presence map:** ON in S1, S2, S6, S7 (speaking *to* you). OFF in S3, S4, S5-beat-A (looking *at* the engine). Returns in S5-beat-B as the human signing off the fix.
6. **Audio:** VO is one continuous ElevenLabs master regardless of PiP visibility; the avatar video is muted in composition.
7. **Never:** emoji, lower-third name-tag, fake "LIVE" badge, watermark.

---

## 6. Logo / wordmark placement

- **Wordmark** (`COGNITIA REPUBLIC`): appears only in **S1 kicker** and **S7 lockup**. Not persistent — a persistent logo bug reads as a watermark, which we forbid.
- Wordmark color `text.primary`; in S7 it tracks-in (0.3em→0.08em letter-spacing).
- No corner logo on B-roll/proof scenes (S3–S5). Brand is carried by palette + type, not a stamp.
- Tool logos (Claude/ElevenLabs/HeyGen/FFmpeg/Telegram) appear ONLY in `PipelineScene`, mono, recolored to `text.muted`/`accent`. They are content, not sponsorship.

---

## 7. Safe zones (vertical Shorts: 1080×1920)

Designed against YouTube Shorts / Reels / TikTok UI overlap.

| Zone | Reserve | Reason |
|---|---|---|
| Top | 220px | status bar + "Shorts" / sound chip |
| Bottom | 480px | caption/handle, like/share rail, CTA |
| Right | 160px | engagement action rail (like/comment/share/avatar) |
| Left | 64px | standard margin |

- **Title-safe band:** keep headlines/kickers between **y=220** and **y=1440**.
- **Caption baseline (78% ≈ y=1498)** sits above the bottom UI but is itself inside the action-rail clearance — keep caption text within the left 64px → (1080−160) right bound.
- **PiP card:** bottom corner but inside both the 480px bottom reserve clearance and 160px right reserve → effectively pin to ~y=980–1300, x within left/right safe bounds; never under the action rail.
- First and last frame must be screenshot-worthy with NO UI overlapping key content (thumbnail test).
