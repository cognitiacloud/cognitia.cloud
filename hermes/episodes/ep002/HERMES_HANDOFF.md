# Hermes Handoff — Episode 002 (PREVIEW ONLY)

**Scope of this handoff:** generate proofing assets ONLY. Hermes must produce
exactly three deliverables — 3 style frames, 1 contact sheet, and one 8–12s
preview — then **STOP and wait for human approval.**

> ⛔ **DO NOT do a final 60s render. DO NOT publish to Telegram. DO NOT claim
> publish-ready.** Any full render or delivery is blocked until a human approves
> the preview below.

---

## Inputs (read before generating)
- `STORYBOARD.md` — 7 scenes, on-screen text, VO lines, motion, required proof.
- `DESIGN_SYSTEM.md` — colors, fonts, spacing, captions, PiP, logo, Shorts safe zones.
- `ACCEPTANCE_CHECKLIST.md` — the gates this episode is graded against.
- `remotion/` — component scaffold (Episode002 composition, 1080×1920, 30fps).
- `remotion/src/assets/run41/*` — real-run artifacts. If missing, capture a real
  `hermes run` first; **do not fabricate** logs, numbers, or QC JSON.

## Brand guardrails (hard)
- Premium dark tech; gradient canvas, never flat black.
- One accent (`#58A6FF`) + pass/fail green/amber only. No off-palette color.
- No emoji, no watermark, no persistent logo bug, no fake dashboard, no fake metrics.
- Avatar is NEVER full-screen — framed PiP only, chest-up, `face_box` ≤ 0.90.
- Captions ≤4 words/line, above the PiP, inside Shorts safe zones.

---

## Deliverable A — 3 style frames (stills, 1080×1920 PNG)
Pick the three most load-bearing looks so we can approve the visual language
before motion:
1. **Hook frame (S1)** — kicker + headline over dim real terminal scrollback + corner avatar PiP.
2. **Real-proof frame (S4)** — `RUN #41 · LIVE LOG` terminal with real run41 rows + bottom artifact rail.
3. **Failure frame (S5, beat A)** — `QC GATE · BLOCKED` with real `qc_fail.json` lines + amber border.

For each frame, confirm against the checklist: ink coverage ≥12%, ≥3 layers,
single accent system, no watermark, captions legible, no full-screen avatar.

## Deliverable B — contact sheet (single 1080×1920 PNG)
One image: a 7-cell grid (or 2×4 with title cell), one representative frame per
scene S1–S7, each labeled with its component name and timestamp. Purpose:
approve the visual arc and density across the whole episode at a glance.

## Deliverable C — 8–12 second preview (MP4, 1080×1920, 30fps)
Render ONLY a representative slice — recommended: **S1 → first beat of S4**
(hook into the proof), or S4→S5 if we want to vet the proof→failure transition.
Must include:
- real VO segment + word-timed captions for that slice,
- the corner avatar PiP behaving per the presence map,
- at least one real artifact on screen (no placeholders in the preview).
Keep it ≤12s. This is a motion/timing/legibility proof, not the episode.

---

## Output + stop conditions
- Write previews to `remotion/out/preview/` (frames, contact sheet, clip).
- Run the vision QC gate (`hermes/skills/vision-skill`) on the 3 style frames +
  preview keyframes; attach the JSON (`brand_score`, `fake_ai_risk_score`,
  `face_box`, privacy scan) alongside each.
- Post a short summary: which checklist items pass/fail on the preview.
- **Then STOP.** Do not proceed to a full render or any delivery. Await an
  explicit human "approved — proceed to full render" before doing anything else.

## Human approval gate (to be completed by a person, not Hermes)
- [ ] Style frames on-brand (palette, type, density, no watermark)
- [ ] Contact sheet shows a strong, non-repetitive visual arc
- [ ] Preview captions readable + synced; avatar PiP correct (never full-screen)
- [ ] Real proof visible (no fabricated UI/numbers)
- [ ] QC gate JSON within thresholds
- [ ] **APPROVED → unblock full render**  /  ☐ Revise (notes: __________)
