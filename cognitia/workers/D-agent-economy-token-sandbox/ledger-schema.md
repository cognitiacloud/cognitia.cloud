# Ledger Schema — Internal Credit Sandbox

> **NO CASH VALUE. INTERNAL SANDBOX ONLY.** Every balance below is a
> non-monetary play-credit. Not redeemable, not transferable off-platform, not a
> token, not a security. All example rows are **synthetic** and clearly fake.

**Worker:** D — Agent Economy + Token Sandbox · **Date:** 2026-06-20
**Tags:** VERIFIED / INFERRED / RECOMMENDED / UNSAFE

---

## 1. Entities

### 1.1 `CreditType`
Defines a kind of internal unit. (RECOMMENDED)

| field | type | notes |
|---|---|---|
| `credit_type_id` | string PK | e.g. `CMP`, `ACT`, `TRP`, `PRF` |
| `name` | string | human label |
| `is_balance` | bool | true for CMP/ACT/PRF; **false for TRP** (derived score) |
| `allow_negative` | bool | false for balances; true only for TRP |
| `transfer_policy` | enum | `none` \| `allocator_only` |
| `cash_value` | const `0` | **immutable 0. Field exists solely to assert no value.** |

### 1.2 `Account`
One per agent + the system boundary accounts. (RECOMMENDED)

| field | type | notes |
|---|---|---|
| `account_id` | string PK | `agent:ACME`, `SYSTEM:MINT`, `SYSTEM:BURN`, `SYSTEM:PROOF` |
| `kind` | enum | `agent` \| `system` |
| `tenant_id` | string | single internal tenant; no cross-tenant value |
| `created_at` | timestamp | |

> Balances are NOT stored on `Account`; they are **derived** by summing
> `LedgerEntry` rows (source of truth = the ledger). (RECOMMENDED — prevents
> balance/ledger drift.)

### 1.3 `LedgerEntry`
The atomic double-entry line. Entries are grouped by `txn_id`. (RECOMMENDED)

| field | type | notes |
|---|---|---|
| `entry_id` | string PK | |
| `txn_id` | string | groups balanced lines of one transaction |
| `account_id` | FK | |
| `credit_type_id` | FK | |
| `direction` | enum | `debit` \| `credit` |
| `amount` | integer ≥ 0 | integer units only (no floats → no rounding drift) |
| `action_record_id` | FK nullable | links to the metered action |
| `memo` | string | **NO PII**; synthetic refs only |
| `created_at` | timestamp | append-only; entries are immutable |

> **INFERRED:** integer-only amounts avoid floating-point conservation errors,
> a known double-entry pitfall.

### 1.4 `ActionRecord`
A thing an agent did. (RECOMMENDED)

| field | type | notes |
|---|---|---|
| `action_record_id` | string PK | |
| `agent_account_id` | FK | |
| `action_type` | string | `tool_call`, `llm_gen`, `task_complete`, ... |
| `task_ref` | string | synthetic, e.g. `task:demo-001` |
| `estimated_cost` | integer | reserved hold |
| `actual_cost` | integer | settled CMP |
| `status` | enum | `reserved` \| `settled` \| `failed` |
| `proof_record_id` | FK nullable | attestation link |
| `created_at` | timestamp | |

### 1.5 `ProofRecord`
See `proof-layer-spec.md` for full semantics. (RECOMMENDED)

| field | type | notes |
|---|---|---|
| `proof_record_id` | string PK | |
| `action_record_id` | FK | what is being attested |
| `claim` | string | "agent X did Y" |
| `evidence_hash` | string | hash of logs/output (no raw PII) |
| `verification_status` | enum | `pending` \| `verified` \| `rejected` |
| `verifier` | string | system role id |
| `verified_at` | timestamp nullable | |

### 1.6 `TrustScore` (derived, not a balance)
| field | type | notes |
|---|---|---|
| `agent_account_id` | FK PK | |
| `trp` | integer (may be negative) | `f(verified, rejected, disputed)` |
| `verified_count` | integer | |
| `rejected_count` | integer | |
| `last_recomputed_at` | timestamp | |

---

## 2. Invariants (enforced)

1. **Conservation per txn per credit type:** for every `txn_id` and every
   `credit_type_id`, `Σ amount(debit) == Σ amount(credit)`. Reject the whole txn
   atomically if it fails. (VERIFIED property of double-entry; **INFERRED** as
   the right fit here.)
2. **No negative balance for `is_balance` types with `allow_negative=false`:**
   a settlement that would drive `CMP`/`ACT`/`PRF` below 0 is rejected.
