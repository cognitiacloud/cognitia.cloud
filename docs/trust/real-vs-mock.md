# Real vs Mock

> Scoped to the **current Hermes Vision checkout** (`hermes/skills/vision-skill/**`).
> This is **not** the full Sales Closer / GTM OS runtime. When in doubt during a
> demo, **say the word "mock" or "planned" out loud on screen**.

Legend:

- **REAL** — present and verifiable in this checkout (evidence under
  `hermes/skills/vision-skill/**`).
- **SANDBOX** — exists only as a demo/sandbox construct; gated on consent.
- **PLANNED** — roadmap or separate branch; not in this checkout.
- **MOCK** — naming/brand/framing only; no implementation here.

## Capability status

| Capability | Status | Evidence / Notes |
| --- | --- | --- |
| Read-only content inspection (no delete/move/rewrite) | **REAL** | `hermes/skills/vision-skill/skill.yaml` (`read_only`, `no_delete`) |
| No-post / never publishes externally | **REAL** | `hermes/skills/vision-skill/skill.yaml` (`no_post`); `README.md` "Safety constraints" |
| No silent third-party uploads (provider only if env-configured; OCR-only fallback) | **REAL** | `hermes/skills/vision-skill/README.md` "Configure"; `skill.yaml` (`no_unknown_uploads`) |
| Log redaction (emails, API keys, tokens, financial digits) | **REAL** | `hermes/skills/vision-skill/skill.yaml` (`redact_logs`); `README.md` "Safety constraints" |
| Secret-in-frame → `publish_safe=false` | **REAL** | `hermes/skills/vision-skill/README.md` "Safety constraints" |
| `vision_privacy_scan` (OCR + regex; no LLM required) | **REAL** | `hermes/skills/vision-skill/README.md` "Tools"; `skill.yaml` |
| `vision_video_frame_qc` (9:16 safe zones, publish gate) | **REAL** | `hermes/skills/vision-skill/README.md` "Tools" |
| `vision_analyze_image`, `vision_compare_portraits` | **REAL** | `hermes/skills/vision-skill/README.md` "Tools" |
| Multi-provider routing (OpenAI/Anthropic/Gemini/OpenRouter/Ollama → OCR-only) | **REAL** | `hermes/skills/vision-skill/README.md` "Configure"; `skill.yaml` |
| Unit tests + synthetic test assets (no customer data) | **REAL** | `hermes/skills/vision-skill/test_vision_skill.py`, `test_assets/` |
| **Cognitia** pipeline / trust-control layer | **REAL (partial)** | Visible **only through Hermes Vision** in this checkout; broader pipeline is **PLANNED**. |
| **Demandara** GTM/operator brand | **MOCK** | Brand/naming convention only. No code module in this checkout. |
| **Budget Wheels** (`budget_wheels_demo`) | **SANDBOX** | **Tenant Zero sandbox unless the founder confirms consent.** Never present as live without confirmed consent. |
| Sales Closer / proof-governed GTM **workflow/engine** | **PLANNED** | Planned or **separate W1 branch**. Not verified here. Demo it as *motion/framing* only. |
| Proof-governance dashboards / metrics | **PLANNED** | None exist in this checkout. No metrics to show. |
| Trust Center automation / portal | **PLANNED** | This Trust Center is a static **draft**, not an automated portal. |
| Client Zero pilot program | **PLANNED** | A pilot **template** only. Do not imply a Client Zero exists or is running. |
| C2PA / content provenance signing | **PLANNED** | Research direction (branch name). **Not shipping.** |
| SOC2 controls beyond the listed technical ones | **PLANNED** | Only the technical controls above exist. **Not certified.** |

## Demo-honesty rule

If a capability in this table is not **REAL**, the person demoing must verbally
label it as **mock / sandbox / planned** at the moment it appears. Do not let a
**PLANNED** or **MOCK** item read as shipped.
