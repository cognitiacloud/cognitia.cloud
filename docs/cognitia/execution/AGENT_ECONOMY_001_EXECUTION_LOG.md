# AGENT-ECONOMY-001 — Execution Log

Date: 2026-06-12. Branch `claude/agent-economy-001-lab` (from `main`).
Evidence: `verified_fact` unless noted.

## Build sequence

1. **Baseline** — confirmed branch/base/parked-COG-016; `pnpm check` on clean
   main: 400/400 (see AGENT_ECONOMY_001_BASELINE.md).
2. **Migration `0016_agent_economy.sql`** — `work_orders` (8-state lifecycle,
   terminal trigger, verified_fact-release trigger that JOINS proofs),
   `skill_execution_orders` (simulation check-locked TRUE), credits-account
   owner-type widened with `escrow` (0014-style widening migration). RLS on
   both tables.
3. **Core schemas** — `packages/core/src/schemas/economy.ts`: work-order
   create/accept/deliver/decision inputs; `simulation` is a zod LITERAL true,
   mirroring the DB check.
4. **Twin repositories** — `insertWorkOrder/getWorkOrder/listWorkOrders/
updateWorkOrder`, `insertSkillExecutionOrder/list/update` in BOTH
   `InMemoryRepository` (with the 0016 guards mirrored: terminal states,
   verified_fact-only release, simulation lock) and `KyselyRepository`.
5. **Shared contract test** — one new contract case runs on memory AND
   PGlite: terminal-state enforcement, release-refusal on likely_inference,
   release on verified_fact, simulation lock, tenant isolation. 0016 added to
   both PGlite migration lists.
6. **Service `apps/api/src/agentEconomy.ts`** — create/accept (ATC trust gate,
   yank gate, self-accept refusal, escrow reserve)/deliver (simulated
   execution order + proof create-or-link; proofless delivery refused)/
   verify (verified_fact check → release → +3 reputation; owner-only at the
   handler)/reject (refund → −2 reputation)/dispute (escrow held, feedback
   label, zero reputation)/cancel (refund if reserved). Escrow ops
   `reserveCreditsForWorkOrder`/`releaseCreditsForWorkOrder`/
   `refundCreditsForWorkOrder` reuse the COG-009 `transfer` service —
   balanced pairs, idempotency keys `wo:<id>:reserve|release|refund`, audit
   event per movement.
7. **API routes** — the 10 `/agent-economy/*` routes from the brief, wired
   through the existing `sendAuthed` + RBAC helpers (verify = owner-only).
8. **Console** — `apps/web/src/app/agent-economy/page.tsx` operator page:
   summary cards (work orders, escrow totals by state, agents/skills/
   reputation impact, wallet placeholders, token public status: disabled,
   legal gate: not passed) + work-order table with
   accept/deliver/verify/reject/dispute/cancel actions. ApiClient methods +
   types added.
9. **Private token docs** — `docs/cognitia/crypto/TOKEN_LAB_001_INTERNAL.md`,
   `TOKEN_UTILITY_MAP.md` (7 founder-listed candidates, each traced to a
   built credits mechanic), `TOKEN_GATES.md` (8 conjunctive gates, all NOT
   PASSED).
10. **Lab docs** — `docs/cognitia/agent-economy/AGENT_ECONOMY_LAB.md`,
    `WORK_ORDER_MODEL.md`, `ESCROW_SIMULATION.md`.

## Test results

- New suite `apps/api/src/agentEconomy.test.ts`: **11 tests, green on first
  run** — full loop incl. balances; likely_inference AND unknown release
  refusal; proofless-delivery refusal; ATC gate + self-accept; insufficient
  credits (422); reject (refund + negative reputation) vs dispute (held +
  zero reputation + feedback label); yanked-version refusal; cancel refund +
  terminality; RBAC (viewer write 403, operator verify 403) + cross-tenant
  404/empty summary; route-surface scan (economy routes exist; no
  pay/payout/withdraw/swap/stake route; the only transfer route is
  `/credits/transfer`).
- New contract case green on memory AND PGlite; 0016 applied cleanly.
- Full gate: **`pnpm check` 413/413 tests, 64 files, green** (baseline 400 +
  11 economy + 2 contract runs). Doctrine guards included and green.

## Decisions worth recording

- **Verification (escrow release) is owner-only** — payouts follow the same
  posture as every risky action (sms.send_real, ATC revoke).
- **Dispute is terminal-in-lab**: escrow stays held; resolution is a future
  deliberate migration (candidate home for dispute bonds per the utility
  map). No silent resolution.
- **The execution proof is honest**: verified_fact ABOUT the simulation
  (evidence `execution:<id>`, verifier `verifier:economy-lab`) — it never
  claims real-world work. Weak-tagged proofs flow through delivery fine and
  are simply unable to move credits or reputation.
- **Marketplace skeleton = summary + console**, not a new listings table:
  agents (ATC-gated) + skills (tiered) + work orders ARE the marketplace at
  lab stage; a listings/pricing table can layer on once matching needs it.
- Migration number 0015 left reserved for parked COG-016.
