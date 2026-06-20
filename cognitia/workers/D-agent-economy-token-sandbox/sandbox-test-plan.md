# Sandbox Accounting — Test Plan (DESIGN ONLY)

> **NO CASH VALUE. INTERNAL SANDBOX ONLY.** These are test *designs* and pure
> pseudocode for an isolated accounting sandbox. No production integration, no
> real money, no real PII. All fixtures are synthetic and clearly fake.

**Worker:** D — Agent Economy + Token Sandbox · **Date:** 2026-06-20
**Tags:** VERIFIED / INFERRED / RECOMMENDED / UNSAFE

---

## 0. Scope & fixtures

These tests target the ledger + proof invariants in `ledger-schema.md` §2 and
`proof-layer-spec.md`. They are **DESIGNS** (and optional pseudocode), not a
production test suite.

**Synthetic fixtures (fake):**
```
accounts: SYSTEM:MINT, SYSTEM:BURN, SYSTEM:PROOF, agent:ACME, agent:BORG
credit types: CMP, ACT, PRF (balances); TRP (derived score)
allocator cap: 10_000 ACT per agent
```

---

## 1. Conservation tests

**T1.1 — Per-txn balance.** For every committed `txn_id` and `credit_type`,
assert `Σ debit == Σ credit`.
```
for txn in ledger.txns():
    for ct in credit_types_in(txn):
        assert sum(debits(txn, ct)) == sum(credits(txn, ct))
```
**Pass:** all balanced. **Fail mode caught:** lopsided entry creation.

**T1.2 — Global supply reconciliation.** For each balance type:
```
supply = net_out(SYSTEM:MINT) + net_out(SYSTEM:PROOF) - net_in(SYSTEM:BURN)
assert supply == sum(agent_balance(a, ct) for a in agents)
```
**Fail mode caught:** silent mint/burn outside boundary accounts.

**T1.3 — Reversing-txn correctness.** Post a txn, then its reversal; assert all
affected balances return to pre-txn state and entries remain append-only (2 sets
of rows, none deleted).

---

## 2. No-overdraft / negative-balance tests

**T2.1 — Reject overdraft.** ACME balance 850 ACT; attempt action costing 900.
```
result = perform_action(agent:ACME, cost=900)
assert result.status == "failed"
assert agent_balance(ACME, ACT) == 850   // unchanged
assert no_entries_written_for(result.txn_id)
```

**T2.2 — Exact-zero spend allowed.** Balance 150, action settles exactly 150 →
allowed, balance → 0. (boundary test)

**T2.3 — TRP may go negative.** Reject enough proofs; assert `TRP` can be < 0
(allow_negative=true for the derived score) while `PRF` balance never < 0.

---

## 3. Double-spend & replay tests

**T3.1 — Idempotent replay.** Submit `tx-0002` twice with same idempotency key.
```
n0 = entry_count()
submit(tx_0002, key="k1"); submit(tx_0002, key="k1")
assert entry_count() == n0 + entries_of_one(tx_0002)   // applied once only
```

**T3.2 — Concurrent double-spend.** Two actions each costing 600 fire
concurrently against an 850 balance.
```
run_concurrent([action(600), action(600)])
// exactly one settles, one fails; balance ends at 250, never negative
assert exactly_one_settled() and agent_balance(ACME, ACT) == 250
```
**INFERRED:** requires atomic settle (row lock / serialized txn). Test asserts
the property, not the locking mechanism.

**T3.3 — Stale-read spend.** Action computes cost from a cached balance that has
since changed; settle must re-check current balance and reject if insufficient.

---

## 4. Reconciliation & integrity tests

**T4.1 — Tamper detection.** Mutate one `amount` in a stored entry (test harness
only); assert T1.1/T1.2 now FAIL → integrity alarm fires. Confirms the checks
actually detect corruption (a check that never fails is worthless).

**T4.2 — Append-only enforcement.** Attempt UPDATE/DELETE on `LedgerEntry`;
assert rejected.

**T4.3 — Mint-cap enforcement.** Allocator tries to mint 10_001 ACT (cap
10_000) to one agent → rejected, no entries.

**T4.4 — Periodic reconciliation job.** Run supply reconciliation over the whole
ledger; assert zero discrepancies; emit a signed reconciliation report
(synthetic).

---

## 5. Proof-layer tests

**T5.1 — Verified proof issues exactly 1 PRF.** Verify pr-100 for ar-100; assert
one balanced PRF txn and `TRP` +1.

**T5.2 — Rejected proof issues no PRF.** Reject pr-101; assert no PRF txn and
`TRP` decremented.

**T5.3 — Fail-closed.** Submit a claim with missing/invalid `evidence_hash`;
assert status resolves to `pending`/`rejected`, never `verified`.

**T5.4 — TRP is derived, never minted.** Attempt to post a `LedgerEntry` with
`credit_type=TRP`; assert rejected (invariant #7). Confirms reputation can't be
bought.

**T5.5 — No-value assertion.** Scan all attestation/memo text for forbidden
terms (`redeem`, `cash`, `ROI`, `appreciate`, `withdraw`, `$`); assert none
present. (guards the UNSAFE/marketing boundary)

---

## 6. Safety / guardrail tests

**T6.1 — No value rail exists.** Assert schema has no `redeem`/`withdraw`/
`exchange_rate`/`fiat_amount` field and `cash_value` is constant 0 for every
CreditType. (structural; fails the build if such a field is ever added)

**T6.2 — No cross-tenant transfer.** Attempt agent:ACME(tenantA) → agent on
tenantB; assert rejected.

**T6.3 — PII scan on fixtures/memos.** Assert all IDs/memos match synthetic
patterns; no real emails/phones/VINs. (GUARDRAILS PII hard-stop)

---

## 7. Coverage matrix

| Property | Tests |
|---|---|
| Conservation | T1.1, T1.2, T1.3, T4.4 |
| No overdraft | T2.1, T2.2, T2.3 |
| Double-spend/replay | T3.1, T3.2, T3.3 |
| Integrity/tamper | T4.1, T4.2, T4.3 |
| Proof correctness | T5.1–T5.4 |
| Value-free / safety | T5.5, T6.1, T6.2, T6.3 |

---

## 8. Notes (RECOMMENDED / parked)

- **RECOMMENDED:** implement T1.x, T2.x, T3.x first as pure-function unit tests
  over an in-memory ledger before any persistence — they encode the core
  invariants and are cheap. Coordinate with Worker E (harness).
- **RECOMMENDED:** make T4.1 (tamper detection) a CI gate so the conservation
  checks are proven to fail on corruption, not just pass on clean data.
- **UNSAFE — DO NOT DO YET:** any integration test that touches real payment,
  real wallets, external transfer, or live customer data. Out of scope; parked
  pending founder + legal sign-off.
