# CMUX — Concept Study (design input, not affiliated)

**Status**: `likely_inference` from public descriptions (WebSearch); exact internals
unverified (egress-limited). Not affiliated; not reverse-engineering proprietary
code — a conceptual study to inform Cognitia's *distributed* fabric design.

## What cmux appears to be (public descriptions)
- A native **macOS** terminal app (built on Ghostty) from Manaflow AI (Lawrence
  Chen, Austin Wang), open source AGPL-3.0, launched ~Jan 2026.
- Purpose: run **multiple AI coding agents in parallel** (Claude Code, Codex,
  Gemini CLI, Opencode) each in an **isolated workspace** (local Docker container
  or cloud sandbox) with its own VS Code instance, terminal, and git state.
- A **primary agent** can orchestrate sub-agents, monitor progress, gather results.
- Per-agent **git diff review**, notifications, isolation to prevent overlapping changes.

## What is valuable about the model
- **Isolation per agent run** (clean env, separate git state) — strong safety idea.
- **Orchestrator → workers** pattern with result aggregation.
- **Human-in-the-loop review** (diff viewer, confirm tests) before changes land.

## What cmux is NOT (the gap Cognitia would fill)
- `likely_inference` — Single-machine, macOS-centric; not a cross-platform,
  multi-machine **distributed** fabric.
- No portable, **verifiable proof** of what each agent did (beyond local git diff).
- No **economic** layer (identity, capability proof, reputation, escrow, disputes).
- No **private-network mesh** across user-owned machines.

## Design takeaways for Cognitia's distributed fabric
1. Keep cmux's **isolation-per-run** and **human review** primitives.
2. Generalize "workspace" to a **node** that can live on any OS or cloud machine,
   reachable over a private mesh (Tailscale/WireGuard).
3. Replace "trust the local git diff" with **proof-backed execution receipts**
   anchored in Cognitia's Proof Registry.
4. Add the economic layer cmux lacks: ATC identity, SkillProof capability,
   reputation, work orders, escrow, disputes.

## Unsafe claims to avoid
Do not claim to "reverse engineer" or copy cmux; do not imply affiliation or
endorsement; treat all specifics as unverified public description.
