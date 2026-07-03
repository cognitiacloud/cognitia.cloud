# 17 — Source Inventory and Visibility Map

This file explains what Hermes used as context without requiring Claude/Fable to access local Obsidian paths.

## Source aliases used

| Alias | Included here? | Treatment |
|---|---|---|
| PRODUCT_SPINE | Yes | This repository/worktree. Builder should inspect directly. |
| PRODUCT_REPO_ROOT | Reference only | Secondary repo reference; no copy included. |
| HERMES_MASTER_REPORTS | Summarized | Business/revenue and agent economy context. |
| HERMES_2026_07_02_ROADMAPS | Summarized | Budget Wheels/dealer demo context. |
| HERMES_2026_06_27_ROADMAPS | Summarized | Product spine and execution roadmap. |
| TOOLING_GATE_REPORTS | Summarized | TypeScript/Vitest/diff-check evidence context. |
| MANAGER2_W_AND_GOVERNANCE_PACKETS | Summarized | Review/canon/governance boundaries. |
| DEALER_DEMO_FRAME_ROOT | Summarized | Static-frame/demo context only. |
| COGNITIA_REPUBLIC_OUTPUT_ROOT | Summarized | Demand/content engine context only. |
| MOVEROS_REFERENCE | Summary only | PR #30 summary only; no MoverOS code copied. |
| BUDGET_WHEELS_REFERENCE | Summary only | Internal demo/design summaries only; no raw customer/prospect data. |

## Skipped sensitive handling

No raw secrets, env files, customer exports, lead exports, subscriber exports, database dumps, raw egress maps, deployment credentials, MoverOS source, or raw Budget Wheels customer/prospect material were copied.

## Current repo visibility warning

The product-spine worktree had pre-existing dirty/untracked changes before this packet. This packet only stages and commits files under:

```text
docs/claude-context/demandara-gtm-os/
```

Do not assume other dirty files are part of this packet unless separately reviewed.
