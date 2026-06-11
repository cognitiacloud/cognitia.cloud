# COG-005/006 (Mission Pack B) — Dependency Status

Date: 2026-06-11. Evidence tags: `verified_fact` unless noted.

## Stack state at branch creation

| PR  | Branch                             | State                                                                                        |
| --- | ---------------------------------- | -------------------------------------------------------------------------------------------- |
| #32 | `claude/cog-002-schema-foundation` | open draft, CI `build-test` green                                                            |
| #33 | `claude/cog-003-proof-registry`    | open draft, CI `build-test` green                                                            |
| #34 | `claude/cog-004-atc`               | open draft, CI `build-test` green (first run on head `ee2f88f` confirmed success 2026-06-11) |

None of #32–#34 are merged → **Case B** from the mission brief applies:
branch from the latest COG-004 branch.

## Branch

`claude/cog-005-006-skillproof-ai-front-desk`, created from
`claude/cog-004-atc` @ `ee2f88f`. Not branched from the near-empty default
branch.

Expected PR stack: **#32 → #33 → #34 → this branch (Mission Pack B)**.

## Carried-over work

At branch creation the working tree already contained in-progress COG-006
front-desk work from this same session (lead intake + PII encryption +
draft→approval→simulated-send + purge, with 6 passing tests). Mission Pack B
absorbs and extends it; it is committed on this branch, not on cog-004.

## Hermes skills path

`/home/smrai/.hermes/skills` is **not accessible** in this environment
(`verified_fact`: ls fails). Fallback per brief: 1 skill imported from the
repo's real `hermes/skills/vision-skill` (real source_path + content hashes,
`verified_fact`) and 19 seeded from the known category list
(`likely_inference` — no backing files).
