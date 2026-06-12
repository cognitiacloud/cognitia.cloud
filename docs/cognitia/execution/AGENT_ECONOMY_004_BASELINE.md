# AGENT-ECONOMY-004 Baseline

- **Branch:** `claude/agent-economy-004-marketplace-matching`
- **Base:** `claude/agent-economy-003-agent-actions` (PR #51 — green, unmerged at branch time; #48→#49→#51 stack unmerged).
- **Pre-coding checks:** `pnpm install --frozen-lockfile` clean; `pnpm check` **430/430 tests, 66 files, green** (matches #51 body).
- **Authorization:** AGENT-ECONOMY-004 falls under the operating-plan §0a "forbidden thesis pivots" (agent economy / marketplace). It was explicitly re-authorized by the owner and that re-authorization is recorded in `docs/competitive/operating-plan.md §0a` (the lab is treated as the deliberate, in-writing carve-out §0a requires).
- **Migration number:** highest existing was `0017`; this sprint adds `0018_marketplace_listings.sql`.
- **Scope guardrails honored:** internal/tenant/private only; no public marketplace; no token pricing; no real payments; no token transfers; no production deploys; no production migrations applied (migration file added, not run against prod).
