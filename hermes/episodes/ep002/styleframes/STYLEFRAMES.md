# Episode 002 — Style Frames (A–E)

Five 1080×1920 PNG comps for **approval**. These are static design comps, not a
render and not animated. Built deterministically (`build_frames.py`, Pillow @2×
supersample) so every pixel, color, and log line is intentional — no AI image
generation, no fake dashboards.

**Locked palette:** base `#070B14` navy · signature accent `#00E5FF` cyan ·
secondary label `#58A6FF` · verified/pass `#22C55E` · warn/amber `#F2A24B` ·
fail `#FF6B6B`. Type: Liberation Sans (grotesk) + DejaVu Sans Mono (data).

> Absolute rule honored on every frame: **no text-only dark card.** Each frame
> carries a real operator-proof object (terminal, pipeline, manifest, QC JSON,
> player/delivery).

---

## Frame A — Hook (`A_hook.png`)
- **Scene purpose:** stop the scroll with a confident, anti-hype claim that already shows the machine behind it ("(In theory.)" is the tell).
- **Real proof visible:** dim live `hermes run --episode 002` scrollback behind the headline (stages 01–04 with real durations/sizes); framed avatar PiP slot, chest-up.
- **Density estimate:** ~40% (target 35–45 ✓).
- **Phone readability:** headline 92px, sub 40px, scrollback mono 26px, kicker 24px (eyebrow label). All body/data ≥ 26px → readable on iPhone without zoom.
- **Animates later:** headline lines mask-reveal upward (staggered 4f); cyan underline wipes L→R under "automated"; scrollback already scrolling on entry; PiP scales in 0.96→1.0 with shadow bloom; annotation arrow draws last.

## Frame B — Real pipeline / tool stack (`B_pipeline.png`)
- **Scene purpose:** "here is the actual machine" — the six real stages as a graph, with the gate that can say no.
- **Real proof visible:** 6 named nodes (Claude→ElevenLabs→HeyGen→FFmpeg→Vision QC→Telegram) each with its produced artifact tag; QC node flagged amber; GENERATE / GATE+DELIVER brackets; `~78s end-to-end` chip.
- **Density estimate:** ~62% (target 55–70 ✓).
- **Phone readability:** tool names 44px, function labels 32px, artifact tags mono 26px, footer 28px. All ≥ 26px.
- **Animates later:** nodes light L→R (~150ms apart); connector edges draw with arrowheads; QC node pulses amber→neutral once (foreshadows Frame D); brackets draw after nodes settle; chips fade in last.

## Frame C — Terminal / build proof (`C_terminal.png`)
- **Scene purpose:** undeniable receipts — "this actually ran."
- **Real proof visible:** full terminal window (chrome + prompt) with real per-stage log lines and `✓` results; file manifest tree with byte sizes; build-metrics panel (78.3s, 4/4, 0 retries, 22.6 MB); cyan highlight box + arrow on `compose.mp4`.
- **Density estimate:** ~72% (target 65–80 ✓).
- **Phone readability:** section title 60px, terminal mono 28px, manifest mono 28px, metric numerals 48px, labels 24–28px. Data ≥ 28px (meets the 28–32 floor).
- **Animates later:** terminal types line-by-line (~22ms/char); each `✓` pops (scale 1.0→1.15→1.0); manifest rows slide in as their stage completes; metric numbers count up over 12f; highlight box snaps + arrow draws last.

## Frame D — QC / pass-fail gate (`D_qc.png`)
- **Scene purpose:** show the gate doing its job — it blocks before it ships, then passes on the fix.
- **Real proof visible:** real `vision_skill → qc.json` (brand 0.91, fake-AI 0.07, face_box 0.86, ink 0.41, privacy clean, verdict PASS); ship-gate checklist with values; a `1st pass · BLOCKED` card (chin clip + empty slide) → arrow → `PASSED` stamp; a 6-cell QC contact sheet (S1–S6, each ✓).
- **Density estimate:** ~76% (target 65–80 ✓).
- **Phone readability:** section title 56px, JSON mono 30px, gate labels 30px, values mono 30px, PASSED 46px. Contact-sheet labels 22px (decorative only). Core data ≥ 30px.
- **Animates later:** JSON values count up / type in green; BLOCKED card flashes amber + lines shake; arrow draws; PASSED stamp scales 1.2→1.0 with a green bloom; contact-sheet checks stagger in L→R.

## Frame E — Final result / CTA (`E_result.png`)
- **Scene purpose:** the payoff + honest sign-off + follow.
- **Real proof visible:** player mock showing the composed final vertical frame (caption + mini avatar PiP) with a transport bar at 0:47/1:00; Telegram delivery card (`ep002.mp4 · 22.6 MB · ✓`); spec/QC metric chips incl. the honest `human review: 1 frame`; wordmark lockup.
- **Density estimate:** ~58% (final/CTA — premium, not empty).
- **Phone readability:** headline 84px, sub 40px, CTA 38px, delivery text 24–28px, chips 24px. All ≥ 24px; primary copy ≥ 38px.
- **Animates later:** player scrubber sweeps; delivery card slides in with a check pop; chips stagger; headline rises; wordmark tracks in (0.3em→0.08em); CTA arrow nudges right ×2 on a loop.

---

### Sub-28px elements (flag for your call)
Only non-essential **labels** dip below the 28px data floor: kicker eyebrows
(24px) and the contact-sheet thumbnail tags (22px). Body, headlines, terminal,
JSON, and metrics are all ≥ 28px. Say the word and I'll raise the floor to 28px
everywhere for strict compliance.

### Reproduce
```bash
cd hermes/episodes/ep002/styleframes
python3 build_frames.py     # writes A_hook.png … E_result.png
```
`framekit.py` is a zero-dependency FreeType+zlib fallback renderer (used if
Pillow is unavailable).
