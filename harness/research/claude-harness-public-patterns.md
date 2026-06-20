# Public Harness Patterns — Clean-Room Research Notes

Research backing the design of the Cognitia goal loop harness (`harness/`).
The goal was to learn *general architectural patterns* from public sources,
then implement our harness **independently** in a stdlib-only, file-based style.

**Provenance rule applied throughout:** no proprietary, confidential, or leaked
code was read, copied, downloaded, or vendored. Where a "leak" is referenced
below, only the *publicly discussed, high-level architecture* is summarized, and
it is explicitly marked **UNSAFE TO COPY**. Our implementation is original.

_Compiled: 2026-06-20._

---

## 1. Official Claude / Claude Code patterns (safe to learn from)

Source: Anthropic's public Claude Agent SDK docs.

- **Agent loop.** The agent evaluates state → may emit text and/or request tool
  calls → tools run → results feed back → repeat until a turn has no tool calls.
- **Stop conditions.** The loop terminates naturally when no tools are called,
  and can be capped explicitly (e.g. `max_turns`, cost/budget limits).
- **Tool gating / permissions.** Tool calls can be intercepted, deferred, or
  denied (hooks, permission modes, OS sandboxes) *before* they run.
- **Layered, cache-aware context.** System prompt assembled from distinct
  segments (base behavior, tool guidance, project context, session state).
- **Externalized memory.** Repo-local instruction files (e.g. `CLAUDE.md`,
  `AGENTS.md`) and on-disk todo/state files survive context limits.

**What we adopted (clean-room):** explicit, declarative **stop conditions**
(`max_runs`, `deadline`, manual/criteria flags) evaluated each checkpoint; a
clear separation between durable state and the live "loop"; the principle that
**scaffolding should shrink** as models improve (kept the CLI deliberately thin).

Sources:
- <https://platform.claude.com/docs/en/agent-sdk/agent-loop>
- <https://code.claude.com/docs/en/agent-sdk/overview>

## 2. Public open-source harness ideas (safe to learn from)

- **LangGraph** — graph/state-machine framework for multi-agent harnesses;
  models supervisor/subagent topologies, retries, escalation, and **checkpoint
  persistence** as first-class primitives. License: MIT (per its repo).
- **AGENTS.md** — lightweight open format for repo-local agent instructions.
- **AURA** (platformengineering.org write-up) — writes detailed **execution
  artifacts** (plans, prompts, responses, tool-call records) to disk per
  iteration for post-hoc observability.
- **"awesome-harness-engineering"** lists — catalog the recurring concern areas:
  context/memory, tools/actions, orchestration/loop, **state & persistence**,
  sandbox/compute, **observability/governance**, cost optimization.

**What we adopted (clean-room):** per-iteration artifacts written to disk
(`runs.jsonl`, `artifacts/index.jsonl`) for observability; checkpoint/resume
thinking (our `state.json` snapshot + append-only logs); the "seven concern
areas" as a checklist to make sure goals, workers, runs, checkpoints, artifacts,
risks, decisions, and stop conditions all have a home.

**What we did NOT adopt:** graph/state-machine runtime, live orchestration,
sandboxes, or any network/execution layer — out of scope for a file-based MVP.

Sources:
- <https://github.com/ai-boost/awesome-harness-engineering>
- <https://github.com/walkinglabs/awesome-harness-engineering>
- <https://platformengineering.org/blog/aura-building-open-agentic-harness-for-production-AI>
- LangGraph: <https://github.com/langchain-ai/langgraph> (MIT)

## 3. The "Claude Code leak" references — UNSAFE TO COPY

In late March 2026 a source-map packaging mistake publicly exposed a large
amount of Claude Code's TypeScript. Numerous third-party articles dissect its
architecture, and Anthropic issued DMCA takedowns against mirrors/forks.

> **UNSAFE TO COPY.** This is proprietary Anthropic source. We did **not** open,
> clone, download, vendor, or copy any of it, and nothing in our harness derives
> from it. It is recorded here only to (a) acknowledge the prior art and (b)
> draw a hard line around it.

**General, already-public architectural *ideas* (not code) commonly attributed
to it** — and how we relate to them:

| Public idea (high level) | Our (independent) treatment |
| --- | --- |
| Tool-calling loop until no tool calls | We are not an executor; loop control is the operator's. We only record runs. |
| Persistent / layered memory & state | `state.json` snapshot + append-only JSONL logs. |
| Permissions / tool gating | Out of scope; noted as belonging to the executor, not the ledger. |
| Per-step execution artifacts | `runs.jsonl`, `decisions.jsonl`, `artifacts/index.jsonl`. |
| "Harness shrinks as models improve" | Explicit design principle in our README. |

Sources (third-party commentary only; **do not** use them to obtain the code):
- <https://github.com/topics/claude-code-leaked> (referenced, not used)
- <https://www.digitalapplied.com/blog/claude-code-leak-agentic-architecture-lessons-2026>
- <https://superframeworks.com/articles/claude-code-source-code-leak>
- <https://medium.com/@savelis.pedro/ai-harness-engineering-what-512-000-lines-of-claude-code-leak-taught-us-e7809a9cef04>

## 4. Clean-room design choices we adopted

1. **File-based, stdlib-only.** Zero dependencies, no network, no secrets —
   safe to run in any environment and trivially auditable via git diff.
2. **State / history split.** `state.json` is the rebuildable snapshot;
   `*.jsonl` are immutable, append-only history. Counters are *derived* from the
   logs and re-synced on every write, so they cannot silently drift.
3. **Declarative stop conditions**, evaluated at each checkpoint.
4. **Founder decisions as first-class, append-only records** — an auditable
   governance trail distinct from worker runs.
5. **Artifact index with sha256** for integrity and dedup.
6. **Thin scaffolding by intent** — the CLI does bookkeeping only; orchestration
   and execution stay outside, so the harness can shrink rather than grow.

## 5. Licenses / provenance summary

- Official Anthropic docs: referenced for concepts only.
- LangGraph: MIT (patterns are freely reusable; we reused none of its code).
- AGENTS.md / AURA / awesome-lists: public articles & specs, concept-level only.
- Claude Code leak: **proprietary, UNSAFE TO COPY, not used.**
- This harness: original work, standard library only.
