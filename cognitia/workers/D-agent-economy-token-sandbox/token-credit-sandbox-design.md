# Cognitia Internal Credit/Ledger Sandbox — Design

> **NO CASH VALUE. INTERNAL SANDBOX ONLY.**
> Every "credit", "point", or "balance" in this system is a *play-credit* with
> **zero monetary value**, **not redeemable**, **not transferable off-platform**,
> **not a security**, and **not a token**. This document designs a *closed
> internal accounting sandbox* for metering agent behavior. It is NOT a currency,
> NOT an investment, and creates NO claim against Cognitia or any party.
> This banner is repeated at the top of every artifact in this worker on purpose.

**Worker:** D — Agent Economy + Token Sandbox
**Date:** 2026-06-20
**Classification legend:** VERIFIED / INFERRED / RECOMMENDED / UNSAFE
(see `cognitia/loop/GUARDRAILS.md`)

---

## 0. Hard-stop posture (read first)

Per `GUARDRAILS.md`, the following are **UNSAFE / DO NOT DO YET** and are
structurally excluded from this design:

- **UNSAFE** — Any public token launch, on-chain mint, or wallet/bridge.
- **UNSAFE** — Any real-money liquidity, fiat on/off ramp, or exchange listing.
- **UNSAFE** — Any "appreciation", "yield", "ROI", or investment framing.
- **UNSAFE** — Any tradability or peer-to-peer transfer with external value.
- **UNSAFE** — Any representation that credits are redeemable for money/goods.

This sandbox exists to *meter and account for agent work internally* so the team
can reason about cost, throughput, trust, and proof — nothing more.

---

## 1. Purpose & scope

**Goal (INFERRED from loop brief):** give Cognitia's agent economy an internal,
auditable way to (a) **meter** agent actions (what an agent did, at what compute
cost), (b) **price** actions in abstract internal units, and (c) **account** for
them in a balanced, double-entry-style ledger that can feed the broader
*Agent Economy proof layer*.

**In scope:** credit types, earn/spend mechanics, double-entry action ledger,
proof records, trust/reputation scoring, conservation invariants, test design.

**Out of scope (and intentionally so):** real value, payouts, token contracts,
external transfer, market making, price discovery.

---

## 2. Credit types (RECOMMENDED taxonomy)

All credit types are **non-monetary internal units**. We separate them so that
"how much compute was burned" never gets conflated with "how trustworthy an
agent is" — mixing those is the classic failure mode that drifts a sandbox
toward a tradable token.

| Credit type | Symbol | Meaning | Fungible? | Transferable? | Can go negative? |
|---|---|---|---|---|---|
| **Compute Credits** | `CMP` | Metered cost of LLM/tool/compute consumed by an action. Debited as work happens. | Yes (internal) | No | No (hard floor 0) |
| **Action Credits** | `ACT` | Budget granted to an agent/task to *authorize* doing work. Spent to perform actions. | Yes (internal) | Allocator→agent only | No |
| **Trust / Reputation Points** | `TRP` | Earned by *verified* completed-and-attested work; lost on failed verification. NON-fungible scoring signal, NOT a spendable balance. | No | No | Yes (can be net-negative reputation) |
| **Proof Credits** | `PRF` | Issued only when a ProofRecord is VERIFIED; represents "attested units of completed work". | Yes (internal, accounting only) | No | No |

**Design rule (RECOMMENDED):** `CMP`, `ACT`, `PRF` are *ledger balances*
(double-entry, conserved). `TRP` is a *derived score*, recomputed from the
ledger + proof outcomes — it is never minted/spent directly, which prevents
"buying reputation".

**INFERRED rationale:** keeping a spendable budget (`ACT`) distinct from a
consumption meter (`CMP`) mirrors how internal cloud-cost/credit systems and
metering/rate-limit systems separate "quota granted" from "usage recorded".

---

## 3. Actors

- **Allocator** — a system role (not an agent) that mints `ACT` budgets into
  agent accounts from a controlled `SYSTEM:MINT` source account. Minting is the
  ONLY place new units enter the system, and it is logged + capped.
- **Agent account** — one ledger account per agent identity; holds `ACT`,
  accrues `CMP` usage, accrues `PRF`, and has a derived `TRP`.
- **Sink accounts** — `SYSTEM:BURN` (where consumed `CMP`/`ACT` go),
  `SYSTEM:PROOF` (counterparty for `PRF` issuance).
- **Verifier** — system role that validates ProofRecords and updates `TRP`.

---

## 4. Earn / spend mechanics

### 4.1 Earning
- **ACT** is *not* earned by agents; it is **allocated** by the Allocator
  (budget grant). This avoids a "mining"/"farming" loop that would look like a
  token economy. (RECOMMENDED)
- **PRF** is *earned* only when work is completed AND a ProofRecord verifies.
  Earning = a balanced ledger entry: debit `SYSTEM:PROOF`, credit agent `PRF`.
- **TRP** is *derived*, not earned as a balance: `TRP = f(verified proofs,
  failed verifications, disputed actions)` recomputed on each proof outcome.

### 4.2 Spending
- To perform an action, an agent must hold sufficient `ACT`. The action:
  1. Reserves estimated `ACT` (hold).
  2. Executes; actual `CMP` usage is metered.
  3. Settles: debit agent `ACT`, credit `SYSTEM:BURN` for actual cost; release
     unused hold.
