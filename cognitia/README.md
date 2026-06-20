# Cognitia 36-Hour Agentic Loop

> **Canonical identity:** Cognitia is the **neutral proof/trust layer above
> agents and workflows** ("trust the receipt, not the agent"). Hermes / media
> artifacts are **support capabilities, not the company identity** — Cognitia
> is not a video pipeline or "Cognitia Studio."

This directory holds the artifacts, research, specs, and prototypes produced by
the 36-hour Cognitia Agentic Loop (started 2026-06-20).

> **Read [`loop/GUARDRAILS.md`](loop/GUARDRAILS.md) first.** It defines the
> hard-stop boundaries and the VERIFIED / INFERRED / RECOMMENDED /
> UNSAFE classification every artifact uses.

## Layout

```
cognitia/
  README.md                     ← you are here
  loop/
    GUARDRAILS.md               hard-stop boundaries + classification legend
    ROADMAP.md                  living roadmap (updated each checkpoint)
    ARTIFACT_INDEX.md           index of every artifact produced
    checkpoints/                6-hourly checkpoint reports
    prompts/                    Claude prompts for the next loop
  workers/
    A-gtm-competitor-research/  competitor maps, GTM teardown, positioning
    B-client-zero-auto-growth-os/  dealership Auto Growth OS spec + mock flows
    C-ads-media-house/          ads/media engine spec, creative test plans
    D-agent-economy-token-sandbox/ internal token/credit sandbox design
    E-harness-builder/          file-based goal-loop harness prototype + spec
```

## Status

See the latest file in `loop/checkpoints/`. The mission, cadence, and worker
roster are defined by the loop manager and tracked in `loop/ROADMAP.md`.

## What this is NOT

This loop produces **research and design artifacts plus one isolated harness
MVP**. It does not launch tokens, run ads, contact leads, send messages, or
integrate any production vendor. See the hard-stop list in `GUARDRAILS.md`.
