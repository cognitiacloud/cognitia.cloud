# Review — PR #105: Add file-based goal loop harness (`hctl`)

- **PR:** [#105](https://github.com/cognitiacloud/cognitia.cloud/pull/105) — `claude/cognitia-goal-loop-harness-xd6laa` → `main` (draft)
- **Scope of this review:** verify the file-based goal-loop harness is safe and useful. No source changes made — review only.
- **Date:** 2026-06-21
- **Method:** full read of `harness/hctl.py` (495 lines), schemas, templates, research note, and the committed `goals/gtm-research/` example; plus an isolated end-to-end smoke test run in `/tmp` (no repo or system writes) exercising all eight subcommands and adversarial inputs.

---

## Verdict: NEEDS FIX (two small, well-scoped fixes)

The harness is original, dependency-free, and genuinely useful as a bookkeeping
ledger. Counters, stop conditions, atomic writes, and clean-room provenance all
check out. Two concrete gaps should land before it is relied on:

1. **The "only ever writes under `goals/`" invariant is not enforced** — a
   malformed `slug` (absolute path or `..`) writes outside `goals/` (an absolute
   slug also crashes after doing so). One-line guard.
2. **Generated markdown breaks the repo's existing Prettier CI gate.** `main`
   runs `prettier --check "**/*.{...,md,...}"` as a required check, and `goals/`
   is _not_ in `.prettierignore`. The harness writes/appends `checkpoint.md` and
   `final-report.md` on nearly every command, and that generated markdown fails
   `prettier --check` (verified). Fix: add `goals/` to `.prettierignore`.

Both fixes are tiny. Until #2 lands, even normal manual use in this repo turns CI
red on the next `checkpoint`/`report`.

---

## Safety assessment

### 1. Writes confined to `goals/` — ⚠️ NOT enforced (primary finding)

`goal_dir(slug)` is `GOALS_DIR / slug` with no validation of `slug`
(`harness/hctl.py:71-72`, `:177-211`). Python's `Path` join means a malformed
slug escapes the intended directory. Verified by direct test:

- `hctl.py init /tmp/hctl-abs-test` → wrote a **full goal tree outside the repo**
  at `/tmp/hctl-abs-test/`, then raised an **uncaught `ValueError`** from
  `dest.relative_to(REPO_ROOT)` at `harness/hctl.py:212` (files created before
  the crash).
- `hctl.py init ../../../x` → escaped `goals/` to a sibling path.

The state schema already declares the intended constraint
(`slug` pattern `^[a-z0-9][a-z0-9-]*$`, `harness/schema/state.schema.json`), but
`hctl.py` never validates against it. This **falsifies the PR's headline safety
claim** ("It only ever writes under `goals/`").

**Severity:** medium. Low likelihood under normal founder use (slugs are
hand-typed and sane), but it is an unguarded core invariant, so it matters the
moment the CLI is driven by another agent or script with untrusted input.

**Recommended fix (out of scope here — one guard):** in `cmd_init` (and
`require_goal`), reject any slug not matching `^[a-z0-9][a-z0-9-]*$` — i.e. no
path separators, no `..`, not absolute — before computing `goal_dir`. ~3 lines,
no behavior change for valid slugs.

### 2. JSONL / state counters — ✅ correct

`recompute_counters` (`harness/hctl.py:134-147`) derives `runs` / `artifacts` /
`decisions` from the append-only JSONL logs and `open_risks` from `state`, and
runs on **every** write command, so stored counters cannot silently drift.
`status` explicitly warns when hand-edited `state.json` counters diverge from the
logs (`:352-354`). `read_jsonl` skips blank lines and fails loudly with file:line
on malformed JSON (`:111-123`). `state.json` writes are atomic via
`tempfile.mkstemp` + `os.replace` (`:91-103`). Verified live: after three `run`s
the counter read `runs=3`; `risk`/`decision`/`artifact` each incremented
correctly.

### 3. Stop conditions — ✅ correct

`evaluate_stop_conditions` (`:150-171`) recomputes `max_runs` (`runs >= value`)
and `deadline` (`now >= value`, valid because ISO-8601-UTC `…Z` strings sort
lexically = chronologically) each call, and leaves `success_criteria_met` /
`manual` as human-toggled flags. Bad `max_runs` values fail closed (not
triggered). Verified live: a `max_runs=2` condition correctly reported **MET** at
`runs=3` via both `checkpoint` and `status`.

### 4. Tests — ⚠️ none for the harness

There are **no automated tests** for `hctl.py`; the PR's "Verification" section
describes manual checks only. My independent smoke test
(`init/run/decision/risk/artifact/checkpoint/status/report`) passed on Python
3.11. A small stdlib `unittest` smoke test (init → run ×N → checkpoint asserting
counters and a `max_runs` trigger) would lock in the behavior cheaply.
**Not a blocker.**

### 5. Generated markdown vs. Prettier — ⚠️ will break the existing CI gate

This is the verification point the task called out specifically, and the answer
is: **yes, the generated markdown will keep breaking Prettier** unless `goals/`
is ignored.

The repo's `main` has Prettier (`.prettierrc`, `prettier ^3.4.2`) and a
**required** CI step — `pnpm run format:check` →
`prettier --check "**/*.{ts,tsx,js,json,md,yaml,yml}"`, part of `pnpm check`
alongside typecheck and tests. The existing `.prettierignore` excludes
`node_modules/`, `dist/`, `build/`, `.next/`, `coverage/`, `pnpm-lock.yaml`, and
`hermes/` — but **not** `goals/` or `harness/`.

Verified with `prettier@3.8.3` against `main`'s `.prettierrc`:

- PR #105's **committed** markdown (all 9 files: `harness/**/*.md`,
  `goals/gtm-research/*.md`) **passes** `prettier --check`. (These were evidently
  formatted before commit.)
