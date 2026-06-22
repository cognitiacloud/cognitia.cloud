# Agent-Commerce Readiness

**Status legend:** REAL · SANDBOX · PLANNED · MOCK · PARKED.

**Repo reality check (2026-06-22):** Greenfield repository (`hermes/` only). Everything below is **PLANNED** or **PARKED**. Nothing here is implemented. This document explicitly defines what we will *document now* versus what we will *not build* until after real pilots. No tokens, no blockchain, no payments, no fundraising claims are in scope. This is not a production-readiness statement.

---

## 1. What "agent-commerce" means here

We use **agent-commerce** to mean a future world in which software agents transact — discover, negotiate, commit, and account for value — **on behalf of** humans or businesses. In that world, the binding questions are not "can the agent do it?" but:

- **On whose behalf** is the agent acting, and how is that provable?
- **Was it authorized**, and was the action **in scope** of that authorization?
- **What actually happened**, and can it be **re-verified** later?
- **Can a dispute** be resolved mechanically rather than rhetorically?

Our readiness posture is to make the **proof and consent layer** excellent and protocol-neutral, while keeping anything that *moves value or asserts an agent's spendable identity* firmly **PARKED**.

---

## 2. Proof receipts and consent gates in an agent-commerce world

### 2.1 Proof receipts (PLANNED schema; SANDBOX validator)

A **proof receipt** is a structured, append-only record describing a single agent action. Conceptually it captures:

- **Actor**: which agent/workflow ran (a logical identifier — *not* a value-bearing identity; see PARKED scope).
- **Principal**: on whose behalf, referenced indirectly (no raw PII).
- **Authorization reference**: pointer to the consent/grant that permitted the action.
- **Action + scope**: what was attempted and the scope it claimed.
- **Inputs digest**: a hash/reference to inputs (so they can be re-supplied for replay).
- **Outcome**: result, gate decisions, and any errors.
- **Replay handle**: enough to reconstruct the run deterministically against fixtures.

**Mapping to agent-commerce:** When agents transact, the receipt is the unit other parties verify. A counterparty agent can ask "show me the receipt for the action you claim," and a human principal can audit "what did my agent do for me." Receipts make agent claims *checkable*, which is the scarce property in a world of abundant agents. **We build the schema and a local validator now; we do not build any settlement or value transfer.**

### 2.2 Consent gates (SANDBOX primitive)

A **consent gate** is a pre-action check: before an agent performs an action, it must resolve an authorizing record that (a) exists, (b) covers the principal, and (c) covers the action's scope. The gate decision is logged into the TrustOps event log and referenced by the receipt.

**Mapping to agent-commerce:** Consent gates are how "the agent acted *with* authority" becomes evidence rather than assertion. In commerce, this is the difference between an authorized purchase and an unauthorized one — but **note the boundary**: we gate and log the *decision to act*; we do **not** execute any payment. The gate's value here is compliance and disputability, not transaction execution.

### 2.3 Together: the disputability chain

`Consent grant (referenced)` → `Consent gate decision (logged)` → `Action (recorded)` → `Proof receipt (signed/append-only)` → `Replay pack (portable)`.

This chain is what makes the system **compliance-native** and **dispute-ready** without ever touching money.

---

## 3. Agent authorization protocols — landscape (described, not implemented)

This section *describes* categories in the emerging agent-authorization space so we can design a neutral verification interface. **We implement none of these.** Specific named protocols are intentionally referred to by category to avoid coupling our design to a moving target; the conformance work is spec-only (see bet B7 in the R&D map).

| Category | What it addresses | Our stance |
|---|---|---|
| **Delegated authorization grants** | A principal issues a scoped, time-bounded grant that an agent presents when acting (conceptually similar to scoped access tokens / delegation in OAuth-family thinking, extended to agents). | **Spec a verification interface** that can check "is this grant valid and in-scope?" — adapter-shaped, protocol-agnostic. PLANNED. |
| **Capability / attenuation models** | Authority expressed as capabilities that can be narrowed (attenuated) as they are delegated down a chain. | Document as a design influence for scope-checking; do not implement an issuer. PLANNED (docs). |
| **Verifiable credentials / attestations** | Third-party attestations about a principal or agent that can be verified without contacting the issuer live. | Document the *verification* shape; **issuing credentials is PARKED** (touches identity). |
| **Agent-to-agent handshake / discovery protocols** | How agents announce identity, capabilities, and terms before transacting. | Watch and document only. PARKED where it implies identity/value. |
| **Payment-authorization / mandate protocols** | Standards for authorizing an agent to *pay* on a principal's behalf. | **Fully PARKED. Not designed, not specced beyond naming the category as out-of-scope.** |

