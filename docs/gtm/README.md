# Cognitia / Demandara — GTM Consolidation Pack

**Author:** Worker A (GTM / Competitor Research)
**Date:** 2026-06-20
**Status:** Branch-level index (fast). Workstream mapping is inferred from branch names + commit dates — **not** a content audit. No branch below is certified production-ready.

## What this pack is

A fast, decision-grade index of the ~36-hour multi-agent build that currently lives across **~110 unmerged `claude/*` branches**, mapped into 12 GTM workstreams, with a consolidation plan that prioritizes **integration over net-new build**.

> **Correction up front:** Cognitia is **not** a video/avatar company. The Hermes Vision Skill (on `main`) is **one verified artifact**, not the whole company. The real thesis is **Demandara** (GTM/sales brand) shipping **Sales Closer** (AI voice+text sales agent), with an **auto dealership as Client Zero**.

## The brutal verdict (read this first)

1. **The work exists** — ~110 branches of real, recent, on-thesis effort.
2. **The work is not centralized** — almost none of it is on `main`.
3. **The repo is carrying too many parallel unmerged lanes** — with visible duplicates.
4. **The immediate priority is consolidation, not more net-new build.**
5. **Review the few critical-path branches first** (Client Zero / Sales Closer / compliance) — ignore the long tail for now.

## Documents

| File                                                     | Purpose                                                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [`CONSOLIDATION.md`](./CONSOLIDATION.md)                 | The operational index: verdict, workstreams, priority, queues, 7-day plan                                    |
| [`branch-inventory.md`](./branch-inventory.md)           | Full 110-branch table: name, date, workstream, tier, disposition, duplicate-of                               |
| [`workstream-map.md`](./workstream-map.md)               | The 12 workstreams with scope + critical-path notes                                                          |
| [`deep-dive-queue.md`](./deep-dive-queue.md)             | The few branches to review first, with per-branch checklist                                                  |
| [`7-day-merge-plan.md`](./7-day-merge-plan.md)           | Day-by-day consolidation runbook                                                                             |
| [`evidence-ledger.md`](./evidence-ledger.md)             | Every claim → source + date; **verified facts vs inference**                                                 |
| [`competitor-teardown.md`](./competitor-teardown.md)     | _(Secondary)_ Market context: Alta/Clay/Apollo/SalesCloser.ai/Lindy/Vapi/Retell/n8n/auto lead-gen/dealer CRM |
| [`parity-vs-superiority.md`](./parity-vs-superiority.md) | _(Secondary)_ Parity vs superiority table                                                                    |

## Decisions on record (from manager)

- **WS12 (Agent Economy + Crypto Visibility):** Parked Strategic R&D — strategically relevant, execution-paused. Tag + freeze, **keep branches in place** (no archive, no delete). Revisit post-pilot.
- **Duplicate lanes:** Worker A recommends a canonical branch per set (criteria in `deep-dive-queue.md`); loser branches are **marked superseded candidates pending manager review** — nothing is closed automatically.
