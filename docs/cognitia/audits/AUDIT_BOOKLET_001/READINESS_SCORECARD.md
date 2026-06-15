# READINESS SCORECARD — AUDIT-BOOKLET-001

Self-assessment (0–5) from repo evidence. A self-grade, not a third-party rating.

| #   | Dimension                          | Score         | Evidence                                                                       | Blocker                   | Next action                    |
| --- | ---------------------------------- | ------------- | ------------------------------------------------------------------------------ | ------------------------- | ------------------------------ |
| 1   | Architecture                       | 4             | monorepo; twin-repo contract; layered services                                 | —                         | keep contract discipline       |
| 2   | Tests                              | 4             | 515 tests, 78 files, two backends                                              | breadth of edge cases     | grow as features land          |
| 3   | Local runtime verification         | 4             | live PGlite economy smoke                                                      | —                         | add fabric smoke (pending #69) |
| 4   | Managed-Postgres readiness         | 2             | RLS in code + tested logic                                                     | dev `DATABASE_URL`        | run V-6                        |
| 5   | Tenant isolation                   | 3             | RLS + GUC + redundant predicates; contract test                                | managed-RLS unverified    | V-6                            |
| 6   | Security posture                   | 3             | RLS, audit events, deny-by-default, secrets hygiene, SECURITY.md, threat model | no external audit         | audit + SECURITY intake live   |
| 7   | Public diligence readiness         | 5             | full researcher/threat/governance/risk pack + guards                           | —                         | optional team page             |
| 8   | Crypto legitimacy readiness        | 4             | restraint + gates + standards mapping                                          | external validation       | standards spike (design)       |
| 9   | Token safety                       | 5             | no token; all gates NOT PASSED; doctrine guards                                | —                         | keep gated                     |
| 10  | Token launch readiness             | 0 (by design) | gates NOT PASSED; may never launch                                             | legal/usage/audit gates   | none — keep gated              |
| 11  | Marketplace readiness              | 3             | internal listings + matching                                                   | internal-only             | detail pages (future)          |
| 12  | Agent economy readiness            | 4             | full loop runtime-verified                                                     | production                | pilot proof                    |
| 13  | Pilot readiness                    | 2             | product works; onboarding docs                                                 | a real tenant             | Tenant Zero                    |
| 14  | Enterprise buyer readiness         | 2             | governed lifecycle + audit trail                                               | SOC2/audit/SLA            | audit; deploy                  |
| 15  | SOC 2 readiness                    | 1             | internal controls only                                                         | program/budget            | scope audit                    |
| 16  | Production deployment readiness    | 2             | runs locally/dev; no deploy                                                    | founder + V-6             | gated deploy                   |
| 17  | Documentation quality              | 5             | extensive evidence-tagged docs                                                 | —                         | keep current                   |
| 18  | Researcher discoverability         | 4             | README + entrypoints + `/trust` metadata                                       | default branch not `main` | flip default branch            |
| 19  | Standards alignment                | 3             | VC-shaped ATC; mapping doc                                                     | no integration            | design spike                   |
| 20  | Distributed agent fabric readiness | 2             | design docs on main; simulation lab pending in #69                             | merge #69 + Stage 2+      | merge #69; gated stages        |

**Shape**: strong on architecture/tests/docs/diligence/token-safety (the
un-fakeable + restraint axes); weak on managed-RLS proof, external audit, pilot
traction, production deployment — all tracked, most founder/infra-gated.
