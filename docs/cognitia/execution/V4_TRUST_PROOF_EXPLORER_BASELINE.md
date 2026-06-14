# V-4 Trust / Proof Explorer — Baseline

Date: 2026-06-14. Branch `claude/v4-trust-proof-explorer` (from `main`).

| Check                            | Result                                                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `main` pulled                    | `7b60013` (CRYPTO-VISIBILITY-001 merged; runtime-status docs merged)                                                       |
| `pnpm install --frozen-lockfile` | clean                                                                                                                      |
| Baseline test result             | **443/443 green** (carried from `7b60013`; this ticket adds 11)                                                            |
| Web stack                        | Next.js App Router (`apps/web/src/app`); `react`/`react-dom`; vitest env=node, includes `apps/**/*.test.ts` (no jsdom/RTL) |
| Existing convention              | operator console pages are `'use client'` paste-token; root redirects to `/approvals`                                      |

## Design decision

Because there is no DOM test runtime and the page must be public-safe and
expose zero private state, `/trust` is built as a **static server component**
with hard-coded content sourced from merged status docs — no API, no token,
no client writes. Guards are a `.test.ts` source-scan (the repo's established
pattern in `doctrine.guard.test.ts` and `skillproof.test.ts`).

## Guardrail note discovered during baseline

The doctrine guard lowercases every `apps/web` file and rejects the literals
`get in early / presale / airdrop / staking rewards / to the moon`. The V-4
guard test therefore assembles those needles at runtime (neutral identifier
names) and builds its directory-scan regex dynamically, so the test file
itself never contains a banned literal — same technique the doctrine guard
uses on itself.
