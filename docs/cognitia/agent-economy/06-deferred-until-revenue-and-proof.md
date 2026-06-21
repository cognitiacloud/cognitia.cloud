# Memo 6 — Deferred Until Revenue and Proof Exist

**Status:** sandbox policy · internal only
**Boundaries:** this memo is the explicit "do-not-build-yet" list. Terms from the
Memo 5 deny-list appear here **only** to name things we are *not* building.

## 1. Purpose

State plainly what must **wait** until real revenue and verified proof volume
exist, so that nothing in this sandbox is mistaken for a green light. The economy
design is intentionally allowed to run *only* in-memory until the gates pass.

## 2. Gate-by-gate: what unlocks what

Nothing below is built or started until its gate (Memo 5 §4) is **PASSED**, and the
gates are conjunctive — a single passed gate unlocks nothing on its own.

| Capability (deferred) | Blocked until |
|-----------------------|---------------|
| Any external value redemption of credits | Gates 1–5, 8 all passed |
| Cross-tenant settlement of credits | Gates 1–4, 6, 7 passed |
| Any on-chain / testnet / mainnet deployment | Gates 4, 7, 8 passed **and** explicit written approval |
| Public communications about a "token" | Gates 1–8 passed **and** counsel sign-off |
| Liquidity, market-making, or exchange listing | Not on any roadmap; gated indefinitely |
| Presale / airdrop / allocation mechanics | Not on any roadmap; gated indefinitely |

## 3. Do-not-build-yet list (explicit)

The following are **out of scope and must not be implemented** in this branch or
its sandbox, regardless of how easy they would be to add:

- [ ] Real database migrations or writes (the sandbox is in-memory only)
- [ ] Any Solidity, smart contract, wallet, RPC, or chain client
- [ ] Any redemption, cash-out, or convertibility path for credits
- [ ] Any cross-tenant or external transfer off the internal rail
- [ ] Liquidity pools, market makers, exchange listings
- [ ] Presales, airdrops, public allocations, vesting schedules
- [ ] Public-facing or investor-facing token communications
- [ ] KYC/AML onboarding flows (belong with a real settlement system, not here)

These are encoded as guardrail flags in the sandbox; flipping any of them on trips
`assert_no_public_token_surface()` and aborts.

## 4. What *is* allowed now (the safe surface)

To be unambiguous about what this work **does** deliver:

- In-memory credit ledger, proof registry, action ledger, reputation, escrow.
- Offline demos and stdlib tests of the full loop (Client Zero dealership lane and
  the Tenant Zero / MoverOS sandbox scenario).
- Design memos that align to existing sibling-branch vocabulary.

That is the entire permitted footprint until the gates move.

## 5. Triggers to revisit

Re-open this memo only when a gate's status actually changes:

| Trigger | Then |
|---------|------|
| First real recurring tenant revenue recorded | Re-evaluate Gate 1; nothing else moves yet |
| Audited verified-proof volume reached | Re-evaluate Gate 2 |
| Counsel completes review | Re-evaluate Gates 4–5; still no build without Gate 8 |
| Executive go decision documented | Gate 8; only then does *scoped* design beyond the sandbox begin |

Until then: **simulation only.** See the Memo 5 disclaimer block; it applies here
in full.

## 6. Verification

This memo is a policy checklist, not code. Its enforcement is mechanical:

```bash
# every deferred external surface must trip the guardrail
python -m unittest sandbox.agent_economy.test_economy_sandbox.GuardrailTests -v
```
`test_each_external_surface_trips` asserts that liquidity, listing, external
redemption, external transfer, and chain-deployment flags each abort the engine.
