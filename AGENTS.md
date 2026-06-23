# AGENTS.md — Cognitia agent operating contract

> First file every Claude / Codex / Fable / Hermes session reads. Keep it short;
> the full spec is **`docs/cognitia/execution/loop-operating-system.md`**.
>
> **Authority chain:** `docs/cognitia/ARCHITECTURE_LOCK_V1_1.md` (the Lock) >
> `docs/cognitia/IMPLEMENTATION_COMMAND_BOOK.md` > this file > the loop OS doc.
> If they conflict, the higher document wins.

## 0. Ground truth

- **Correct repo:** `C:\Users\smrai\cognitia.cloud` (GitHub:
  `cognitiacloud/cognitia.cloud`).
- **Canonical branch:** `overnight/gtm-implementation`. Base all work on it and
  target it with PRs. The default branch is intentionally near-empty — do **not**
  treat it as canonical.

## 1. STOP rules (hard — do not work around)

- **Hermes-only checkout = wrong place.** If the working tree has `hermes/` but
  **no `apps/`, `packages/`, or `package.json`**, you are NOT in the canonical
  repo. **Stop.** Re-clone or `git reset --hard origin/overnight/gtm-implementation`
  to get the full tree. Never "recreate" the platform from a hermes-only tree.
- **Unconfirmed branch = stop.** If you cannot confirm you are based on
  `overnight/gtm-implementation`, stop and report instead of guessing.

## 2. Safety lines (never cross)

- **No live outreach.** Never send real email / SMS / calls / social DMs or
  post publicly. Drafts and simulations only.
- **No vendor execution.** Never run integrations (HubSpot, Salesforce, email,
  Slack, ads, payments, crypto) against real accounts. Side-effect tools are
  **propose-only**; the `ActionLedger` is the only execution path; human approval
  is the default for send / call / CRM-mutation / ads.
- **No raw PII.** Never put raw personal data in code, logs, events, commits, or
  PRs — **refs and hashes only** (`CODEX_HANDOFF.md` invariant 7).

## 3. Defaults

- **Mock / dry-run / simulation by default.** Live paths stay gated and require
  explicit founder sign-off. Never flip a flag from mock → live on your own.
- Secrets: `.env` is never committed; reference secrets, never log them.

## 4. Workflow

- **Branch naming:** `claude/<slug>` (or `overnight/<slug>`). One concern per
  branch.
- **PRs:** open as **draft**, target `overnight/gtm-implementation`, keep the
  diff clean (no unrelated drift), CI must be green.
- **Don't silently change contracts** — propose, update docs + tests, then code.

## 5. Commands

```bash
pnpm install --frozen-lockfile   # setup (Node >=22, pnpm >=10)
pnpm check                       # format:check + typecheck + test (the gate)
pnpm test                        # vitest run
pnpm build                       # workspace build
pnpm format                      # prettier --write (run before committing)
```

CI runs `format:check → typecheck → test` on every branch and PR, so run
`pnpm format` before pushing or the format check fails.

## 6. Scores & reporting

- Readiness scores are a **0–5 self-grade**, evidence-tagged (`verified_fact`,
  `likely_inference`, `design_only`, `unverified`) — not a third-party rating.
- **Actual-live readiness is capped** (gated) until the founder signs off and the
  required gates pass — same doctrine as the "0 by design" token gates.
- Report progress via the execution-doc convention
  (`*_BASELINE` → `*_EXECUTION_LOG` → `*_HANDOFF` under
  `docs/cognitia/execution/`) plus a chat summary and a draft PR. No raw PII.

See **`docs/cognitia/execution/loop-operating-system.md`** for the full detail on
every point above, including how to handle concurrent Claude/Codex sessions.