- **No-overdraft invariant:** spendable balances (`ACT`, `CMP`, `PRF`) can never
  go below 0. A would-be-negative settlement is rejected and the action fails.
  (See `ledger-schema.md` invariants.)

### 4.3 What is explicitly NOT possible by construction
- Agents cannot transfer `ACT`/`PRF` to each other except via the Allocator
  (which is auditable and rate-limited). (UNSAFE if removed)
- No account can withdraw, redeem, cash out, or export balances. There is no
  withdrawal endpoint, by design. (UNSAFE if added)

---

## 5. Double-entry action ledger (overview)

Every economically meaningful event produces a **balanced LedgerEntry set**:
the sum of debits equals the sum of credits, per credit type, per transaction.
Nothing is created or destroyed except at the explicit `SYSTEM:MINT` /
`SYSTEM:BURN` / `SYSTEM:PROOF` boundary accounts — and those boundary movements
are themselves logged entries, so total system supply is always reconstructable.

```
Txn: agent performs metered action
  (CMP)  debit  agent:ACME           120
  (CMP)  credit SYSTEM:BURN          120     ; usage recorded, balanced
  (ACT)  debit  agent:ACME           150     ; budget spent (incl. margin)
  (ACT)  credit SYSTEM:BURN          150
```

Full schema, entities, example rows, and invariants live in `ledger-schema.md`.

---

## 6. Mapping to the broader Agent Economy proof layer

The ledger answers **"what did it cost / what's the balance"**. The proof layer
answers **"did the agent actually do X, and can we attest to it"**.

Linkage (INFERRED design):
- Each `ActionRecord` (a thing an agent did) references the `LedgerEntry` set
  that metered it AND a `ProofRecord` that attests it.
- The proof layer consumes VERIFIED ProofRecords to (a) authorize `PRF`
  issuance and (b) feed `TRP` recomputation.
- Externally, the proof layer can publish **VERIFIED attestations**
  ("agent X completed task Y, evidence hash Z") — but NEVER credit balances as
  if they had value. See `proof-layer-spec.md`.

---

## 7. What would make this UNSAFE (and how the sandbox structurally prevents it)

| Unsafe path | Why it's unsafe | Structural prevention (RECOMMENDED) |
|---|---|---|
| Redeem credits for money/goods | Turns play-credits into a financial instrument / unregistered token | **No redemption/withdrawal code path exists.** Balances are read-only outputs; no payout entity, no fiat field anywhere in schema. |
| External / P2P transfer of value | Creates a secondary market → tradability → security-like behavior | Transfers only via audited Allocator; no agent→agent value rail; balances scoped to a single internal tenant. |
| Appreciation / yield / ROI claims | Investment promise = hard-stop boundary | No price, no exchange rate, no interest accrual entity. Docs forbid value language; banner repeats NO-CASH-VALUE. |
| Public token / on-chain mint | Hard-stop boundary | No chain, no wallet, no contract, no key custody. Mint is an internal DB row gated by Allocator + cap. |
| "Buying" reputation | Lets bad actors fake trust | `TRP` is *derived*, never minted/transferred; only verified proofs move it. |
| Unbounded mint | Looks like inflationary tokenomics; obscures accounting | Mint cap + every mint is a logged, balanced entry from `SYSTEM:MINT`; total supply reconcilable at all times. |
| Real PII in ledger memos | GUARDRAILS PII hard-stop | Synthetic IDs only (`agent:ACME`, `task:demo-001`); memo schema forbids PII; fixtures use fake data. |

**UNSAFE — DO NOT DO YET (parked, requires founder + legal sign-off):**
- Any cross-tenant or external exposure of balances *as value*.
- Any conversion table between internal credits and currency/compute-dollars.
- Any "marketplace" where agents bid credits for tasks with external stakes.

---

## 8. Prior-art basis (lightweight, INFERRED)

- **Double-entry bookkeeping** (balanced debits/credits, conservation) — a
  centuries-old accounting invariant; applied here purely as a data-integrity
  pattern, not a financial product. **INFERRED** (well-established concept;
  not re-verified against a primary source in this loop).
- **Internal compute-credit / metering / quota systems** (granted quota vs.
  recorded usage; rate-limit "token buckets") — **INFERRED** pattern analogy;
  used only as accounting structure, no external billing.
- **Attestation / evidence-hash provenance** (claim + evidence + verification
  status) — **INFERRED** analogy to supply-chain/build attestation patterns;
  see `proof-layer-spec.md`.

> Sources not independently fetched in this loop; tagged **INFERRED** rather than
> VERIFIED. If a citation-grade write-up is needed, escalate to a research pass.

---

## 9. Summary of guarantees

1. **Conservation:** per credit type, per txn, Σdebits == Σcredits. (invariant)
2. **No overdraft:** `ACT`/`CMP`/`PRF` balances ≥ 0 always. (invariant)
3. **Auditability:** supply reconstructable from `SYSTEM:*` boundary entries.
4. **No value rail:** no redemption, no withdrawal, no P2P value, no fiat field.
5. **Trust is earned, not bought:** `TRP` derived only from verified proofs.

These five together keep the sandbox *internal, balanced, and value-free*.
