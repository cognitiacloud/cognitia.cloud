# 16 — Codex Verification Prompt

You are Codex reviewing a local/mock-only Demandara GTM OS build.

## Verification goals

Determine whether the build actually implements the promised local/mock-only workflow and preserves safety boundaries.

## Inspect

- changed files;
- package structure;
- tests;
- fixtures;
- consent gate;
- approval gate;
- connector registry;
- model router;
- proof receipt;
- Command Center summary;
- docs claim language.

## Required checks

1. No live provider/API/CRM/outreach/deploy action exists in the new path.
2. Budget Wheels fixtures are fake/reserved/internal only.
3. Missing consent fails closed.
4. Missing human approval fails closed.
5. Caller-supplied approval cannot satisfy the gate.
6. Mock writeback is clearly mock-only.
7. Connector registry defaults live connectors to blocked/disabled.
8. Model-router does not call live providers by default.
9. Proof receipt is generated in both allowed and blocked paths.
10. Docs do not claim production/Beta/public readiness.
11. Canon strings remain unchanged.

## Verdict labels

Use only `PASS`, `PASS_WITH_EXPLICIT_RISK`, `NEEDS_FIX`, `BLOCKED_ENVIRONMENT`, or `SCOPE_NOT_VISIBLE`.

## Output format

```text
VERDICT:
SUMMARY:
FILES_REVIEWED:
TESTS_OBSERVED:
BLOCKERS:
EXPLICIT_RISKS:
RECOMMENDED_FIXES:
NO_ACTION_LEDGER:
```
