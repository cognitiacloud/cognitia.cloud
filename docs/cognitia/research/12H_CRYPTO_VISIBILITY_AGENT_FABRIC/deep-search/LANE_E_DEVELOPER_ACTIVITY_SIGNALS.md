# LANE E — Developer-Activity Signals

**Objective**: The engineering signals researchers use to judge whether a project
is real.

**Sources**: due-diligence guides (LANE C sources note "polished site but inactive
GitHub for months" as a red flag); general OSS practice.

## Signals + Cognitia status

| Signal                                     | Cognitia                                                  |
| ------------------------------------------ | --------------------------------------------------------- |
| Active commit history                      | `verified_fact` — sustained, recent (V-4/4b/4c/5)         |
| Tests that actually run                    | `verified_fact` — 490 passing, 74 files                   |
| Tests on real infra, not mocks             | `verified_fact` — contract runs on PGlite (real Postgres) |
| PR history + review trail                  | `verified_fact` — stacked PRs #48–#63 merged              |
| Reproducible demo/smoke                    | `verified_fact` — `economySmoke.live.test.ts`             |
| Migrations + schema discipline             | `verified_fact` — ordered SQL migrations 0001–0018        |
| CI green on main                           | `verified_fact` — build-test green                        |
| Docs co-located with code                  | `verified_fact` — `docs/cognitia/**`                      |
| Public changelog / release notes           | `GAP` — no formal releases/tags surfaced                  |
| Reproducibility instructions for outsiders | `GAP` — README "run this to verify" path thin             |

## Findings

- `likely_inference` — Cognitia is in the top decile of AI-crypto projects on raw
  engineering signal; the weakness is _legibility to outsiders_, not substance.

## Recommended actions

- Add a public "verify it yourself" section (clone → `pnpm check` → expected
  490/490 → run the economy smoke). This converts internal rigor into a researcher-
  checkable claim.
- Consider lightweight release tags tied to milestones.

## Public-safe wording

"Clone the repo and run the suite: a researcher can reproduce the 490-test green
state and the live agent-economy smoke loop themselves."

## Unsafe claims to avoid

No claim of production hardening or uptime; tests ≠ production readiness.
