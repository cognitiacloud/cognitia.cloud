# Review — PR #105: Add file-based goal loop harness (`hctl`)

- **PR:** [#105](https://github.com/cognitiacloud/cognitia.cloud/pull/105) — `claude/cognitia-goal-loop-harness-xd6laa` → `main` (draft)
- **Scope of this review:** verify the file-based goal-loop harness is safe and useful. No source changes made — review only.
- **Date:** 2026-06-21
- **Method:** full read of `harness/hctl.py` (495 lines), schemas, templates, research note, and the committed `goals/gtm-research/` example; plus an isolated end-to-end smoke test run in `/tmp` (no repo or system writes) exercising all eight subcommands and adversarial inputs.

---

## Verdict: NEEDS FIX (minor — non-blocking for manual use)

The harness is original, dependency-free, and genuinely useful as a bookkeeping
ledger. Counters, stop conditions, atomic writes, and clean-room provenance all
check out. **One real gap:** the advertised "only ever writes under `goals/`"
invariant is **not enforced** — a malformed `slug` (absolute path or `..`)
writes outside `goals/` (and an absolute slug crashes after doing so). It is a
one-line guard. Safe to use **today** for founder-driven manual tracking with
well-formed slugs; the guard should land before any automated/agent-driven
invocation.

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

### 5. Generated markdown vs. Prettier — ✅ not an active risk

The repository currently has **no** Prettier, markdownlint, ESLint, CI workflow,
or `package.json` anywhere — so there is nothing for the generated markdown to
break today. The committed example files (`goals/gtm-research/*.md`,
`harness/README.md`) scan **clean**: no trailing whitespace, single trailing
newline, no double blank lines, no tabs.

One latent edge case: when a field like `objective` is empty (a freshly
`init`-ed goal), `report` emits a collapsible double blank line in
`final-report.md` (`harness/hctl.py:383-384`) — Prettier would normalize it on
first run.

**Recommendation:** if/when Prettier is adopted, add `goals/` to
`.prettierignore`. These files are machine-generated and appended on nearly every
command, so excluding them avoids a perpetual format-churn loop regardless of the
edge case above. Optionally guard empty fields in `report`.

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

**Yes, with one caveat.** As an auditable, git-diffable ledger for goals, runs,
checkpoints, artifacts (sha256-indexed), risks, founder decisions, and stop
conditions, it is well-designed and low-risk: derived counters, atomic state
writes, append-only history, and a clean execution/bookkeeping separation (it is
*not* an executor — loop control stays with the operator).

- **Manual / founder-driven use now:** fine as-is with sensible slugs.
- **Automated or agent-driven use:** add the slug-validation guard (finding #1)
  first, so the "writes only under `goals/`" guarantee actually holds against
  untrusted input. Consider the smoke test (#4) and `.prettierignore` (#5) as
  cheap follow-ups.

Per the review scope, **no source files were modified** in producing this
assessment; the fixes above are recommendations for the PR author.
