# Decision Memo — Internal-Only "Credits" Sandbox

**Status:** DECISION REQUESTED
**Owner:** Economy workstream
**Date:** 2026-06-20
**Sprint:** sprint-2026-06-20
**Classification:** Internal only

---

## Executive Summary

We need a way to **meter and account for the work autonomous agents perform** so we can later prove value (see `agent-economy-proof-harness-spec.md`). The cleanest path is an **internal unit of account — "credits" — recorded on a centralized internal ledger database**. Credits are a bookkeeping device, nothing more.

This memo makes two recommendations:

1. **BUILD (gated):** A minimal, centralized, internal-only credit ledger for metering agent compute and accounting for agent output. Play-money only.
2. **KILL (this sprint and until counsel says otherwise):** Any public token, blockchain issuance, crypto launch, tradable asset, or anything redeemable for real-world money or value.

The second recommendation is non-negotiable for this sprint. The legal, securities, AML, tax, and reputational exposure of a public token vastly exceeds any benefit we could realize now, and none of our metering goals require it.

---

## 1. Purpose

The credit sandbox exists to serve **internal engineering and economic measurement**, specifically:

| Goal | What credits do |
|------|-----------------|
| **Meter agent compute/value** | Assign a consistent internal unit to the cost (compute, tokens, tool calls, wall-clock) and the assessed output of agent work. |
| **Internal accounting** | Give every agent, task, and experiment an account so we can attribute cost and credited value, and reconcile them. |
| **Incentive experiments** | Test scheduling/reward policies (e.g., route more work to agents with higher credited-value-per-cost) in a controlled, reversible way. |
| **Proof-harness substrate** | Provide the value/cost denominator the proof harness needs to express "value created vs. cost." |

Credits are **an internal scorekeeping unit**, comparable to story points, internal cost-center chargebacks, or arcade tokens — never a financial instrument.

---

## 2. Why Internal-Only, and Why NO Public/Blockchain Token Now

This is the load-bearing section. State it plainly to anyone tempted by a token launch.

### 2.1 Securities risk
A token sold or distributed with any expectation of profit derived from our efforts is likely an **investment contract** (Howey-type analysis in the US, with analogues elsewhere). That triggers registration/exemption obligations, disclosure duties, and personal/officer liability. "We didn't mean it as a security" is not a defense. **We are not equipped to clear this bar in a sprint, and we should not try.**

### 2.2 AML / KYC / sanctions
A transferable, real-value token implicates money-transmission and **AML/KYC/sanctions-screening** regimes (FinCEN MSB registration, state money-transmitter licenses, OFAC screening, the Travel Rule). These are licensing-and-compliance programs, not features. Non-compliance is a criminal-exposure problem.

### 2.3 Tax
Issuing or transferring something of value creates **tax reporting** events for the company and potentially for recipients. We have no infrastructure for this.

### 2.4 Consumer-protection & "promises of value"
Any marketing implying a credit **will be worth something** or will appreciate creates consumer-protection and fraud exposure. No guaranteed-ROI or appreciation language, ever.

### 2.5 Reputational / strategic
An AI company launching a crypto token reads as a **cash grab** and invites maximal regulatory and press scrutiny precisely when we want to be judged on whether our agents create real value. It would overshadow the actual product thesis.

### 2.6 Irreversibility
On-chain issuance is **hard to unwind**. An internal DB ledger can be wiped, re-denominated, or reset at will. For an experimental metering tool, reversibility is a core requirement — which alone disqualifies blockchain for this use.

> **Bottom line:** None of our goals (metering, accounting, incentive experiments) require transferability, public issuance, or real-world value. Every one of those properties *adds* legal risk while *adding nothing* we need. So we omit them.

---

## 3. Design Options Considered

| Option | Description | Pros | Cons | Verdict |
|--------|-------------|------|------|---------|
| **A. Centralized internal ledger DB** | Double-entry credit ledger in our own database, internal accounts only. | Simple, reversible, auditable, zero external surface, no regulatory trigger. | We must build basic ledger discipline. | **RECOMMENDED** |
| **B. Play-money credits in app state** | Loose counters attached to agents, no formal ledger. | Trivial to build. | No auditability, easy to corrupt, can't reconcile, useless for proof. | Rejected — too weak. |
| **C. Testnet / blockchain sandbox** | Credits as tokens on a private/test chain. | "Web3-native," composable. | Adds crypto tooling, operational weight, normalizes a token path we want to kill, no benefit over A. | Rejected — wrong tool. |
| **D. Public token launch** | Real, tradable, on-chain. | — | All of §2. | **KILL** |

**Recommendation: Option A** — a centralized, double-entry, internal-only credit ledger. Simplest design that is still auditable and reversible.

---

## 4. What the Sandbox MUST NOT Do (Hard Constraints)

These are guardrails enforced in design, code review, and policy:

