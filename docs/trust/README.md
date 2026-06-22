# Trust Center — Demandara / Cognitia (DRAFT, external-safe)

> **Status: DRAFT — external-safe demo pack.** Last reviewed: 2026-06-22.
>
> **Scope:** This Trust Center and the demo pack it links to are scoped to the
> **current Hermes Vision checkout** in this repository
> (`hermes/skills/vision-skill/**`). They **do not represent the full Sales
> Closer / GTM OS runtime**. Anything not directly verifiable in this checkout
> is labeled **planned** or **separate branch**.

## Naming conventions used in this pack

| Term | Meaning here | Reality in this checkout |
| --- | --- | --- |
| **Demandara** | GTM / operator **brand convention** for the sales motion. | Brand name only. Not a product or code module in this checkout. |
| **Cognitia** | The **pipeline / trust-control layer** that prepares content for render and publish. | Visible in current code **through Hermes Vision** (`hermes/skills/vision-skill/`). |
| **Hermes Vision** | The read-only content-QC skill that inspects portraits, screenshots, video frames, logos, and privacy risks before anything is rendered or posted. | **Real and present** in this checkout. |
| **Sales Closer / proof-governed GTM workflow** | The end-to-end "claims must trace to evidence" sales operating system. | **Planned / separate W1 branch.** Not verified in this checkout. |

## What "proof-governed GTM motion" means

Proof-governed GTM is a **demo framing**, not a shipped engine in this checkout.
The principle: every external claim should trace to evidence a viewer can
inspect. In this pack the *only* claims marked **REAL** are the ones that map to
files under `hermes/skills/vision-skill/**`. Everything else is roadmap.

> The proof-governed GTM **workflow/engine itself is planned (separate branch)**.
> Do **not** present it as implemented. Present the *motion* and *framing*, and
> demonstrate the one real control that exists today: Hermes Vision.

## Trust posture (today, in this checkout)

Each row below maps to an actual behavior of the Hermes Vision skill. See
[claim-provenance.md](./claim-provenance.md) for the file-path evidence.

| Control | Behavior | Evidence anchor |
| --- | --- | --- |
| Read-only inspection | Never deletes, moves, or rewrites source files. | `skill.yaml` (`read_only`, `no_delete`) |
| No-post guarantee | Never posts or publishes to any external service. | `skill.yaml` (`no_post`) |
| No silent uploads | Sends image bytes to a vision provider **only** if one is explicitly configured via env vars; otherwise runs OCR-only locally. | `README.md` "Configure", `skill.yaml` (`no_unknown_uploads`) |
| Log redaction | Emails, API keys, tokens, and financial digits are scrubbed before logging. | `skill.yaml` (`redact_logs`); `README.md` "Safety constraints" |
| Secret-in-frame block | If a secret/token/financial digit is visible in an image, `publish_safe` is forced to `false`. | `README.md` "Safety constraints" |

## Compliance status (read this carefully)

- **SOC2:** **Not certified. No audit, no report, no certification.** What exists
  today is an early, narrow set of *technical controls* (read-only, no-post,
  log redaction, secret detection) that constitute **early SOC2-readiness
  preparation for the Hermes Vision control surface** only — not company-wide
  readiness. Everything else required for SOC2 is **not started / planned**.
- **C2PA / content provenance:** **Not shipping.** The branch name references
  C2PA as a research direction only. There is no provenance signing in this
  checkout.
- **Customers / metrics:** None. This pack contains **no customers, metrics,
  testimonials, or logos** by design.

## Read next

- [What is real vs mock](./real-vs-mock.md)
- [What remains prohibited](./prohibited.md)
- [Claim provenance table](./claim-provenance.md)
- Demo script: [`../sales-closer/demo-script.md`](../sales-closer/demo-script.md)
- Pilot checklist: [`../sales-closer/client-zero-pilot-checklist.md`](../sales-closer/client-zero-pilot-checklist.md)
