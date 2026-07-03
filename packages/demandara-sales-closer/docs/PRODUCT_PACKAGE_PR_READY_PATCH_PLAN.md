# V2-7 PR-Ready Patch Packet Plan

No push/PR action authorized. This is a local plan only.

## Suggested review units

1. Product spine core: `spine.py`, package entrypoints, tests.
2. Fixture/demo pack: Budget Wheels fixtures and local demo outputs.
3. Static proof viewer: `static/operator-console-viewer.html`.
4. Documentation pack: audit pack, signature design, pilot gaps, scorecard, Alta update, demo script.
5. Independent audit prompts: `docs/independent-audit-prompts/*.md`.

## Pre-PR checks before any future authorization

- `PYTHONPATH=packages/demandara-sales-closer python3 -m unittest discover -s packages/demandara-sales-closer/tests -p 'test_*.py' -v`
- no network/no secrets scan
- `git diff --check`
- Claude Code read-only audit
- verify no public/investor/live/production claims

## Current packaging recommendation

Keep as one local demo branch until acceptance, then split if reviewer wants smaller units. Do not push without explicit approval.
