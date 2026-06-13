# ECONOMY-SMOKE-001 Runtime Verification Report

## Summary

The merged mainline economy stack (`main` @ `c2caf97`) was verified **beyond
the unit suite** by applying the real migrations **0001–0014 + 0016–0018**
(0015 deliberately absent) to a **local/dev Postgres engine (PGlite)** and
driving the **full Agent Economy loop through the production `ApiHandlers` +
`KyselyRepository`** — listing → order → Action-Ledger accept → escrow
reserve → deliver → verify → release + reputation, plus the negative
(weak-proof) and dispute paths. Everything passed. No production DB, no real
payments, no token transfers, no deploys.

## Repo / Commit

- Repo: `cognitiacloud/cognitia.cloud`, branch `main` @ `c2caf97`
  (Merge of #55; full stack #48→#49→#51→#52→#53→#55).
- Smoke branch: `claude/economy-smoke-001`.

## Environment

- Local/dev only. Engine: **PGlite** (in-process real Postgres, WASM) via
  `@electric-sql/pglite` + `kysely-pglite` — the repo's established
  live-Postgres convention.
- No external/production DB, no Supabase project, no network writes, no
  secrets read or printed.
- Node + pnpm 10.33.0; TS runner = vitest (only TS runner available).

## Commands Run

1. `git status` / `git pull origin main` → clean, `c2caf97`.
2. `pnpm install --frozen-lockfile` → clean.
3. `pnpm check` (baseline) → **438/438**.
4. `pnpm vitest run apps/api/src/economySmoke.live.test.ts` → **5/5** (live loop).
5. Guardrail route/page scans (server.ts route surface + web app dirs).
6. `pnpm format` + `pnpm check` (final, incl. smoke) → **443/443**.

## Migration Verification

| Migration       | Applied              | Notes                                                                                                              |
| --------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 0001–0004, 0007 | ✓                    | base tenants/integrations/GTM/events/evals                                                                         |
| 0009–0014       | ✓                    | trust core, SkillProof/reputation, lead rescue, credits/wallet, frontdesk ext, wallet deactivate                   |
| **0015**        | **ABSENT (correct)** | reserved for parked COG-016 field provenance; `field_provenance` table confirmed NOT present                       |
| **0016**        | ✓                    | `work_orders` + `skill_execution_orders` present; `credits_accounts` accepts `owner_type='escrow'` (widening live) |
| **0017**        | ✓                    | `dispute_resolutions` present                                                                                      |
| **0018**        | ✓                    | `marketplace_listings` present                                                                                     |

The chain applied cleanly in order with 0015 skipped — no dependency on the
reserved slot.

## Smoke Loop Results (happy path)

provision requester+worker agents → worker ATC + accept/deliver/dispute
permission allows → fund requester 500 internal credits → tier-2 verified
skill version (0013 trigger accepted verified_fact on real PG) → internal
marketplace listing → order-from-listing creates work order @100cr + files
worker accept ask → execute-before-approval **refused (409)** → approve on
the existing ledger → execute → **accepted, escrow reserved, 500→400** →
re-execute **refused (409), reserved exactly once** → deliver via agent ask
(simulated execution mints a `verified_fact` proof) → **verify (owner) →
escrow released, worker balance 100, reputation +3**. All five economy audit
events observed. **PASS.**

## Marketplace Verification

- Listing `visibility='internal'` confirmed on create (0018 check-locked).
- All marketplace/listing **routes exist only under `/agent-economy/`**
  (scan PASS); no public marketplace route or web page dir.
- Tier-aware match score computed live = **2031** = tier 2 × 1000 +
  reputation 3 × 10 + 1 verified order; `eligible_for_verified_work=true`.
  Confirms ranking uses tier + reputation + verified work as designed.

## Escrow Verification

- Reserve moved 100 credits requester→escrow exactly once (re-execute 409;
  balance unchanged on replay).
- Release on verify moved 100 escrow→worker (worker balance 100).
- Refund on dispute resolution restored requester to full balance (300).
- All movements internal-credits rail only; the **only** transfer route is
  `/credits/transfer`.

## Proof Verification

- Delivery via agent ask minted a `verified_fact` execution proof
  (`verifier:economy-lab`), linked onto the work order and the ledger action.
- Dispute resolution produced a `verified_fact` resolution proof
  (append-only `dispute_resolutions` record carried its `proof_id`).
- Weak proofs (`likely_inference`, `unknown`) were deliverable but could
  **not** drive verification.

## Reputation Verification

- Verified release booked **+3** (`work_order:verified`).
- Owner refund on dispute booked **−2** against the worker.
- Weak-proof path booked **zero** reputation (escrow never released).
- All reputation movement remained verified_fact-gated (0010), tenant-scoped.

## Dispute Verification

dispute on a delivered order → escrow **HELD** (`escrow_status=disputed`) →
operator arbitration **refused (403)** → **owner refund** → `resolved`,
requester fully refunded, append-only resolution record + resolution proof,
worker −2 reputation, `economy.work_order.resolved.v1` audit event. **PASS.**

## Guardrail Verification

| Guardrail                                                                  | Result                  |
| -------------------------------------------------------------------------- | ----------------------- |
| No public token/coin route                                                 | PASS (route scan)       |
| No buy/sell/pricing/dex/liquidity/staking/yield/swap/payout/withdraw route | PASS                    |
| Only transfer route is `/credits/transfer` (internal rail)                 | PASS                    |
| Marketplace/listing routes only under authed `/agent-economy/`             | PASS                    |
| No public token/marketplace/pricing web page dir                           | PASS                    |
| Doctrine guard + SkillProof no-marketplace tests                           | PASS (10/10)            |
| Real payments / token transfers                                            | none exist; not invoked |

## Bugs Found

None. The stack behaved exactly as the merged tests and docs claim, against
a real Postgres engine.

## Fixes Applied

None required. (One harness-only formatting pass via `pnpm format` on the new
smoke file.)

## Test Results

- Live smoke: **5/5** (`economySmoke.live.test.ts`).
- Full suite incl. smoke: **`pnpm check` 443/443, 68 files, green.**

## Verified Facts

Everything in this report was executed and observed this session against
PGlite real Postgres. Migration chain, escrow conservation, verified_fact
gating, reputation deltas, marketplace internal-visibility + tier ranking,
dispute refund, tenant isolation, and all route/page guardrails — all
confirmed by live runtime, not only unit tests.

## Likely Inferences

- Behavior under a **non-superuser RLS role** on a managed Postgres will
  match (the repository-layer predicates + `withTenant` GUC are exercised
  here and the dedicated RLS PGlite harness already passes), but RLS-engine
  enforcement itself is not what this run proves — see Unknowns.

## Unknowns / Blockers

- RLS-engine enforcement under a privileged-vs-restricted role on a
  persistent managed Postgres remains the documented **founder-gated**
  dev-DB step (unpause `Cognitia Preview` / provide `DATABASE_URL`). PGlite's
  default superuser bypasses RLS by design.
- No persistent dev DB was provided this session; PGlite is ephemeral.

## Recommended Next Step

Founder-gated **persistent dev DB** run: apply 0001–0018 to the managed
Postgres under a non-superuser role and re-run this exact loop to verify RLS
enforcement live (the one assurance PGlite cannot give). Everything else in
the economy stack is runtime-verified and merge-stable. Freeze otherwise
holds — no TOKEN-LAB-003, no GTM PR work, no COG-016.