- **No real-money redemption.** Credits are never convertible to cash, crypto, goods, services, or discounts.
- **No transferability outside the sandbox.** Credits move only between internal system accounts within the ledger. No export, no withdrawal, no wallet.
- **No public issuance or distribution.** Credits are never granted to external users, customers, or the public.
- **No promises of value.** No documentation, UI, or comms states or implies a credit has, will have, or could appreciate to monetary worth.
- **No secondary market.** No mechanism, internal or external, to buy/sell/trade credits for anything of value.
- **No PII in the ledger.** Accounts reference internal agent/experiment identifiers only — no names, emails, or other raw personal data.
- **No bearer semantics.** Credits are always tied to a named internal account; there is no anonymous holder.

If any proposed feature touches these lines, it is **out of scope** and escalates to the gate review in §7.

---

## 5. Minimal Data Model

Double-entry, append-only. Balances are **derived** from transactions (never authoritative on their own), so the ledger is always reconstructable and auditable.

```
+------------------+        +-----------------------+        +------------------+
|     accounts     |        |     transactions      |        |   ledger_entries |
+------------------+        +-----------------------+        +------------------+
| account_id (PK)  |<--+    | txn_id (PK)           |<--+    | entry_id (PK)    |
| account_type     |   |    | txn_type              |   +----| txn_id (FK)      |
| owner_ref        |   |    | created_at            |        | account_id (FK)--+--> accounts
| status           |   |    | reason / memo         |        | direction (DR/CR)|
| created_at       |   |    | created_by (system)   |        | amount           |
+------------------+   |    | idempotency_key       |        +------------------+
                       |    +-----------------------+
   balances (derived) -+
   = SUM(credits) - SUM(debits) per account, recomputed from ledger_entries
```

**Entities**

- **accounts** — one per agent, experiment, task pool, plus system accounts (`SYSTEM_MINT`, `SYSTEM_BURN`, `SYSTEM_TREASURY`). `owner_ref` is an internal id only (no PII). `account_type ∈ {agent, experiment, pool, system}`.
- **transactions** — a logical event. `txn_type ∈ {mint, burn, transfer, meter_cost, credit_value, adjustment}`. `idempotency_key` prevents double-posting.
- **ledger_entries** — the double-entry lines. Every transaction's debits must equal its credits (invariant: `SUM(DR) == SUM(CR)` per `txn_id`).
- **mint/burn events** — modeled as transactions against `SYSTEM_MINT` / `SYSTEM_BURN`, so creation and destruction of credits are themselves auditable ledger events, never silent writes.

**Invariants**
1. Every transaction balances (Σ debits = Σ credits).
2. Total credits in circulation = `SYSTEM_MINT` issued − `SYSTEM_BURN` destroyed.
3. Entries are append-only; corrections are new `adjustment` transactions, never edits/deletes.
4. No balance goes negative without an explicit, logged policy exception.

---

## 6. Governance & Audit

- **Mint authority:** Only the harness control plane (system account) may mint, against a documented, rate-limited policy. No human-discretionary minting in the sandbox.
- **Append-only / immutable history:** No row is ever updated or deleted; reversals are compensating transactions. Full reconstruction from `ledger_entries` at any timestamp.
- **Reconciliation job:** Periodic check that derived balances equal entry sums and that circulation matches mint−burn. Discrepancy → halt + alert.
- **Audit log:** Every mint/burn/adjustment records actor (system component), reason, and idempotency key.
- **Access control:** Write path is the ledger service only; everything else is read-only. No direct DB writes.
- **Quarterly review:** Confirm no feature has drifted toward transferability/redemption (§4). Counsel sign-off required before *any* externalization.

---

## 7. Phased Plan with Gates

Each gate is a **hard stop**. No phase begins until the prior gate is signed off.

```
Phase 0  ── Phase 1 ──── Phase 2 ──────── [GATE: LEGAL] ──── Phase 3 (NOT THIS SPRINT)
 Design     Internal      Incentive          counsel +         Anything external-
 + policy   ledger        experiments        exec sign-off     facing — DEFAULT KILL
            (mint/meter)  (internal only)
```

| Phase | Scope | Exit gate |
|-------|-------|-----------|
| **0 — Design & policy** | This memo + data model + MUST-NOT list ratified. | Sign-off on constraints §4. |
| **1 — Internal ledger** | Build Option A. Mint, meter_cost, credit_value, burn. Reconciliation. Proof-harness reads it. | Reconciliation passes; invariants §5 hold; no external surface exists. |
| **2 — Incentive experiments** | Internal scheduling/reward experiments using credits. Fully reversible. | No leakage of credits outside system accounts; experiments reproducible. |
| **GATE — Legal** | **Mandatory** counsel + exec review before *any* externalization is even scoped. | Written counsel approval. Absent it → KILL. |
| **3 — Any external concept** | Out of scope this sprint. **Default disposition: KILL/PARK.** | Does not open without the Legal gate cleared. |

---

## 8. Recommendation

- **APPROVE** Phases 0–2: a centralized, internal-only, play-money credit ledger (Option A) as metering/accounting substrate for the proof harness.
- **KILL** any public-token, blockchain-issuance, tradable, or real-value ambition for this sprint and until counsel explicitly clears it. No token. No chain. No redemption. No value promises.
- **PARK** the abstract "could there ever be an external economy?" question behind the Legal gate — not to be staffed now.

The metering goal is fully achievable with a boring database. We should keep it boring.
