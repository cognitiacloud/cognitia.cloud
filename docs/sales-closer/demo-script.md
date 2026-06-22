# Founder Demo Script — under 10 minutes

> **External-safe.** Scoped to the **current Hermes Vision checkout**
> (`hermes/skills/vision-skill/`). This demo shows **one real control** — the
> Hermes Vision skill — and frames everything else as **motion / planned /
> sandbox**. Read [`../trust/prohibited.md`](../trust/prohibited.md) before
> running. Use only the synthetic `test_assets/` shipped in the repo.
>
> Every command below is copied verbatim from
> `hermes/skills/vision-skill/README.md`. **Do not invent UI, dashboards, API
> calls, or "proof screens."** The terminal output *is* the proof.

## Pre-flight (do before the call)

```bash
# from hermes/skills/vision-skill/
sudo apt-get install -y tesseract-ocr ffmpeg
pip install -r requirements.txt
python3 vision_skill.py provider   # confirm which provider is selected
```

> Run the four tools once beforehand so live output is fast. Verify the unit
> test status yourself if you plan to mention tests — do not quote a count you
> haven't confirmed.

## Timed flow (~9 minutes)

### 0:00–1:00 — Honest framing
- "This is the **proof-governed GTM motion** for Demandara — our GTM/operator
  brand — on top of the Cognitia trust-control layer."
- **SAY THIS:** "Today I'm showing the one piece that's live in this checkout:
  Hermes Vision. The broader workflow is planned on a separate branch."
- **DON'T SAY:** "proof-governed GTM is implemented" / "Client Zero is live" /
  any metric or customer name.

### 1:00–2:00 — What proof-governance means
- "Every claim should trace to something you can inspect. So instead of slides,
  I'll run the actual control and you read the JSON."

### 2:00–4:00 — Privacy scan (the headline control)
```bash
python3 vision_skill.py privacy --image test_assets/screenshot.jpg
```
- Point at `publish_safe` and the detected-fields output.
- **SAY THIS:** "This runs on OCR + regex — no LLM required, nothing leaves the
  machine. If a secret or financial digit is visible, `publish_safe` flips to
  false and it refuses to ship."

### 4:00–6:00 — Frame QC before publish
```bash
python3 vision_skill.py frameqc --frame test_assets/portrait.jpg
```
- Walk `face_visible`, `captions_readable`, `safe_zones_ok`,
  `private_info_visible`, `publish_safe`.
- "This is the gate before any Cognitia video is rendered or posted. The skill
  itself never posts — that's enforced in code."

### 6:00–7:30 — Avatar selection (optional, if time)
```bash
python3 vision_skill.py analyze --image test_assets/portrait.jpg \
    --task "judge if suitable for Cognitia founder avatar"
python3 vision_skill.py compare --refs test_assets/ref1.jpg,test_assets/ref2.jpg \
    --candidate test_assets/candidate.jpg
```
- "Same pattern: structured JSON you can audit, not a black box."

### 7:30–8:30 — Roadmap (clearly labeled future)
- **SAY THIS, exactly as future:** "Planned next, on separate branches: the
  proof-governed GTM engine, the Client Zero pilot, and `budget_wheels_demo`
  which stays in **Tenant Zero sandbox unless consent is confirmed**. Content
  provenance (C2PA) is a research direction, not shipping. We are **not** SOC2
  certified — we have early SOC2-readiness preparation for this control surface."

### 8:30–9:00 — Close
- "What's real today is the control you just watched. If you want to be Client
  Zero, here's the pilot checklist." → [`client-zero-pilot-checklist.md`](./client-zero-pilot-checklist.md)

## Guardrails (from prohibited.md)

| SAY THIS | DON'T SAY |
| --- | --- |
| "Hermes Vision is live in this checkout." | "The full GTM OS is live." |
| "proof-governed GTM **motion/framing**." | "proof-governed GTM is implemented." |
| "No metrics — watch the control behavior." | Any conversion / revenue / accuracy number. |
| "Not certified; early SOC2-readiness prep for this control surface." | "SOC2 certified / compliant." |
| "`budget_wheels_demo`, Tenant Zero sandbox unless consent confirmed." | "Budget Wheels is live for a customer." |
| "Provenance is planned." | "C2PA is shipping." |
| "Client Zero is a pilot checklist." | "Client Zero is running." |
