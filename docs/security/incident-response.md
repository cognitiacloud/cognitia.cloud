# Incident Response Outline, Subprocessors & Audit-Log Requirements — Hermes Vision Skill

> **Scope:** the current Hermes Vision Skill (`hermes/skills/vision-skill/`) only. Part of
> SOC2-readiness *preparation* — not a certification. Roles and contacts are placeholders
> (`TBD`) to be filled before a Private Pilot.

## Incident response outline

### Roles (assign before Private Pilot)
| Role | Owner | Responsibility |
|------|-------|----------------|
| Incident lead | `TBD` | Owns the response, declares severity, coordinates |
| Technical responder | `TBD` | Investigates, contains, remediates |
| Communications/owner contact | `TBD` | Notifies affected parties / pilot participants |

### Severity levels
| Sev | Definition (this skill's surface) | Example |
|-----|-----------------------------------|---------|
| **SEV-1** | Confirmed exposure of a secret or real customer data | Provider API key leaked; a real customer image with PII sent to an unintended destination |
| **SEV-2** | Control failure without confirmed exposure | Privacy gate (`vision_privacy_scan`) fails to flag a known-bad asset; redaction not applied to logs |
| **SEV-3** | Degraded operation, no data risk | Provider outage; OCR/ffmpeg dependency missing |

### Detection sources
- Operator observation during a Mock Demo or Private Pilot.
- Provider-side errors surfaced in `ProviderResult.error` (`vision_skill.py`) — e.g. auth
  failures may indicate a revoked or leaked key.
- Provider account/billing anomalies (unexpected usage suggests key misuse).
- *(No automated monitoring/alerting exists today — see `deployment-boundary.md`. Detection is
  currently manual.)*

### Response flow
1. **Detect & triage** — assign severity; record time, what was observed, which assets/keys are
   involved.
2. **Contain** —
   - Suspected key exposure → **revoke/rotate the affected provider key immediately** at the
     provider (see [`secrets-policy.md`](./secrets-policy.md)); unset the env var.
   - Suspected data egress → stop runs; switch to **OCR-only** mode (no cloud egress) until
     resolved.
3. **Eradicate** — remove the root cause (bad config, leaked secret, failing control).
4. **Recover** — restore normal operation with a fresh key / corrected config; re-verify the
   privacy gate and redaction on a known test asset.
5. **Post-incident review** — short write-up: timeline, impact, root cause, follow-ups. Feed
   gaps back into [`soc2-readiness.md`](./soc2-readiness.md).

### Notification
- For SEV-1 in a Private Pilot, notify affected pilot participants/owner via the comms role
  above. Concrete contacts and any contractual notification timelines: `TBD`.

## Vendor / subprocessor list (placeholder)

**Terminology (per scope rules):**
- **Potential cloud subprocessors** — external services that may receive image bytes **only if
  the corresponding key is configured**. With no key set, that provider is not used and no data
  leaves the host to it.
- **Local/self-hosted endpoint** — Ollama, which by default targets `http://127.0.0.1:11434`
  (local) and is only a subprocessor if the operator points `OLLAMA_BASE_URL` at a remote host.
- **Local system dependencies** — `tesseract-ocr` and `ffmpeg`. These run **on the host**, send
  no data anywhere, and are **not** subprocessors.

| Service | Classification | Data shared (if used) | Purpose | DPA / contract status |
|---------|----------------|-----------------------|---------|-----------------------|
| OpenAI | Potential cloud subprocessor (if `OPENAI_API_KEY` set) | Image bytes (base64) + prompt over HTTPS to `api.openai.com` | Vision analysis | `TBD` |
| Anthropic | Potential cloud subprocessor (if `ANTHROPIC_API_KEY` set) | Image bytes (base64) + prompt over HTTPS to `api.anthropic.com` | Vision analysis | `TBD` |
| Google (Gemini) | Potential cloud subprocessor (if `GOOGLE_API_KEY` set) | Image bytes + prompt over HTTPS to `generativelanguage.googleapis.com` (key passed in URL — see `secrets-policy.md`) | Vision analysis | `TBD` |
| OpenRouter | Potential cloud subprocessor (if `OPENROUTER_API_KEY` set) | Image bytes (base64) + prompt over HTTPS to `openrouter.ai` | Vision analysis (routes to upstream models) | `TBD` |
| Ollama | Local/self-hosted endpoint (`OLLAMA_BASE_URL`, default localhost) | Image bytes to the configured endpoint; remote only if reconfigured | Local vision analysis | n/a unless pointed at a remote host |
| tesseract-ocr | Local system dependency — **not** a subprocessor | None (runs on host) | OCR for `privacy_scan` / OCR-only mode | n/a |
| ffmpeg | Local system dependency — **not** a subprocessor | None (runs on host) | Video frame extraction for `video_frame_qc` | n/a |

Before a Private Pilot, fill the DPA/contract column for **whichever providers are actually
configured** for that pilot. If processing must stay fully local, configure **none** of the cloud
keys and run OCR-only or local Ollama.

## Audit-log requirements

**Current state:** there is **no persistent or tamper-evident audit log** (not observed in
current code). Logs pass through redaction (`_RedactingFilter` / `_redact()` in
`vision_skill.py:45–96`) and are then discarded, not retained. This is a known gap (checklist
**S4**).

### Events that must be logged (target)
- **Access** — who invoked the skill, when, and against which asset(s).
- **Provider/egress** — which provider was selected and that an external call occurred (not the
  payload). Useful for confirming when data left the host.
- **Publish decisions** — `vision_privacy_scan` / `vision_compare` outcomes, especially
  `publish_safe=false` / `reject_publish_secrets_visible`.
- **Configuration changes** — provider override, key added/removed/rotated (value never logged).
- **Errors** — provider auth failures and control failures (candidate incident signals).

### Properties (target)
- **Redaction-safe:** audit entries must inherit the same redaction discipline — never record
  secret values or unredacted PII.
- **Retention:** defined period per tier (`TBD`); separate from any transient debug logging.
- **Tamper-evidence:** append-only / integrity-protected storage for Production.
- **Tiering:** Private Pilot needs at least a **basic access trail** for the pilot window;
  Production needs the **full, durable, tamper-evident** log before external access is enabled
  (see [`deployment-boundary.md`](./deployment-boundary.md)).

## Related documents
- [`soc2-readiness.md`](./soc2-readiness.md) — checklist items **S4** (audit), **C1** (vendors).
- [`deployment-boundary.md`](./deployment-boundary.md) — monitoring, tiers, release gate.
- [`secrets-policy.md`](./secrets-policy.md) — key revocation/rotation during an incident.
