# Memo 1 — Internal Credit / Token Sandbox

**Status:** sandbox design · internal only
**Boundaries:** no public coin, no liquidity, no listing, no investment language,
no chain. Credits are non-redeemable internal accounting units.

## 1. Purpose

Give Cognitia agents a unit of account so that work, escrow, and incentives can
be expressed and tested — **without** issuing anything that resembles a public
token or a financial instrument. This memo defines what an internal credit *is*,
what it deliberately is *not*, and how the sandbox simulates it.

## 2. What an internal credit is

- A **non-redeemable internal accounting unit**. It records that work was
  commissioned, escrowed, and settled inside Cognitia's own books.
- **Integer-denominated**, tracked in a double-entry ledger
  (`CreditLedger` in the sandbox; aligned to the `credits_ledger` /
  `credits_accounts` vocabulary — *not verified in this branch HEAD*).
- **Internal-rail-locked**: every account sits on the `internal` rail. A posting
  to or from any non-internal rail trips a guardrail and fails.

## 3. What an internal credit is NOT

| Not | Why it matters |
|-----|----------------|
| A coin / token | No public issuance, no ticker, no supply schedule marketed to anyone |
| Redeemable for money or value | The `external_redeemable` guardrail is hard-off |
| Transferable off the internal rail | The `external_transfer` guardrail is hard-off |
| An investment | No appreciation, yield, dividend, or return is offered or implied |
| On-chain | No contract, no testnet, no mainnet, no wallet |

If any of those surfaces is ever switched on, `assert_no_public_token_surface()`
raises and the operation aborts. The boundary is executable, not just written.

## 4. Account model

| `owner_type` | Example | Role |
|--------------|---------|------|
| `system` | `system:mint` | Origin of initial credit grants; not counted as circulating |
| `tenant` | `tenant:dealership-zero` | Commissions work, funds escrow |
| `agent` | `agent:lead-rescue` | Performs work, earns credits on verified delivery |
| `escrow` | `system:escrow` | Holds credits between acceptance and verification |

Double-entry: every posting has two legs that sum to zero, so circulating
credits are conserved (`is_balanced()` checks this against what `system` minted).

## 5. Escrow lifecycle (credit view)

```
tenant --(accept: fund)--> escrow --(verify OK: release)--> agent
                                  \--(verify FAIL: refund)--> tenant
```

Escrow **only** releases to the worker against a `verified_fact` proof
(see Memo 2 and Memo 4). A mere delivery claim never moves escrowed credits.

## 6. Sandbox mapping

| Concept | Sandbox object | Sibling-branch vocabulary (unverified in HEAD) |
|---------|----------------|-----------------------------------------------|
| Accounts + balances | `CreditLedger`, `Account` | `credits_accounts` |
| Postings | `LedgerEntry`, `post()` | `credits_ledger` (idempotency-keyed) |
| Escrow | `EconomyEngine` escrow account | `work_orders` escrow |
| Boundary enforcement | `assert_no_public_token_surface()` | doctrine / `TOKEN_GATES` |

## 7. Why "sandbox-only token/credit simulation"

The simulation lets us pressure-test incentive design (does escrow + reputation
produce the behavior we want?) at zero external risk. Nothing here mints,
prices, lists, or distributes anything outside Cognitia's own memory. The
question "should there ever be a token?" is explicitly deferred to Memo 6 and the
`TOKEN_GATES`, all of which are currently NOT PASSED.

## 8. Verification

```bash
python -m sandbox.agent_economy.client_zero_demo      # see balanced ledger + escrow
python -m unittest discover -s sandbox/agent_economy -p 'test_*.py' -v
```
Relevant tests: `LedgerTests`, `GuardrailTests`, `WorkOrderLoopTests`.
