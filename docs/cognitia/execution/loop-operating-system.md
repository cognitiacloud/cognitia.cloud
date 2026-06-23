# Cognitia — Agent-Loop Operating System

Date: 2026-06-23
Audience: every Claude / Codex / Fable / Hermes coding or research session.
Purpose: stop the recurring drift (wrong repo, wrong branch, re-derived
conventions, safety near-misses) by making session start-up deterministic.

**Authority chain (highest wins):**
`ARCHITECTURE_LOCK_V1_1.md` (the Lock) > `IMPLEMENTATION_COMMAND_BOOK.md` >
`AGENTS.md` (the short anchor) > **this document**.
`AGENTS.md` is the one-page contract; this file is the detail behind it.

---

## 1. Repo & branch ground truth

- **Correct repo:** `C:\Users\smrai\cognitia.cloud` on the founder's machine;
  GitHub remote `cognitiacloud/cognitia.cloud`.
- **Canonical branch:** `overnight/gtm-implementation`. Base every working branch
  on it and target it with every PR.
- The repo's **default branch is intentionally near-empty**. Do not treat it as
  ground truth and do not "fix" it by committing the platform onto it.
- Canonical tree shape (sanity check you are in the right place): `apps/`,
  `packages/`, `docs/`, `hermes/`, `scripts/`, `package.json`,
  `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig*.json`, `vitest.config.ts`.

First action of every session:

```bash
git fetch origin overnight/gtm-implementation
git status            # know your branch + cleanliness
git ls-files | sed -n '1,5p'   # confirm apps/ packages/ exist, not just hermes/
```

## 2. Wrong-repo / hermes-only STOP rule

The single most common drift: a session boots into a checkout that contains
**only `hermes/`** (no `apps/`, no `packages/`, no `package.json`). That is **not
the canonical repo** — it is a partial/seeded tree.

**Detection:**

```bash
test -d apps && test -d packages && test -f package.json \
  && echo "OK: canonical tree" \
  || echo "STOP: hermes-only / wrong tree"
```

**Required action when it triggers:**

1. **Stop.** Do not create `apps/`, `packages/`, migrations, or "recreate" the
   platform — you would be rebuilding from nothing and diverging.
2. Recover the full tree: re-clone, or
   `git reset --hard origin/overnight/gtm-implementation` on a branch you own.
3. If you still cannot get the canonical tree, **report and end the turn** —
   never substitute a greenfield rebuild (the Lock §9 rejects greenfield).

Same rule for branch confidence: if you cannot confirm your branch descends from
`overnight/gtm-implementation`, stop and report rather than guess.

## 3. Safety doctrine — lines you never cross

These mirror the non-negotiable invariants in `docs/CODEX_HANDOFF.md` and the
posture in `SECURITY.md`.

- **No live outreach.** Never send real email, SMS, phone calls, or social
  messages, and never post publicly on behalf of Cognitia or a tenant. Produce
  drafts and simulated sends only.
- **No vendor / integration execution.** Never run real side effects against
  external accounts — HubSpot, Salesforce, email providers, Slack, ad platforms,
  payments, crypto/token actions. Side-effect tools are **propose-only**; the
  `ActionLedger` is the **only** path to execution, and every external side
  effect carries risk + approval + idempotency (`CODEX_HANDOFF.md` invariants
  3–4). **Human approval is the default** for send / call / CRM-mutation / ads
  (invariant 6).
- **No raw PII.** No raw personal data in code, logs, events, fixtures, commits,
  or PR text — **refs and hashes only** (invariant 7). When in doubt, redact.
- **Secret hygiene.** `.env` is never committed; secrets are referenced, never
  logged. Use `.env.example` for shape only.
- **Don't silently change contracts.** Propose, update docs + tests, then code.

## 4. Mock / dry-run defaults

- The platform is **simulation-first**. Mock / dry-run / simulation mode is the
  default for anything with a side effect; live execution stays **gated**.
- Never flip a flag from mock → live, enable a real provider, or remove a gate on
  your own initiative. That is a founder decision.
- When you add a side-effecting capability, ship it mock-safe first (simulated
  provider + tests), with the live path behind an explicit, documented gate.

## 5. Branch naming

- Use `claude/<slug>` (dominant convention) or `overnight/<slug>` for
  founder-coordinated overnight runs. Slugs are short, kebab-case, descriptive.
- **One concern per branch.** Do not mix an instructions change with a feature,
  or carry unrelated drift (e.g. a stray `hermes/` skill commit) into a docs PR.
- Always base a new branch on `overnight/gtm-implementation`.

## 6. PR state rules

- Open every PR as a **draft** unless the founder asks otherwise.
- **Target `overnight/gtm-implementation`**, not the default branch.
- Keep the diff **clean and scoped** — only the files your task requires. Run
  `git diff --name-only origin/overnight/gtm-implementation` and confirm the list
  matches your intent before pushing.
