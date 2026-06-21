# Hermes Vision Skill

Local, controlled vision QC for the Cognitia pipeline. Safe inspection of
portraits, screenshots, video frames, logos, and privacy risks before any
Cognitia video is rendered or posted.

This skill is **read-only**. It never deletes files, never posts anywhere,
and never uploads images to a third-party service unless a provider is
explicitly configured via environment variables.

## Install

```bash
# system deps
sudo apt-get install -y tesseract-ocr ffmpeg

# python deps
pip install -r requirements.txt
```

Optional vision provider SDKs are loaded lazily — none are required, the
skill talks to each provider's HTTPS API directly via `urllib`.

## Configure

Provider routing priority (auto-selected unless overridden):

1. `HERMES_VISION_PROVIDER` — explicit override
   (`openai|anthropic|gemini|openrouter|ollama|ocr_only`)
2. `OPENAI_API_KEY` → OpenAI vision (`gpt-4o-mini` by default)
3. `ANTHROPIC_API_KEY` → Claude vision
4. `GOOGLE_API_KEY` → Gemini vision
5. `OPENROUTER_API_KEY` → OpenRouter vision
6. Reachable `OLLAMA_BASE_URL` (default `http://127.0.0.1:11434`) → local Ollama
7. Otherwise → `ocr_only` (Tesseract OCR + regex privacy scanner)

Optional model overrides:

- `HERMES_VISION_OPENAI_MODEL` (default `gpt-4o-mini`)
- `HERMES_VISION_ANTHROPIC_MODEL` (default `claude-sonnet-4-6`)
- `HERMES_VISION_GEMINI_MODEL` (default `gemini-1.5-flash`)
- `HERMES_VISION_OPENROUTER_MODEL` (default `openai/gpt-4o-mini`)
- `HERMES_VISION_OLLAMA_MODEL` (default `llava`)

No secrets are stored in code; the skill reads keys only from the
environment, redacts them in logs, and refuses to publish images when a
secret is visible in the frame.

## Tools

### `vision_analyze_image`
Inputs: `image_path`, `task`, optional `output_json_path`.
Outputs JSON with `image_type`, `summary`, `visible_subject`,
`quality_score`, `brand_score`, `identity_notes`, `production_notes`,
`privacy_risks`, `detected_text`, `recommended_action`, `confidence`.

### `vision_compare_portraits`
Inputs: `reference_image_paths` (list), `candidate_image_path`, `task`.
Outputs JSON with `identity_match_score`, `naturalness_score`,
`handsome_polished_score`, `fake_ai_risk_score`, beard/hair/face
consistency notes, and `recommended_use`
(`main_avatar | backup_reference | reject`).

### `vision_privacy_scan`
Inputs: `image_path`.
Outputs JSON with `emails_detected`, `phone_numbers_detected`,
`api_keys_or_tokens_detected`, `account_names_detected`,
`file_paths_detected`, `financial_data_detected`,
`blur_recommendations`, and `publish_safe` (boolean).
Runs fully on OCR + regex — no LLM required.

### `vision_video_frame_qc`
Inputs: either `video_path` or `frame_path`.
Outputs JSON with `face_visible`, `captions_readable`, `logo_visible`,
`safe_zones_ok`, `private_info_visible`, `looks_like_ai_slop_risk`,
`publish_safe`, and `recommended_fixes`.

## CLI usage

```bash
python3 vision_skill.py analyze  --image test_assets/portrait.jpg \
    --task "judge if suitable for Cognitia founder avatar"
python3 vision_skill.py privacy  --image test_assets/screenshot.jpg
python3 vision_skill.py compare  --refs test_assets/ref1.jpg,test_assets/ref2.jpg \
    --candidate test_assets/candidate.jpg
python3 vision_skill.py frameqc  --frame test_assets/portrait.jpg
python3 vision_skill.py provider   # shows the selected provider
```

## MCP server usage

The same script exposes an MCP stdio server under the four tool names
above. Register it via `.mcp.json` (see the file in this folder) or via
your Hermes loader. The MCP server requires the `mcp` Python SDK
(`pip install mcp`).

```bash
python3 vision_skill.py --mcp
```

## Safety constraints

- Read-only inspection. Never deletes, moves, or rewrites source files.
- Never posts anywhere; never publishes to external services.
- Only uploads image bytes to a vision provider you explicitly configured.
- Logs are filtered through a redaction pass — emails, API keys, tokens
  and financial digits are scrubbed before they hit the log stream.
- If any token / API key / financial-looking digits are detected in an
  image, `publish_safe` is forced to `false` and the recommended action
  becomes `reject_publish_secrets_visible`.

## Enterprise hardening (W7)

Enterprise-readiness guardrails wrap this mock-safe spine. They make the
mock/live boundary, PII redaction, RBAC, audit, and rate/cost posture explicit,
and mechanically block any live network / outreach surface from creeping in.

- [`ENTERPRISE_HARDENING.md`](ENTERPRISE_HARDENING.md) — hardening checklist tied
  to the spine, with `[implemented]` / `[placeholder]` / `[documented-gap]` tags.
- [`POLICY_CONTRACT.md`](POLICY_CONTRACT.md) — permission/RBAC contract, mock/live
  boundary rule, and the authoritative forbidden-surface denylist.
- [`RELEASE_CHECKLIST.md`](RELEASE_CHECKLIST.md) — first-wave go-live gate (no real
  outreach, no accidental egress).

Guard tests (`test_enterprise_guard.py`, `test_pii_redaction.py`) run alongside
the functional suite and in CI (`.github/workflows/hardening-guards.yml`):

```bash
python3 test_enterprise_guard.py   # mock/live + egress + outreach + safety
python3 test_pii_redaction.py      # redaction contract
```

## Install into Hermes

Drop the entire `vision-skill/` folder into `~/.hermes/skills/`:

```bash
cp -r vision-skill ~/.hermes/skills/vision-skill
```

If your Hermes loader expects a different schema for `.mcp.json` or
`skill.yaml`, see the existing `~/.hermes/skills/heygen-skills/` for a
reference and adjust those two metadata files only. The Python module
itself is loader-agnostic.
