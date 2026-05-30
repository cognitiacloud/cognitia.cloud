# Episode 002 — Reference Analysis

> **STATUS: AWAITING INPUTS — analysis not yet performed.**
> Nothing below is invented. Findings are filled **only** from real frames once
> the reference recordings are provided and `extract_references.sh` has run.

## Why this is pending (verified, not assumed)
- Instagram + YouTube are **network-blocked from the build environment** (`403 host_not_allowed`), so the reels and the Mitmonk channel cannot be fetched here.
- Even if reachable, video frames can't be "seen" from a URL — analysis needs the actual frames.
- **No reference recordings were uploaded**, and the **Mitmonk channel URL is missing**.

## Inputs required (from MN)
| Ref | Provide as | Source |
|---|---|---|
| Instagram Reel 1 | `references/instagram_ref_01.mp4` (screen recording) | https://instagram.com/p/DVzS287ABDq/ |
| Instagram Reel 2 | `references/instagram_ref_02.mp4` (screen recording) | https://www.instagram.com/reel/DY3-KQMyClC/ |
| Mitmonk sample | `references/mitmonk_sample_01.mp4` + **exact channel URL** | ❓ needed |

Screen recordings are fine (a phone/desktop capture of the reel playing). Vertical 1080×1920 ideal but any clear capture works.

## Run the pipeline (once files are dropped in)
```bash
bash hermes/episodes/ep002/references/extract_references.sh
# -> references/frames/<name>/ (every-0.5s, dense first-3s hook, final CTA frame)
# -> references/reference_contact_sheet.png
```
Then this document gets filled in from those frames.

---

## Analysis template (one block per reference — to be completed from frames)
For each of `instagram_ref_01`, `instagram_ref_02`, `mitmonk_sample_01`:

### <reference name>
- **First 1s hook** — what's on screen frames 0–30; what stops the scroll.
- **Headline typography** — family/weight/case, size relative to frame, kinetic behavior.
- **Color palette** — dominant hues + accents (hex estimates from frames).
- **Contrast level** — bg vs text; punchiness; black levels.
- **Motion speed** — cuts/sec, reveal cadence, easing feel.
- **Transitions** — cut / whip / dissolve / match-cut / zoom.
- **Camera / graphic depth** — parallax, 3D, layering, focal depth.
- **CTA structure** — when it appears, wording, visual emphasis.
- **Proof / credibility elements** — receipts, screens, numbers, face.
- **Why it feels viral / premium** — the 2–3 load-bearing techniques.
- **What Cognitia V7 is missing vs this** — concrete deltas.

### Cross-reference synthesis (fill last)
- Shared viral techniques across all three.
- Pacing benchmark (hook length, avg shot length).
- Palette/typography deltas to fold into V8.
- Ranked list of V7→V8 changes with highest retention impact.

---

## Output of this analysis
The synthesis feeds the **"V8 — Viral Premium Reference System"** section in
`../DESIGN_SYSTEM.md` (currently marked PROVISIONAL) and the V8 preview build.
Until real frames exist, the V8 section stays provisional and the V8 preview is
not rendered as "reference-inspired" (that would fabricate the basis).