- **CI must be green** (`format:check → typecheck → test`). Fix red CI; don't
  merge over it.
- Docs-only tasks must stay docs-only — no product code, config, or CI changes.
- Don't force-push a branch another session owns (see §13).

## 7. Test commands

```bash
pnpm test          # vitest run (the suite)
pnpm test:watch    # vitest (local iteration)
pnpm check         # format:check + typecheck + test — run before every push
```

Add or extend tests with any behavioral change; grow coverage as features land.

## 8. Build commands

```bash
pnpm install --frozen-lockfile   # Node >=22, pnpm >=10 (see package.json engines)
pnpm build                       # pnpm -r run build (all workspaces)
pnpm typecheck                   # tsc --noEmit + web typecheck
```

## 9. Safety scans & formatting gate

- **`pnpm check`** is the umbrella gate: `format:check` (prettier over
  `**/*.{ts,tsx,js,json,md,yaml,yml}`) → `typecheck` → `test`. CI
  (`.github/workflows/ci.yml`) runs the same steps on every branch and PR.
- Run **`pnpm format`** before committing so `format:check` passes — markdown is
  in the prettier glob, so even docs-only PRs must be prettier-clean.
- PII / secret scan mindset: before committing, grep your diff for emails, phone
  numbers, names, tokens, and keys; replace with refs/hashes or remove.
- `.env` and real credentials never enter the tree.

## 10. Score semantics

- Readiness scores are a **0–5 self-grade from repo evidence — a self-grade, not
  a third-party rating** (see
  `docs/cognitia/audits/AUDIT_BOOKLET_001/READINESS_SCORECARD.md`).
- Every score cites evidence and is tagged with one of: **`verified_fact`**
  (proven in-repo / runtime), **`likely_inference`**, **`design_only`** (spec
  exists, not built), **`unverified`**. Use these tags in execution docs too.
- Some dimensions are **"0 by design / gated"** (e.g. token-launch readiness):
  the score stays pinned low on purpose until external gates pass. Treat that as
  a feature, not a gap to "fix" by inflating the number.
- Never raise a score without new evidence at the matching tag strength.

## 11. Actual-live readiness cap

- **Actual-live readiness is capped (gated).** No matter how complete the
  simulation, the actual-live readiness score may not exceed the gated ceiling
  (treat as **≤ 2 / "gated"**) until **both**: (a) the founder explicitly signs
  off, and (b) the required gates pass (security review, managed-provider
  verification, contracts, approvals).
- This is the same doctrine as the token gates being "NOT PASSED / 0 by design":
  capability built in simulation does **not** equal live authorization.
- An agent may **propose** lifting the cap (with evidence); it may never lift it
  itself.

## 12. How to report progress

Use the established execution-doc convention under `docs/cognitia/execution/`:

- **`<TASK>_BASELINE.md`** — what existed before you started (ground truth +
  evidence tags).
- **`<TASK>_EXECUTION_LOG.md`** — what you did, in order, with evidence.
- **`<TASK>_HANDOFF.md`** — state at handoff: done, in-progress, blockers, the
  next session's first action. Long runs may add a `HEARTBEAT`/`RUN_LOG`.

Plus, every session ends with: a concise chat summary, a **draft PR** targeting
canonical, and evidence-tagged claims. **No raw PII** in any of these artifacts.

## 13. Concurrent Claude / Codex sessions

Multiple sessions run in parallel; coordinate to avoid clobbering:

- **One concern per branch**, each session on its **own** `claude/<slug>` branch.
  Never commit to or force-push a branch another session owns.
- **Rebase on canonical**, don't merge sideways between in-flight feature
  branches. Pull `overnight/gtm-implementation` before starting and before
  pushing.
- **Prefer additive, append-only docs** (new files / new sections) over rewriting
  shared docs another session may be editing; this minimizes conflicts.
- **Declare overlap in the `HANDOFF`**: if your task touches an area another
  session is in, note it so the founder can sequence merges.
- **Resolve conflicts via the authority chain** (§ top): the Lock and Command
  Book win; when two sessions disagree, escalate to the founder rather than each
  "winning" by force-push.
- If you discover you're duplicating another session's open PR, **stop and
  report** instead of producing a competing PR.

## 14. Quick start checklist (every session)

1. `git fetch origin overnight/gtm-implementation`; confirm canonical tree (§2).
2. Create / check out `claude/<slug>` based on canonical (§5).
3. Re-read `AGENTS.md`; obey the safety lines (§3) and mock defaults (§4).
4. Make the scoped change; keep PII out; keep the diff clean (§6, §9).
5. `pnpm install --frozen-lockfile && pnpm format && pnpm check` (§7–9).
6. Write `BASELINE` / `EXECUTION_LOG` / `HANDOFF` as appropriate (§12).
7. Push; open a **draft** PR to `overnight/gtm-implementation` (§6).
8. Summarize in chat with evidence tags; never raise the live cap yourself (§11).