3. **Supply reconstruction:** total units of a balance type in circulation ==
   net flow out of `SYSTEM:MINT`/`SYSTEM:PROOF` minus net flow into
   `SYSTEM:BURN`. Must reconcile exactly at any time.
4. **Append-only / immutable entries:** `LedgerEntry` is never updated or
   deleted; corrections are *reversing* txns. (audit integrity)
5. **Mint gate:** only `SYSTEM:MINT`→agent `ACT` flows create new spendable
   units, only via Allocator, under a configured cap. (UNSAFE if bypassed)
6. **Idempotency:** each `txn_id` derives from an idempotency key; replaying the
   same key produces no new entries. (double-spend / replay defense)
7. **TRP is never a ledger movement:** no `LedgerEntry` may use a `credit_type`
   with `is_balance=false`. (prevents "buying" reputation)
8. **cash_value == 0 immutable** for every CreditType. (UNSAFE if ever nonzero)

---

## 3. Synthetic example rows

### CreditType
```
CMP | Compute Credit    | is_balance=true  | allow_negative=false | transfer=none           | cash_value=0
ACT | Action Credit     | is_balance=true  | allow_negative=false | transfer=allocator_only | cash_value=0
PRF | Proof Credit      | is_balance=true  | allow_negative=false | transfer=none           | cash_value=0
TRP | Trust Point       | is_balance=false | allow_negative=true  | transfer=none           | cash_value=0
```

### Account
```
SYSTEM:MINT  | system | tenant=cognitia-internal
SYSTEM:BURN  | system | tenant=cognitia-internal
SYSTEM:PROOF | system | tenant=cognitia-internal
agent:ACME   | agent  | tenant=cognitia-internal
agent:BORG   | agent  | tenant=cognitia-internal
```

### Txn A — Allocator grants 1000 ACT budget to agent:ACME
```
txn_id=tx-0001
  ACT | debit  | agent:ACME    | 1000
  ACT | credit | SYSTEM:MINT   | 1000        ; balanced (1000 == 1000)
```
ACME ACT balance = 1000.

### Txn B — ACME performs a metered tool_call (action ar-100)
Estimated 200 ACT reserved; actual compute = 120 CMP, settled cost 150 ACT.
```
txn_id=tx-0002  (action_record_id=ar-100)
  CMP | debit  | agent:ACME    | 120
  CMP | credit | SYSTEM:BURN   | 120         ; usage recorded, balanced
  ACT | debit  | agent:ACME    | 150
  ACT | credit | SYSTEM:BURN   | 150         ; budget spent, balanced
```
ACME ACT balance = 1000 - 150 = 850. CMP "spent" total = 120.

### Txn C — Proof verified → issue 1 PRF to ACME
ProofRecord pr-100 for ar-100 verified.
```
txn_id=tx-0003  (action_record_id=ar-100)
  PRF | debit  | agent:ACME    | 1
  PRF | credit | SYSTEM:PROOF  | 1           ; balanced
```
ACME PRF balance = 1. TrustScore recomputed: verified_count=1, trp=+1.

### Txn D — Rejected double-spend / replay attempt (NOT written)
ACME tries to re-submit tx-0002 with the same idempotency key after the
balance was already settled. Invariant #6 (idempotency) → **no new entries**.
A fresh action requesting 900 ACT when balance is 850 → invariant #2 → rejected,
action status=`failed`, no entries written.

### TrustScore (derived)
```
agent:ACME | trp=+1 | verified=1 | rejected=0 | last_recomputed=2026-06-20T...
agent:BORG | trp=0  | verified=0 | rejected=0 | last_recomputed=2026-06-20T...
```

---

## 4. Reconciliation view (RECOMMENDED)

At any instant:
```
supply(ACT) = Σ ACT out of SYSTEM:MINT  - Σ ACT into SYSTEM:BURN
            = 1000 - 150 = 850  == Σ agent ACT balances (ACME 850, BORG 0) ✓
supply(PRF) = Σ PRF out of SYSTEM:PROOF = 1 == Σ agent PRF balances ✓
```
If these don't match → integrity alarm (see `sandbox-test-plan.md` §4).

> **UNSAFE — DO NOT ADD:** any `redeem`/`withdraw`/`exchange_rate`/`fiat_amount`
> field, any cross-tenant transfer, any nonzero `cash_value`. These convert the
> sandbox into a value-bearing instrument and hit hard-stop boundaries.
