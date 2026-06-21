# Enterprise Hardening Checklist — Client Zero Spine (W7)

This checklist is tied to the **mock-safe spine** that exists today: the Hermes
vision skill (`vision_skill.py`). It makes every enterprise-readiness control
**explicit** — implemented, placeholder, or a documented gap — so the first wave
ships with eyes open rather than silent assumptions.

Status legend:

- `[implemented]` — enforced in code and/or a guard test.
- `[placeholder]` — contract/expectation is written down; enforcement is a stub
  for a later wave.
- `[documented-gap]` — known residual risk, accepted for the first wave, with a
  documented mitigation.

Guards that back these items live in `test_enterprise_guard.py` and
`test_pii_redaction.py`, and run in CI (`.github/workflows/hardening-guards.yml`).

---

## 1. Mock / live boundary

- `[implemented]` The spine defaults to `ocr_only` (Tesseract OCR + regex) when
  no provider credential is present — `_select_provider()` in `vision_skill.py`.
- `[implemented]` `HERMES_VISION_PROVIDER=ocr_only` is a **guaranteed-airgapped**
  configuration: `MockSafeNoNetworkTests` runs all four tools with `urlopen` and
  `socket.socket` trip-wired to raise, and proves zero egress.
- `[implemented]` All network egress is confined to the five `_call_*` provider
  functions plus `_ollama_reachable` — `EgressConfinementTests` (AST scan) fails
  if any other code path opens a socket.
- `[documented-gap]` In **auto** mode with no keys, `_select_provider()` probes a
  *localhost* Ollama daemon (`_ollama_reachable`, 2s timeout). This is a loopback
  probe, not third-party egress. To be fully airgapped, set
  `HERMES_VISION_PROVIDER=ocr_only` (the documented safe default for CI / batch).
- `[documented-gap]` Live providers (OpenAI/Anthropic/Gemini/OpenRouter/Ollama)
  send image bytes to a third party **only** when their credential is explicitly
  set in the environment. This is opt-in by construction; see POLICY_CONTRACT.md.

## 2. PII redaction

- `[implemented]` `_redact()` scrubs emails, all `KEY_PATTERNS` secrets, and
  financial digits before they reach tool output or logs.
- `[implemented]` Echoed OCR text in `vision_analyze_image.detected_text` and
  `vision_privacy_scan.ocr_text_redacted` is redacted — `OutputNeverLeaksTests`.
- `[implemented]` Visible secret ⇒ `publish_safe=false` and
  `recommended_action=reject_publish_secrets_visible` (`vision_skill.py:446`).
- `[documented-gap]` `_redact()` covers emails / keys / financial. Phone numbers,
  `@handles`, and file paths are **detected and flagged** (`_scan_text_for_pii`)
  and drive blur recommendations, but are not string-substituted in echoed text.
  Acceptable for first wave because findings still force review; tighten later.

## 3. Permission / RBAC

- `[placeholder]` No per-caller identity or role model exists yet. The capability
  contract (read-only, four tool scopes, who may enable a live provider) is
  written in POLICY_CONTRACT.md and is the spec for a later auth layer.
- `[implemented]` The skill is structurally read-only: no write/delete/post/send
  surface exists, enforced by `NoOutreachSurfaceTests` and the `skill.yaml`
  safety flags (`SafetyContractTests`).

## 4. Audit log expectations

- `[implemented]` All logs pass through `_RedactingFilter` (stderr handler) — no
  secret reaches the log stream (`LogRedactionTests`).
- `[implemented]` Provider selection is logged (`_call_vision` →
  `LOG.info("vision provider selected: %s")`), so every run records which
  mock/live path was taken.
- `[placeholder]` A structured, append-only audit record per tool invocation
  (who / when / tool / inputs hash / decision) is **not** yet emitted. Expected
  fields are specified in POLICY_CONTRACT.md → "Audit record". Retention,
  tamper-evidence, and shipping to a sink are later-wave work.

## 5. Rate / cost guards

- `[implemented]` `ocr_only` is the zero-cost, zero-egress default; cost is only
  possible when a live credential is explicitly configured.
- `[implemented]` Per-call wall-clock bound: `DEFAULT_TIMEOUT = 60s` on every
  provider request; `_ollama_reachable` probe is 2s; ffmpeg extraction 120s.
- `[placeholder]` No per-run call budget, request-rate limiter, or spend ceiling
  exists. Placeholder contract: a future `HERMES_VISION_MAX_CALLS` /
  `HERMES_VISION_COST_CEILING_USD` enforced before each `_call_*`. Until then,
  cost is bounded only by how often a caller invokes a tool with a live key set.
- `[documented-gap]` `MAX_IMAGE_BYTES = 20MB` caps per-image payload size, which
  bounds worst-case token/cost per call but not aggregate spend.

## 6. Release / first-wave gate

- See RELEASE_CHECKLIST.md. The hard gate: **no real outreach/send surface** may
  exist in the first wave, enforced mechanically by `NoOutreachSurfaceTests` in
  CI and re-affirmed by the release checklist.

---

## How to run the guards

```bash
cd hermes/skills/vision-skill
python3 test_enterprise_guard.py -v   # mock/live + egress + outreach + safety
python3 test_pii_redaction.py -v      # redaction contract
python3 test_vision_skill.py -v       # existing functional suite
```

CI runs all three on every push / PR.
