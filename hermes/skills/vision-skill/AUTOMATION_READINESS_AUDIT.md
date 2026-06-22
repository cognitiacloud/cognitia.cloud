# Automation Readiness Audit — Hermes Vision Skill

**Scope:** `hermes/skills/vision-skill/` (only code in the repo)
**Branch audited:** `claude/automation-readiness-audit-y85ilq` (identical tree to
`claude/ep002-mission-run-pPoba`)
**Date:** 2026-06-22
**Mode:** Audit only — no functional code changed. Evidence gathered by running
the suite, the CLI, and the OCR path in this environment.

---

## What this repo actually is

A single, **read-only** vision QC skill: `analyze_image`, `compare_portraits`,
`privacy_scan`, `video_frame_qc`. It inspects portraits / screenshots / video
frames and returns structured JSON verdicts (`publish_safe`, `recommended_action`,
scores). It is a **gate**, not a pipeline. By explicit design it:

- never posts, uploads (except to an operator-configured vision provider), or
  deletes anything;
- has no scheduler, no approval workflow, no rendering/HeyGen integration, no
  deployment or infra, and no CI.

This framing drives the scores below: the dry-run / inspection surface is real
and tested; the "live automation" surface largely does not exist in this repo.

## Evidence collected

| Check | Result |
|---|---|
| `python3 test_vision_skill.py` | **13/13 pass** (after `apt-get install tesseract-ocr`, `pip install Pillow pytesseract`) |
| CLI `provider` / `privacy` / asset generation | Work end-to-end on the OCR-only path |
| LLM provider paths (openai/anthropic/gemini/openrouter/ollama) | **0 tests**, no mocks/fixtures, no live run (no keys present) |
| `video_frame_qc --video` (ffmpeg) | Not exercised — ffmpeg not installed, no test |
| OCR secret-extraction reliability | **Degraded** — see blocker B1 |
| CI / workflows / infra | **None found** |

---

## Score Table

| Axis | Score /100 | Verdict | Basis |
|---|---|---|---|
| **Dry-run automation readiness** | **84** | Ready | OCR-only path is real, read-only, runs with no keys; 13/13 tests pass; CLI + MCP entrypoints verified. Held back by no CI, unpinned deps, manual system deps. |
| **Controlled-live readiness** | **52** | Not ready | Provider code exists for 5 backends but is **code-only**: no tests, no mocked/replayed HTTP, no live-run evidence, no operator UI. Fails the "code + tests + UI/evidence" bar for 80. |
| **Actual live automation readiness** | **22** | Not ready | No posting, no approvals, no scheduler, no infra/deploy, no CI. The skill cannot drive any live action; it only emits booleans. |
| **Alta automation parity** | **28** | Not ready | "Alta" is undefined in-repo (no spec/config/reference). Measured against a full autonomous content pipeline, this delivers one QC gate of many. |

**Strictness note:** no axis is inflated to 80+ on docs alone. The only 80+
(dry-run) is backed by a passing run captured above, not by the README.

---

## Blockers

### Controlled-live (must close to reach 80)

- **B1 — OCR corruption silently defeats secret detection (safety-critical).**
  On `screenshot_secret.jpg`, raw OCR produced `sk-TES TONLY…` (injected space)
  and `eyJ…Imnopqrstuv.` (l→I, injected space). The `sk-` and JWT regexes
  therefore **missed** both; only the intact `ghp_` token matched.
  `publish_safe=False` held in this case *only* because email + financial data
  also matched. A frame containing **only** a corrupted key/JWT would be reported
  `publish_safe=True`. The README's "any token detected → forced reject"
  guarantee is not reliably enforceable on the OCR-only path. Needs: OCR
  pre-normalization (strip spaces / OCR-confusable folding before regex),
  fuzzy/entropy-based secret heuristics, and/or mandatory LLM-vision confirmation
  before any "safe" verdict.
- **B2 — LLM provider paths are untested.** `_call_openai/_anthropic/_gemini/
  _openrouter/_ollama` have no unit tests, no mocked transport, and no recorded
  fixtures. Response-shape drift would surface only in production. Needs mocked
  HTTP tests per provider + at least one recorded live transcript.
- **B3 — No operator evidence/UI.** No screenshots, sample verdict artifacts, or
  review surface demonstrating a human-in-the-loop controlled run with a real
  provider. The 80 bar explicitly requires UI/evidence.
- **B4 — `video_frame_qc --video` path unverified.** ffmpeg extraction is
  untested and ffmpeg is an unpinned external dependency.

### Actual-live (structural — these are the reason it stays ~22)

- **B5 — No publishing/automation layer exists.** Nothing renders, schedules, or
  posts. This skill is a gate with no pipeline behind it.
- **B6 — No approval/governance infrastructure.** No human-approval gate,
  audit log persistence, role/permission model, or rollback. Booleans returned to
  a caller that does not exist in-repo.
- **B7 — No CI/CD or deployment.** No GitHub Actions, no environment promotion, no
  monitoring/alerting. Cannot assert the suite stays green or that a deployed
  version matches the audited tree.

### Alta parity

- **B8 — No Alta reference in repo.** Parity cannot be objectively measured; the
  comparison target (Alta's pipeline stages, gates, SLAs) must be supplied.
- **B9 — Single-component coverage.** Even granting Alta = full autonomous
  pipeline, this covers only pre-publish visual QC — missing ideation, scripting,
  render, caption, schedule, post, and feedback loops.

---

## Recommended order to raise scores

1. Close **B1** (secret-detection robustness) — it is safety-critical and gates
   trust in every "safe" verdict.
2. Add provider mocks + one recorded live transcript (**B2**), capture operator
   evidence (**B3**) → unlocks controlled-live ≥ 80.
3. Add CI running the suite on every push (**B7**) → firms up dry-run toward 90.
4. Supply the Alta spec (**B8**) before re-scoring parity.
5. Treat actual-live as a separate epic: posting + approvals + infra are net-new
   build, not hardening of this skill.
