# COG-007/010 (Final Mission Pack) — Dependency Status

Date: 2026-06-11. Evidence: `verified_fact` unless noted.

**Case B**: COG-009 is unmerged but its branch exists, is green, and its PR is
now open as **#37** (CI `build-test` succeeded on head). Branched from
`claude/cog-009-credits-wallet-placeholder` @ `94fa877`.

Full stack this pack depends on (merge in order; all open drafts, all CI green
at branch time):

| PR     | Branch                                      | Ticket                                  |
| ------ | ------------------------------------------- | --------------------------------------- |
| #32    | claude/cog-002-schema-foundation            | Schema foundation                       |
| #33    | claude/cog-003-proof-registry               | Proof Registry integrity                |
| #34    | claude/cog-004-atc                          | Agent Trust Credential                  |
| #35    | claude/cog-005-006-skillproof-ai-front-desk | SkillProof Core 20 + AI Front Desk      |
| #36    | claude/cog-008-reputation-v0                | Reputation v0                           |
| #37    | claude/cog-009-credits-wallet-placeholder   | Credits + wallet placeholders           |
| (this) | claude/cog-007-010-command-audit-proof-pack | Command dashboard + final audit/handoff |

Not branched from the near-empty default branch.
