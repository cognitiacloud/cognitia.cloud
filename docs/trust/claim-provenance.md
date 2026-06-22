# Claim Provenance

> Every external-facing claim mapped to its evidence. **REAL** claims must cite a
> path under `hermes/skills/vision-skill/**`. Everything else is phrased as
> **mock / sandbox / planned**. Scoped to the **current Hermes Vision checkout**.

## How to read this

- **Allowed?** = may this be said externally, as phrased in "Safe phrasing"?
- **Provenance** = the evidence anchor, or the reason it's roadmap.

## Verified-real claims (anchored in code)

| Claim | Allowed? | Provenance | Safe phrasing |
| --- | --- | --- | --- |
| The skill never deletes/moves/rewrites files | ✅ | `hermes/skills/vision-skill/skill.yaml` (`read_only`, `no_delete`) | "Read-only inspection — it can't alter your source files." |
| The skill never posts/publishes externally | ✅ | `hermes/skills/vision-skill/skill.yaml` (`no_post`); `README.md` "Safety constraints" | "It never posts anywhere — enforced in code." |
| No third-party upload unless explicitly configured | ✅ | `hermes/skills/vision-skill/README.md` "Configure"; `skill.yaml` (`no_unknown_uploads`) | "Images stay local unless you configure a provider; otherwise OCR-only." |
| Logs redact emails/keys/tokens/financial digits | ✅ | `hermes/skills/vision-skill/skill.yaml` (`redact_logs`); `README.md` "Safety constraints" | "Sensitive strings are scrubbed from logs." |
| Secret in frame forces `publish_safe=false` | ✅ | `hermes/skills/vision-skill/README.md` "Safety constraints" | "If a secret is visible, it refuses to mark the frame publish-safe." |
| Privacy scan runs on OCR + regex, no LLM needed | ✅ | `hermes/skills/vision-skill/README.md` "Tools" (`vision_privacy_scan`) | "Privacy scan works fully offline with OCR + regex." |
| Four tools exist (analyze, compare, privacy, frame QC) | ✅ | `hermes/skills/vision-skill/README.md` "Tools"; `skill.yaml` (`tools`) | "Four QC tools ship today." |
| Multi-provider routing with OCR-only fallback | ✅ | `hermes/skills/vision-skill/README.md` "Configure"; `skill.yaml` (`providers`) | "Works with several vision providers, or none." |
| Repo includes a synthetic unit test suite + test assets | ✅ | `hermes/skills/vision-skill/test_vision_skill.py`, `test_assets/` | "There's a synthetic test suite. **Unit test count/status: verify before demo.**" |

## Roadmap / brand / sandbox claims (NOT implemented here)

| Claim | Allowed as phrased? | Provenance | Safe phrasing |
| --- | --- | --- | --- |
| "Demandara" | ⚠️ brand only | Naming convention; no code module in this checkout | "Demandara is our GTM/operator brand convention." |
| "Cognitia pipeline" | ⚠️ partial | Visible only via Hermes Vision here | "Cognitia is the trust-control layer — what you see today is its Hermes Vision surface." |
| "proof-governed GTM" | ⚠️ framing only | Engine/workflow planned (separate W1 branch) | "This is the proof-governed GTM **motion/framing**; the engine is planned (separate branch)." |
| "Budget Wheels" | ⚠️ sandbox | `budget_wheels_demo` sandbox construct | "`budget_wheels_demo` runs in **Tenant Zero sandbox unless the founder confirms consent**." |
| "Client Zero" | ⚠️ template | Pilot template; no live pilot | "Client Zero is our first-engagement pilot **checklist**." |
| "C2PA / provenance" | ❌ as shipping | Research direction (branch name) | "Provenance is a planned direction, not shipping." |
| "SOC2" | ❌ as certification | Only narrow technical controls exist | "Not certified. Early **SOC2-readiness preparation for the Hermes Vision control surface** only." |
| Dashboards / metrics | ❌ | None in this checkout | "No metrics shown — we demo the control behavior instead." |
| Customers / testimonials / logos | ❌ | None exist | Do not reference. |

## Rule

If a claim isn't in the **verified-real** table above with a
`hermes/skills/vision-skill/**` anchor, it is **not** a real claim — phrase it
from the roadmap table or omit it.
