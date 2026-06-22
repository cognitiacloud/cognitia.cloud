# Secrets Policy — Hermes Vision Skill

> **Scope:** the current Hermes Vision Skill (`hermes/skills/vision-skill/`) only. This is a
> **policy document**, part of SOC2-readiness *preparation*. It is not certification, and it
> makes **no changes** to CI, secret stores, `.mcp.json`, or any runtime configuration.

## Secret inventory (verified from `hermes/skills/vision-skill/**`)

All values below are read from **environment variables**. Provider keys and the model overrides
are confirmed in `vision_skill.py`, `skill.yaml`, `README.md`, and `.mcp.json`.

| Env var | Sensitivity | Purpose | Source in code |
|---------|-------------|---------|----------------|
| `OPENAI_API_KEY` | **Secret** | Enables OpenAI provider | `vision_skill.py:134,182`; `skill.yaml:42`; `.mcp.json:9` |
| `ANTHROPIC_API_KEY` | **Secret** | Enables Anthropic provider | `vision_skill.py:136,217`; `skill.yaml:43`; `.mcp.json:10` |
| `GOOGLE_API_KEY` | **Secret** | Enables Gemini provider | `vision_skill.py:138,255`; `skill.yaml:44`; `.mcp.json:11` |
| `OPENROUTER_API_KEY` | **Secret** | Enables OpenRouter provider | `vision_skill.py:140,281`; `skill.yaml:45`; `.mcp.json:12` |
| `OLLAMA_BASE_URL` | Config (not a secret) | Local/self-hosted Ollama endpoint (default `http://127.0.0.1:11434`) | `vision_skill.py:148,311`; `skill.yaml:46`; `.mcp.json:13` |
| `HERMES_VISION_PROVIDER` | Config (not a secret) | Explicit provider override (`openai\|anthropic\|gemini\|openrouter\|ollama\|ocr_only`) | `vision_skill.py:131`; `skill.yaml:41` |
| `HERMES_VISION_OPENAI_MODEL` | Config | Model override (default `gpt-4o-mini`) | `vision_skill.py:183`; `README.md:39` |
| `HERMES_VISION_ANTHROPIC_MODEL` | Config | Model override (default `claude-sonnet-4-6`) | `vision_skill.py:218`; `README.md:40` |
| `HERMES_VISION_GEMINI_MODEL` | Config | Model override (default `gemini-1.5-flash`) | `vision_skill.py:256`; `README.md:41` |
| `HERMES_VISION_OPENROUTER_MODEL` | Config | Model override (default `openai/gpt-4o-mini`) | `vision_skill.py:282`; `README.md:42` |
| `HERMES_VISION_OLLAMA_MODEL` | Config | Model override (default `llava`) | `vision_skill.py:312`; `README.md:43` |

**Note on the Google key:** in `vision_skill.py:262` the Google key is placed in the **request
URL query string** (`?key=...`), not a header. URLs are more prone to ending up in logs/proxies.
This is recorded as a handling risk for that provider — keep such keys narrowly scoped and rotate
readily. *(Observation only; no code change is made by this document.)*

No other secrets (database credentials, signing keys, tokens, cloud provider keys) were observed
in current code.

## Policy

### Storage
- **No secrets in the repository.** Provider keys must never be committed. The repo's
  `.mcp.json` ships **empty** placeholder values (`""`) and must stay that way — it documents the
  variable names, not their values.
- Secrets are provided at **runtime** via the environment (Mock Demo / Pilot) and, for any
  future hosted tier, via a managed secret store rather than plaintext env files.
- No secret values appear in this document by design.

### Least privilege & scoping
- Provider API keys must be **scoped to the minimum** needed (single project/workspace, lowest
  usable quota/permissions, separate key per environment where the provider supports it).
- Configure **only the provider(s) actually needed** for the tier. The provider auto-selection
  order is OpenAI → Anthropic → Gemini → OpenRouter → Ollama → OCR-only
  (`vision_skill.py:131–151`); leaving a key unset disables that provider. Setting **no** cloud
  key keeps processing local (OCR-only / Ollama).

### Rotation
- Rotation cadence: **`TBD`** (recommend a defined interval plus immediate rotation on suspected
  exposure). No rotation mechanism exists in code today (not observed in current code) — rotation
  is currently a manual operator action.
- Every key must have a known **owner** (`TBD`) and a known **revocation path** at the provider
  so it can be killed quickly during an incident (see [`incident-response.md`](./incident-response.md)).

### Handling per tier
| Tier | Secret handling |
|------|-----------------|
| **Mock Demo** | No real keys, or a disposable test key; OCR-only mode needs no key at all |
| **Private Pilot** | Real keys injected at runtime by the operator; scoped to the pilot; documented owner + revocation path |
| **Production** | Managed secret store + enforced rotation + per-environment isolation (net-new; out of current scope) |

### Exposure containment (already in code)
- Logs pass through `_RedactingFilter` / `_redact()` which replace emails, API-key/token
  patterns, and financial patterns with `[…_REDACTED]` (`vision_skill.py:45–96`). This reduces
  the chance of a key landing in logs but is **not** a substitute for the storage rules above.
- `vision_privacy_scan()` forces `publish_safe=false` and
  `recommended_action="reject_publish_secrets_visible"` when a secret is detected **in an image**
  (`vision_skill.py:447`) — relevant because screenshots can contain pasted keys.

## Explicitly out of scope
This document changes **no** CI secrets, **no** secret-store contents, and **no** runtime config.
It is policy and inventory only.

## Related documents
- [`soc2-readiness.md`](./soc2-readiness.md) — checklist item **S2** tracks this policy.
- [`deployment-boundary.md`](./deployment-boundary.md) — per-environment secret isolation.
- [`incident-response.md`](./incident-response.md) — key revocation during an incident.
