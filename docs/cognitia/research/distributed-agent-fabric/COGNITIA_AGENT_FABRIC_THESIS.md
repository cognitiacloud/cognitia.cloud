# Cognitia Agent Fabric — Thesis (design-only)

## One sentence
A resilient, cross-platform fabric that routes agent tasks across user-owned and
cloud machines, where every unit of work carries portable, **verifiable proof**
and settles through Cognitia's proof-backed economy.

## The gap it fills
- Orchestrators (cmux, LangGraph, CrewAI, n8n) run agents but don't **prove** the
  work or settle it economically, and are mostly single-machine or single-cloud.
- Networks (Tailscale/WireGuard) connect machines but don't understand agents,
  capabilities, or trust.
- Standards (ERC-8004, x402, VC) define identity/payments but not a running,
  proof-gated work fabric.
- **Cognitia already has the missing middle**: ATC, SkillProof, Proof Registry,
  Reputation, Work Orders, Credits/Escrow, Marketplace, Disputes — tested and
  runtime-verified. The fabric is the *distribution layer* for that middle.

## What it enables (design)
- Route a task to the right place: local LLM for privacy/cost, cloud LLM for power,
  a specific machine for its tools/data, or an external agent (Claude/Codex/MCP).
- Each execution produces a **proof-backed receipt** (what ran, where, with what
  evidence tag) recorded in the Proof Registry.
- Workers/nodes earn **reputation** only on `verified_fact` receipts; payment
  (internal credits today) releases from **escrow** only on verified work.
- Capabilities are **discoverable** via the marketplace; failures go to **disputes**.

## Why it's credible (not hype)
- It is *composition*, not magic: mesh + capability registry + router + signed
  receipts + the existing economy. Each piece exists or is well-understood.
- The novelty is binding **verifiable proof + economics** to distributed agent
  execution — which is exactly Cognitia's differentiated layer.

## Positioning
"Verifiable agent work across compute you control." Continuity + sovereignty +
proof — never an evasion or unstoppable-infrastructure pitch.

## Status & scope
Design-only. No production code, no Tailscale/cloud-execution implementation in
this sprint. MVP sequencing in `MVP_ROADMAP.md`; risks in `RISKS_AND_FALSE_CLAIMS.md`.