- **Freshly generated** markdown **fails**: after `init → run → checkpoint →
report`, both `goals/<slug>/checkpoint.md` and `final-report.md` are flagged.
  Prettier wants a blank line between a heading and a following list (the
  checkpoint/report writers emit `## Heading` immediately followed by `- item`,
  e.g. `harness/hctl.py:319-326`, `:395-410`) and collapses the empty-`objective`
  double blank line (`:383-384`).

Because the harness writes/appends these files on nearly every command, normal
operation will repeatedly produce markdown that the required CI check rejects.

**Recommended fix (out of scope here):** add `goals/` to `.prettierignore`
(mirroring how `hermes/` is already excluded) — these are machine-generated and
frequently appended artifacts. Optionally also make the `report`/`checkpoint`
writers Prettier-canonical (blank line after headings, skip empty fields) so the
output stays clean even if not ignored.

### 6. No leaked Claude harness code — ✅ confirmed

`harness/research/claude-harness-public-patterns.md` explicitly marks the
late-March-2026 Claude Code source leak **UNSAFE TO COPY**, states nothing
derives from it, and cites only clean sources (Anthropic public docs,
LangGraph/MIT, AGENTS.md, AURA) plus third-party commentary "referenced, not
used." The code itself is plain stdlib bookkeeping (argparse + json + jsonl +
sha256) with no resemblance to Claude Code internals — no tool runtime, no
permission engine, no agent loop. **No leaked or proprietary code is present.**

Additionally consistent with the stated safety envelope: stdlib-only, no network,
no DB, no secrets, no subprocess/exec, no MCP, no app/production code touched. The
only filesystem reach outside `goals/` is a **read** in `artifact` to hash a file
anywhere on disk (`:274-297`) — benign.

---

## Should you use it for future execution tracking?

**Yes, once the two fixes land.** As an auditable, git-diffable ledger for goals, runs,
checkpoints, artifacts (sha256-indexed), risks, founder decisions, and stop
conditions, it is well-designed and low-risk: derived counters, atomic state
writes, append-only history, and a clean execution/bookkeeping separation (it is
_not_ an executor — loop control stays with the operator).

- **Before any use in this repo:** add `goals/` to `.prettierignore` (finding
  #5), otherwise the required `format:check` CI goes red on the first
  `checkpoint`/`report`.
- **Before automated or agent-driven use:** also add the slug-validation guard
  (finding #1), so the "writes only under `goals/`" guarantee holds against
  untrusted input. The smoke test (#4) is a cheap follow-up.

Per the review scope, **no source files were modified** in producing this
assessment; the fixes above are recommendations for the PR author.
