# Cognitia v1.1 — Discovery Report

Date: 2026-06-11
Author: Fable 5 discovery session (Step 1, COG-001)
Status: COMPLETE — discovery only, no product code written.

Evidence tags used throughout: `verified_fact` | `likely_inference` | `unknown`.

---

## 1. Repo root

`/home/user/cognitia.cloud` — `verified_fact` (from `pwd`).

Remote repository: `cognitiacloud/cognitia.cloud` on GitHub — `verified_fact` (session repo scope + git remote branches under `origin/`).

## 2. Current branch

`claude/cognitia-v1-1-discovery-g6ryrg` — `verified_fact` (from `git branch --show-current`).

## 3. Latest commit

`0dfb0ad Add hermes vision skill (local OCR + multi-provider vision QC)` — `verified_fact` (from `git log --oneline -5`).

This is the **only commit in the entire repository history** (`git log --all --oneline` returns exactly one commit) — `verified_fact`.

Branches that exist: `claude/cognitia-v1-1-discovery-g6ryrg` and `claude/ep002-mission-run-pPoba` (local + origin). Both point at the same commit `0dfb0ad`; `git diff` between them is empty — `verified_fact`.

## 4. Dirty files / untracked files

None. `git status` reports "nothing to commit, working tree clean" — `verified_fact` (as of discovery start, before this report was written).

## 5. Package manager

**None at the repo level.** No `package.json`, `pnpm-lock.yaml`, `yarn.lock`, `pyproject.toml`, `go.mod`, `Cargo.toml`, or `Gemfile` anywhere in the repo — `verified_fact` (from `find` over the whole tree; total file count is 14 files, all under `hermes/skills/vision-skill/`).

The only dependency file is `hermes/skills/vision-skill/requirements.txt` (pip; `Pillow`, `pytesseract`, optional `mcp`) — `verified_fact`.

## 6. Framework

**No application framework exists.** No Next.js, Remix, Rails, Django, FastAPI, Express, etc. — `verified_fact` (full file listing inspected).

The repo is a **greenfield monorepo seed**. The only code is a standalone Python 3 script (`vision_skill.py`, 677 lines) exposing a CLI and an optional MCP stdio server — `verified_fact`.

## 7. App structure

```
/home/user/cognitia.cloud/
└── hermes/
    └── skills/
        └── vision-skill/
            ├── vision_skill.py          (677 lines, CLI + MCP server)
            ├── test_vision_skill.py     (185 lines, unittest)
            ├── requirements.txt
            ├── skill.yaml               (Hermes skill manifest, read_only: true)
            ├── .mcp.json
            ├── README.md
            ├── .gitignore
            └── test_assets/             (generated jpgs + generator script)
```

`verified_fact` (from `find` + file reads).

What the vision skill does (relevant to Cognitia): local, read-only vision QC — image analysis, portrait comparison, **OCR + regex privacy scanning** (emails, phones, API keys, file paths, financial data → `publish_safe` boolean), and video frame QC. Multi-provider (OpenAI/Anthropic/Gemini/OpenRouter/Ollama) with an offline `ocr_only` fallback. It refuses to mark images publish-safe when secrets are visible — `verified_fact` (README.md, skill.yaml, test file inspected).

Strategic relevance: this existing privacy-scanner posture (redaction, `publish_safe` gating, evidence-style structured JSON output) is directly aligned with the Proof Registry privacy requirements and can be reused as the prototype for proof redaction checks — `likely_inference`.

## 8. API structure

**None exists.** No HTTP API routes anywhere in the repo — `verified_fact`.

## 9. Database technology

**None exists.** No schema files, no ORM config, no SQL, no Prisma/Drizzle/SQLAlchemy/ActiveRecord — `verified_fact`.

Note: this Claude session has Supabase MCP tools available, suggesting the founder has a Supabase account that could host Postgres — `likely_inference` (tool availability observed; no project verified). Whether a Supabase project exists or should be canonical is `unknown` → decision point for Prompt 2.

## 10. Migration system

**None exists** — `verified_fact`.

## 11. Existing tests

One test file: `hermes/skills/vision-skill/test_vision_skill.py` (Python `unittest`, designed to run without cloud keys via OCR-only path) — `verified_fact` (file read; **not executed** in this session — system deps `tesseract-ocr` not verified installed, so pass/fail status is `unknown`).

## 12. Existing relevant models

**No lead, customer, agent, action, decision, payment, credential, proof, skill-registry, reputation, credits, or wallet models exist** — `verified_fact` (complete file listing inspected; only the vision skill exists).

## 13. Existing lead/CRM/payment/agent-related code

None — `verified_fact`.

## 14. Existing auth / tenant / permission system

None — `verified_fact`.

## 15. Build/test commands discovered

- Vision skill tests: `python3 hermes/skills/vision-skill/test_vision_skill.py` (per its docstring; requires `pip install -r requirements.txt` and system `tesseract-ocr`) — `verified_fact` (commands documented in repo; execution success `unknown`).
- No repo-level build, lint, or test commands exist — `verified_fact`.

## 16. Unknowns

| # | Unknown | Impact |
|---|---------|--------|
| U1 | Whether a separate "canonical MoverOS repo" exists outside this repo | Determines where Lane A demo is built. Kill-gate: if unclear by Day 7, build demo here. |
| U2 | Whether a Supabase/Postgres project already exists for Cognitia | Determines DB hosting choice in Prompt 2. |
| U3 | Whether the vision-skill tests pass in this environment | Low impact; not on critical path. |
| U4 | Founder's preferred deploy target (Vercel MCP tools are present in session → possibly Vercel, `likely_inference`) | Affects framework choice confirmation. |
| U5 | Purpose of branch `claude/ep002-mission-run-pPoba` (identical content, no extra commits) | None — informational only. |
| U6 | Inlet/warm-network contact list and pilot commitments | Business blocker for Lane A revenue proof, not a code blocker. |

## 17. Blockers

- **No hard technical blockers for Step 1** (this document set). `verified_fact` — all Step 1 outputs are docs.
- **B1 (for Prompt 2):** A framework/stack decision must be ratified before schema work. This report recommends one (see Architecture Lock §9 / Command Book §0), tagged as recommendation, not existing fact.
- **B2 (for Lane A live SMS):** No SMS provider credentials exist in repo; real SMS sending is human-approval-gated per doctrine. Simulation-first is mandatory.

## 18. Recommended implementation branch

- This Step 1 doc work: `claude/cognitia-v1-1-discovery-g6ryrg` (current branch, as instructed) — `verified_fact`.
- Future implementation: one short-lived branch per ticket, named `claude/cog-NNN-<slug>` (e.g. `claude/cog-002-schema-foundation`), merged via draft PRs — recommendation (`likely_inference` that small per-ticket branches are safest given single-commit history and multi-agent execution).

## 19. Confidence levels for major conclusions

| Conclusion | Tag | Confidence |
|---|---|---|
| Repo is greenfield except for the Hermes vision skill | verified_fact | High |
| No DB / API / framework / auth / models exist | verified_fact | High |
| Repo `cognitiacloud/cognitia.cloud` is the intended home for Cognitia v1.1 build | likely_inference | Medium-high (task instructions target this repo; no competing repo visible) |
| Vision skill's privacy scanner is reusable for proof redaction | likely_inference | Medium |
| Supabase and Vercel are available founder infrastructure | likely_inference | Medium (MCP tools present; no project verified) |
| Canonical MoverOS repo location | unknown | — |
| Recommended stack (Next.js + TypeScript + Prisma + Postgres/SQLite) | recommendation, not yet ratified | — |