**Design principle:** Build *toward an interface that verifies authorization*, never *toward issuing or holding it*. Verification is compliance-positive and value-neutral; issuance and holding are where identity/wallet/payments risk lives.

---

## 4. PARKED scope (explicit contract)

This is a binding boundary for this program phase. It is documentation of intent, not a backlog to start.

### 4.1 What we DOCUMENT now (allowed)

- The *conceptual* role of agent identity, wallet, and payments in a future agent-commerce world.
- A *verification interface* for authorization grants (checking validity/scope), with no issuance.
- The *disputability chain* (consent → gate → action → receipt → replay) that operates entirely without value transfer.
- A landscape survey of protocols, described by category.

### 4.2 What we will NOT BUILD until after real pilots + explicit gate (banned implementation scope)

- **No agent identity issuance** — no creation of durable, value-bearing agent identities or credentials.
- **No wallet** — no component that holds, custodies, or represents value or balances.
- **No payments / settlement** — no movement of money, credits, points, or any transferable value, real or simulated-as-real.
- **No token** — no token of any kind, no minting, no balances.
- **No blockchain / chain / on-ledger mechanism** — none, anywhere, for any purpose.
- **No public fundraising mechanics** — no sale, presale, allocation, or solicitation.
- **No live payment-authorization mandates** — even as a "demo."

**Gate to unpark (all required):** (1) at least one completed real pilot of the proof/consent layer with willing participants; (2) external legal/compliance review specific to the target jurisdiction and vertical; (3) an explicit written decision by the program owner; (4) a separate, reviewed spec that re-scopes only the minimal capability needed. Absent all four, the above remains PARKED.

### 4.3 Banned hype language (do not use, in docs, code, or comms)

Avoid framing that implies value movement, financial return, or fundraising:

- "Tokenomics", "token", "presale", "ICO", "IDO", "airdrop", "allocation".
- "Agents that earn / pay / spend / settle" (as a *current* capability).
- "Decentralized", "on-chain", "web3", "DeFi", "smart contract" in any product-claim sense.
- "Guaranteed returns", "yield", "invest", "fundraise", "raise" tied to the product.
- "Autonomous money", "agent economy you can buy into".
- Any phrasing that presents PARKED scope as available, imminent, or production-ready.

When the future is referenced, it must be tagged **PARKED** and phrased as "a possible future direction, not built."

---

## 5. Raising enterprise readiness WITHOUT touching live payments

These are the levers that increase enterprise trust and procurement-readiness while staying entirely inside the boundary. All are **PLANNED** unless noted.

1. **Receipt completeness & integrity** (SANDBOX → REAL): every sandboxed action emits a complete, tamper-evident receipt. Enterprises value auditability.
2. **Replay fidelity** (SANDBOX): demonstrate that a recorded run re-executes to the same result against fixtures — a powerful, payment-free trust demo.
3. **Consent/gate coverage metrics** (PLANNED): show that X% of actions passed an explicit, logged consent gate.
4. **Dispute/replay pack export** (SANDBOX): a portable artifact an enterprise auditor can inspect offline.
5. **Compliance-native workflow templates** (PLANNED): per-vertical disclosure/retention/consent mappings, reviewed with domain experts.
6. **TrustOps analytics** (PLANNED): dashboards over gate pass rates, dispute rates, replay success — the metrics a buyer's risk team asks for.
7. **Data minimization & residency posture** (PLANNED, docs): document that the system runs on synthetic/sandbox data and what a real-data posture *would* require — without collecting real data now.
8. **Authorization verification interface** (PLANNED): the ability to *check* a delegated grant raises trust without issuing or holding anything.
9. **Access logging & least-privilege design** (PLANNED): standard enterprise hygiene, fully payment-free.

**Key insight:** Most enterprise-readiness signals a buyer's security/legal team cares about — auditability, consent, disputability, data minimization, least privilege — are *exactly* our moat assets and require **zero** payment, identity, or chain capability. We can become enterprise-credible long before anything is unparked.

---

## 6. Cross-references

- Moat thesis and build/spec/park split: `future-proofing-rd-map.md`.
- Quarter-by-quarter plan, gates, and kill criteria: `12-month-moat-roadmap.md`.

---

*Research and planning only. PARKED items are not implemented and must not be presented as available. No production-readiness is claimed.*
